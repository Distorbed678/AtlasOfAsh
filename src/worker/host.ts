import { applyCommand } from '../engine/commands';
import { CONTENT } from '../engine/content';
import { decodeSave, encodeSave } from '../engine/save/codec';
import type { SaveManager } from '../engine/save/saveManager';
import { advance } from '../engine/sim';
import { addItem, createInitialState, SAVE_VERSION, type GameState } from '../engine/state';
import { summarize, takeSnapshot } from '../engine/summary';
import type { DebugBundle, FromWorker, ToWorker, WorkerRequest } from './protocol';

export const TICK_MS = 100;
/** A real-time gap larger than this is treated as offline time and caught up in chunks. */
export const OFFLINE_THRESHOLD_MS = 5_000;
/** Only show the away report for gaps at least this long. */
export const AWAY_SUMMARY_MIN_MS = 60_000;
export const AUTOSAVE_MS = 30_000;
export const BACKUP_MS = 10 * 60_000;
/** Sim time advanced per catch-up chunk before checking the wall clock. */
const CATCHUP_CHUNK_MS = 60_000;
/** Yield to the event loop (to post progress and receive messages) this often. */
const CATCHUP_YIELD_MS = 30;

export interface HostDeps {
  saves: SaveManager;
  now: () => number;
  post: (msg: FromWorker) => void;
  yieldToEventLoop: () => Promise<void>;
  newSeed: () => number;
  build: { appVersion: string; buildSha: string; buildTime: string };
}

/**
 * Owns the authoritative GameState inside the Web Worker. Pure logic with all
 * I/O injected, so it is fully testable in Node.
 */
export class GameHost {
  state!: GameState;
  private ready = false;
  private busy = false;
  private queue: ToWorker[] = [];
  private speed = 1;
  private lastAutosave = 0;
  private lastBackup = 0;

  constructor(private readonly deps: HostDeps) {}

  async init(): Promise<void> {
    const { saves, now } = this.deps;
    const loaded = await saves.load();
    this.state = loaded ?? createInitialState(this.deps.newSeed(), now());
    const backups = await saves.listBackups();
    this.lastBackup = backups[0]?.savedAt ?? 0;
    this.lastAutosave = now();
    if (loaded) await this.maybeBackup(now());
    else await saves.save(this.state);

    this.ready = true;
    this.deps.post({ type: 'ready' });
    await this.catchUpOffline();
    this.postSnapshot();
    await this.drainQueue();
  }

  /** Called every TICK_MS by the worker's timer. */
  async tick(): Promise<void> {
    if (!this.ready || this.busy) return;
    const now = this.deps.now();
    const elapsed = Math.max(0, now - this.state.lastRealTime);
    if (elapsed > OFFLINE_THRESHOLD_MS && this.speed === 1) {
      // Tab was suspended / machine slept: catch up properly with a report.
      await this.catchUpOffline();
    } else {
      advance(this.state, this.state.time + Math.round(elapsed * this.speed));
      this.state.lastRealTime = now;
    }
    this.postSnapshot();
    if (now - this.lastAutosave >= AUTOSAVE_MS) await this.persist(now);
  }

  async handle(msg: ToWorker): Promise<void> {
    if (!this.ready || this.busy) {
      this.queue.push(msg);
      return;
    }
    try {
      await this.dispatch(msg);
    } catch (err) {
      this.deps.post({ type: 'error', message: errorMessage(err) });
    }
  }

  private async dispatch(msg: ToWorker): Promise<void> {
    switch (msg.type) {
      case 'command':
        applyCommand(this.state, msg.cmd);
        this.postSnapshot();
        return;
      case 'request':
        await this.handleRequest(msg.reqId, msg.req);
        return;
      case 'devSkip':
        await this.catchUp(Math.max(0, msg.ms), 'devSkip');
        this.postSnapshot();
        return;
      case 'devSpeed':
        this.speed = Math.min(1000, Math.max(1, msg.speed));
        return;
      case 'devGive':
        if (msg.itemId) addItem(this.state, CONTENT.items.get(msg.itemId).id, msg.qty ?? 1);
        if (msg.gold) this.state.gold += msg.gold;
        this.postSnapshot();
        return;
    }
  }

  private async handleRequest(reqId: number, req: WorkerRequest): Promise<void> {
    const { saves, post, now } = this.deps;
    try {
      let data: unknown = null;
      switch (req.type) {
        case 'saveNow':
          await this.persist(now());
          break;
        case 'exportSave':
          data = encodeSave(this.state);
          break;
        case 'importSave': {
          const imported = decodeSave(req.data);
          await saves.backup(this.state, now()); // safety net before replacing
          this.replaceState(imported);
          await this.persist(now());
          break;
        }
        case 'listBackups':
          data = await saves.listBackups();
          break;
        case 'restoreBackup': {
          const restored = await saves.loadBackup(req.key);
          this.replaceState(restored);
          await this.persist(now());
          break;
        }
        case 'debugBundle':
          data = this.debugBundle();
          break;
        case 'reset':
          await saves.deleteAll();
          this.replaceState(createInitialState(this.deps.newSeed(), now()));
          this.lastBackup = now(); // don't immediately back up the empty new save
          await this.persist(now());
          break;
      }
      post({ type: 'response', reqId, ok: true, data });
    } catch (err) {
      post({ type: 'response', reqId, ok: false, error: errorMessage(err) });
    }
  }

  /** Swap in a loaded/imported state. Offline time inside it is NOT simulated (fresh start point). */
  private replaceState(next: GameState): void {
    next.lastRealTime = this.deps.now();
    this.state = next;
    this.postSnapshot();
  }

  private async catchUpOffline(): Promise<void> {
    const start = this.deps.now();
    const gap = Math.max(0, start - this.state.lastRealTime);
    if (gap > 0) await this.catchUp(gap, 'offline');
    this.state.lastRealTime = start;
  }

  /** Simulate `durationMs` of game time in chunks, yielding so the UI gets progress. */
  private async catchUp(durationMs: number, reason: 'offline' | 'devSkip'): Promise<void> {
    if (durationMs <= 0) return;
    const { post, now, yieldToEventLoop } = this.deps;
    this.busy = true;
    try {
      const before = takeSnapshot(this.state);
      const target = this.state.time + durationMs;
      const showProgress = durationMs >= AWAY_SUMMARY_MIN_MS;
      let lastYield = now();
      while (this.state.time < target) {
        advance(this.state, Math.min(target, this.state.time + CATCHUP_CHUNK_MS));
        if (now() - lastYield >= CATCHUP_YIELD_MS) {
          if (showProgress)
            post({ type: 'catchUpProgress', done: this.state.time - before.time, total: durationMs });
          await yieldToEventLoop();
          lastYield = now();
        }
      }
      if (showProgress) post({ type: 'catchUpDone' });
      if (durationMs >= AWAY_SUMMARY_MIN_MS || reason === 'devSkip')
        post({ type: 'awaySummary', summary: summarize(before, takeSnapshot(this.state)), reason });
    } finally {
      this.busy = false;
    }
    await this.drainQueue();
  }

  private async drainQueue(): Promise<void> {
    while (this.queue.length && !this.busy) await this.handle(this.queue.shift()!);
  }

  private async persist(now: number): Promise<void> {
    await this.deps.saves.save(this.state);
    this.lastAutosave = now;
    await this.maybeBackup(now);
  }

  private async maybeBackup(now: number): Promise<void> {
    if (now - this.lastBackup >= BACKUP_MS) {
      await this.deps.saves.backup(this.state, now);
      this.lastBackup = now;
    }
  }

  private debugBundle(): DebugBundle {
    const { build } = this.deps;
    return {
      game: 'atlas-of-ash',
      appVersion: build.appVersion,
      buildSha: build.buildSha,
      buildTime: build.buildTime,
      createdAt: new Date(this.deps.now()).toISOString(),
      saveVersion: SAVE_VERSION,
      seed: this.state.seed,
      save: encodeSave(this.state),
    };
  }

  private postSnapshot(): void {
    this.deps.post({ type: 'snapshot', state: this.state });
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
