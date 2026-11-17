import { applyCommand } from '../engine/commands';
import { CONTENT, SKILL_IDS } from '../engine/content';
import { addGold, addItem } from '../engine/economy/bank';
import { CharacterIndex, summarizeCharacter } from '../engine/save/characters';
import { decodeSave, encodeSave } from '../engine/save/codec';
import { SaveManager } from '../engine/save/saveManager';
import type { SaveStore } from '../engine/save/store';
import { advance } from '../engine/sim';
import { levelForXp, xpForLevel } from '../engine/skills/xp';
import { CHARACTER_MODES, createInitialState, SAVE_VERSION, type GameState } from '../engine/state';
import { summarize, takeSnapshot } from '../engine/summary';
import type { SimEvent } from '../engine/sim';
import type { DebugBundle, FromWorker, NewCharacter, ToWorker, WorkerRequest } from './protocol';

export const TICK_MS = 100;
/** A real-time gap larger than this is treated as offline time and caught up in chunks. */
export const OFFLINE_THRESHOLD_MS = 5_000;
/** Only show the away report for gaps at least this long. */
export const AWAY_SUMMARY_MIN_MS = 60_000;
export const AUTOSAVE_MS = 10_000;
export const BACKUP_MS = 10 * 60_000;
/** Sim time advanced per catch-up chunk before checking the wall clock. */
const CATCHUP_CHUNK_MS = 60_000;
/** Yield to the event loop (to post progress and receive messages) this often. */
const CATCHUP_YIELD_MS = 30;
const LEGACY_SLOT = 'default';

export interface HostDeps {
  store: SaveStore;
  now: () => number;
  post: (msg: FromWorker) => void;
  yieldToEventLoop: () => Promise<void>;
  newSeed: () => number;
  build: { appVersion: string; buildSha: string; buildTime: string };
}

/**
 * Owns the active character's GameState inside the Web Worker. Pure logic with
 * all I/O injected, so it is fully testable in Node. Each character is its own
 * save slot and catches up its own offline time when selected.
 */
export class GameHost {
  state: GameState | null = null;
  private saves: SaveManager | null = null;
  private readonly index: CharacterIndex;
  private ready = false;
  private busy = false;
  private queue: ToWorker[] = [];
  private speed = 1;
  private lastAutosave = 0;
  private lastBackup = 0;

  constructor(private readonly deps: HostDeps) {
    this.index = new CharacterIndex(deps.store);
  }

  async init(): Promise<void> {
    await this.adoptLegacySave();
    this.ready = true;
    this.deps.post({ type: 'ready', characters: await this.index.list() });
    await this.drainQueue();
  }

  /** Phase 0 kept a single save in slot "default"; list it as a character. */
  private async adoptLegacySave(): Promise<void> {
    if ((await this.index.list()).length > 0) return;
    try {
      const legacy = await new SaveManager(this.deps.store, LEGACY_SLOT).load();
      if (legacy) await this.index.upsert(summarizeCharacter(legacy, legacy.lastRealTime));
    } catch {
      // unreadable legacy save: ignore
    }
  }

  /** Called every TICK_MS by the worker's timer. */
  async tick(): Promise<void> {
    if (!this.ready || this.busy || !this.state) return;
    const now = this.deps.now();
    const elapsed = Math.max(0, now - this.state.lastRealTime);
    if (elapsed > OFFLINE_THRESHOLD_MS && this.speed === 1) {
      // Tab was suspended / machine slept: catch up properly with a report.
      await this.catchUpOffline();
    } else {
      advance(this.state, this.state.time + Math.round(elapsed * this.speed), {
        onEvent: (e) => this.recordEvent(e),
      });
      this.state.lastRealTime = now;
    }
    if (this.state && (await this.handleDeath())) return;
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
    if (msg.type === 'request') {
      await this.handleRequest(msg.reqId, msg.req);
      return;
    }
    const state = this.state;
    if (!state) return;
    switch (msg.type) {
      case 'devSkip':
        await this.catchUp(Math.max(0, msg.ms), 'devSkip');
        if (await this.handleDeath()) return;
        break;
      case 'devSpeed':
        this.speed = Math.min(1000, Math.max(1, msg.speed));
        return;
      case 'devGive':
        if (msg.itemId) addItem(state, CONTENT.items.get(msg.itemId).id, msg.qty ?? 1);
        if (msg.gold) addGold(state, msg.gold);
        if (msg.levels) {
          for (const id of SKILL_IDS) {
            const skill = state.skills[id];
            const target = Math.min(99, levelForXp(skill.xp) + msg.levels);
            skill.xp = Math.max(skill.xp, xpForLevel(target));
          }
        }
        break;
    }
    this.postSnapshot();
    await this.persist(this.deps.now());
  }

  private requireState(): GameState {
    if (!this.state) throw new Error('No character selected');
    return this.state;
  }

  private async handleRequest(reqId: number, req: WorkerRequest): Promise<void> {
    const { post, now } = this.deps;
    try {
      let data: unknown = null;
      switch (req.type) {
        case 'listCharacters':
          data = await this.index.list();
          break;
        case 'createCharacter':
          data = await this.createCharacter(req.character);
          break;
        case 'selectCharacter':
          await this.selectCharacter(req.id);
          break;
        case 'closeCharacter':
          await this.closeCharacter();
          break;
        case 'deleteCharacter':
          if (this.state?.character.id === req.id) await this.closeCharacter();
          await new SaveManager(this.deps.store, req.id).deleteAll();
          await this.index.remove(req.id);
          await this.postCharacters();
          break;
        case 'command':
          // Player decisions are saved immediately so a reload never forgets them.
          applyCommand(this.requireState(), req.cmd);
          this.postSnapshot();
          await this.persist(now());
          break;
        case 'saveNow':
          if (this.state) await this.persist(now());
          break;
        case 'exportSave':
          data = encodeSave(this.requireState());
          break;
        case 'importSave':
          data = await this.importAsNewCharacter(req.data);
          break;
        case 'listBackups':
          data = this.saves ? await this.saves.listBackups() : [];
          break;
        case 'restoreBackup': {
          if (!this.saves || !this.state) throw new Error('No character selected');
          const restored = await this.saves.loadBackup(req.key);
          await this.saves.backup(this.state, now()); // safety net before replacing
          restored.lastRealTime = now();
          this.state = restored;
          await this.persist(now());
          this.postSnapshot();
          break;
        }
        case 'debugBundle':
          data = this.debugBundle();
          break;
      }
      post({ type: 'response', reqId, ok: true, data });
    } catch (err) {
      post({ type: 'response', reqId, ok: false, error: errorMessage(err) });
    }
  }

  private newCharacterId(): string {
    return `c${this.deps.newSeed().toString(36)}${this.deps.now().toString(36)}`;
  }

  private async createCharacter(input: NewCharacter): Promise<string> {
    const name = input.name.trim().slice(0, 24);
    if (!name) throw new Error('Please enter a name');
    if (!CONTENT.classes.has(input.classId)) throw new Error('Unknown class');
    if (!CHARACTER_MODES.includes(input.mode)) throw new Error('Unknown mode');
    const seed = this.deps.newSeed();
    const id = this.newCharacterId();
    const state = createInitialState(seed, this.deps.now(), {
      id,
      name,
      classId: input.classId,
      mode: input.mode,
    });
    await new SaveManager(this.deps.store, id).save(state);
    await this.index.upsert(summarizeCharacter(state, this.deps.now()));
    await this.postCharacters();
    return id;
  }

  private async importAsNewCharacter(data: string): Promise<string> {
    const imported = decodeSave(data);
    const id = this.newCharacterId();
    imported.character = { ...imported.character, id, name: imported.character.name.slice(0, 24) };
    imported.lastRealTime = this.deps.now(); // don't simulate the time the string sat in a clipboard
    await new SaveManager(this.deps.store, id).save(imported);
    await this.index.upsert(summarizeCharacter(imported, this.deps.now()));
    await this.postCharacters();
    return id;
  }

  private async selectCharacter(id: string): Promise<void> {
    if (this.state) await this.closeCharacter();
    const saves = new SaveManager(this.deps.store, id);
    const loaded = await saves.load();
    if (!loaded) throw new Error('Character not found');
    loaded.character.id = id;
    this.saves = saves;
    this.state = loaded;
    this.log = [];
    const now = this.deps.now();
    this.lastBackup = (await saves.listBackups())[0]?.savedAt ?? 0;
    this.lastAutosave = now;
    this.speed = 1;
    await this.maybeBackup(now);
    this.postSnapshot();
    await this.catchUpOffline();
    await this.persist(this.deps.now());
    this.postSnapshot();
  }

  private async closeCharacter(): Promise<void> {
    if (this.state) await this.persist(this.deps.now());
    this.state = null;
    this.saves = null;
    this.postSnapshot();
    await this.postCharacters();
  }

  /** Recent combat events for the live log (not saved; not collected during catch-up). */
  private log: SimEvent[] = [];

  private recordEvent(e: SimEvent): void {
    if (
      !e.type.startsWith('combat') &&
      ![
        'death',
        'flaskUsed',
        'characterLevelUp',
        'autoBanked',
        'skillTriggered',
        'minionDied',
        'gemLevelUp',
      ].includes(e.type)
    )
      return;
    this.log.push(e);
    if (this.log.length > 60) this.log.splice(0, this.log.length - 60);
  }

  /** Mortal characters that died are deleted, leaving a memorial in the character list. */
  private async handleDeath(): Promise<boolean> {
    const state = this.state;
    if (!state?.dead || state.character.mode !== 'mortal') return false;
    const summary = summarizeCharacter(state, this.deps.now());
    await new SaveManager(this.deps.store, state.character.id).deleteAll();
    await this.index.upsert({
      ...summary,
      memorial: {
        cause: state.dead.cause,
        level: state.dead.level,
        at: this.deps.now(),
        playedMs: state.dead.at,
      },
    });
    this.deps.post({ type: 'characterDied', name: state.character.name, cause: state.dead.cause });
    this.state = null;
    this.saves = null;
    this.postSnapshot();
    await this.postCharacters();
    return true;
  }

  private async postCharacters(): Promise<void> {
    this.deps.post({ type: 'characters', characters: await this.index.list() });
  }

  private async catchUpOffline(): Promise<void> {
    if (!this.state) return;
    const start = this.deps.now();
    const gap = Math.max(0, start - this.state.lastRealTime);
    if (gap > 0) await this.catchUp(gap, 'offline');
    if (this.state) this.state.lastRealTime = start;
    await this.handleDeath();
  }

  /** Simulate `durationMs` of game time in chunks, yielding so the UI gets progress. */
  private async catchUp(durationMs: number, reason: 'offline' | 'devSkip'): Promise<void> {
    const state = this.state;
    if (!state || durationMs <= 0) return;
    const { post, now, yieldToEventLoop } = this.deps;
    this.busy = true;
    try {
      const before = takeSnapshot(state);
      const target = state.time + durationMs;
      const showProgress = durationMs >= AWAY_SUMMARY_MIN_MS;
      let lastYield = now();
      while (state.time < target) {
        advance(state, Math.min(target, state.time + CATCHUP_CHUNK_MS));
        if (now() - lastYield >= CATCHUP_YIELD_MS) {
          if (showProgress)
            post({ type: 'catchUpProgress', done: state.time - before.time, total: durationMs });
          await yieldToEventLoop();
          lastYield = now();
        }
      }
      if (showProgress) post({ type: 'catchUpDone' });
      if (durationMs >= AWAY_SUMMARY_MIN_MS || reason === 'devSkip')
        post({ type: 'awaySummary', summary: summarize(before, takeSnapshot(state)), reason });
    } finally {
      this.busy = false;
    }
    await this.drainQueue();
  }

  private async drainQueue(): Promise<void> {
    while (this.queue.length && !this.busy) await this.handle(this.queue.shift()!);
  }

  private async persist(now: number): Promise<void> {
    if (!this.state || !this.saves) return;
    await this.saves.save(this.state);
    await this.index.upsert(summarizeCharacter(this.state, now));
    this.lastAutosave = now;
    await this.maybeBackup(now);
  }

  private async maybeBackup(now: number): Promise<void> {
    if (!this.state || !this.saves) return;
    if (now - this.lastBackup >= BACKUP_MS) {
      await this.saves.backup(this.state, now);
      this.lastBackup = now;
    }
  }

  private debugBundle(): DebugBundle {
    const state = this.requireState();
    const { build } = this.deps;
    return {
      game: 'atlas-of-ash',
      appVersion: build.appVersion,
      buildSha: build.buildSha,
      buildTime: build.buildTime,
      createdAt: new Date(this.deps.now()).toISOString(),
      saveVersion: SAVE_VERSION,
      seed: state.seed,
      save: encodeSave(state),
    };
  }

  private postSnapshot(): void {
    this.deps.post({ type: 'snapshot', state: this.state, log: this.log });
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
