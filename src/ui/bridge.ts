import { create } from 'zustand';
import type { Command } from '../engine/commands';
import { SKILL_IDS } from '../engine/content';
import { levelForXp } from '../engine/skills/xp';
import { characterLevel } from '../engine/combat/progression';
import { nameOf, t } from '../i18n';
import type { GameState } from '../engine/state';
import type { SimEvent } from '../engine/sim';
import type { ProgressSummary } from '../engine/summary';
import type { CharacterSummary, FromWorker, ToWorker, WorkerRequest } from '../worker/protocol';
import { toast } from './toasts';

/** UI-side mirror of the worker's game state (read-only snapshots). */
interface GameStore {
  ready: boolean;
  state: GameState | null;
  characters: CharacterSummary[];
  catchUp: { done: number; total: number } | null;
  away: { summary: ProgressSummary; reason: 'offline' | 'devSkip' } | null;
  workerError: string | null;
  /** Skills that just levelled up (drives a short sidebar flash). */
  levelFlash: Record<string, boolean>;
  /** Recent combat events from the worker (live play only). */
  log: SimEvent[];
  dismissAway(): void;
  dismissError(): void;
}

export const useGame = create<GameStore>((set) => ({
  ready: false,
  state: null,
  characters: [],
  catchUp: null,
  away: null,
  workerError: null,
  levelFlash: {},
  log: [],
  dismissAway: () => set({ away: null }),
  dismissError: () => set({ workerError: null }),
}));

/** Non-null game state for components that only render inside a selected character. */
export function useGameState<T>(selector: (s: GameState) => T): T {
  return useGame((g) => selector(g.state!));
}

let worker: Worker | null = null;
let nextReqId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function onMessage(msg: FromWorker): void {
  switch (msg.type) {
    case 'ready':
      useGame.setState({ ready: true, characters: msg.characters });
      return;
    case 'snapshot':
      announceLevelUps(useGame.getState().state, msg.state);
      useGame.setState({ state: msg.state, log: msg.log ?? [] });
      return;
    case 'characterDied':
      toast(t('combat.deadMortal', { name: msg.name, cause: nameOf(msg.cause) }), 'error', 10_000);
      return;
    case 'characters':
      useGame.setState({ characters: msg.characters });
      return;
    case 'catchUpProgress':
      useGame.setState({ catchUp: { done: msg.done, total: msg.total } });
      return;
    case 'catchUpDone':
      useGame.setState({ catchUp: null });
      return;
    case 'awaySummary':
      useGame.setState({ away: { summary: msg.summary, reason: msg.reason }, catchUp: null });
      return;
    case 'response': {
      const p = pending.get(msg.reqId);
      if (!p) return;
      pending.delete(msg.reqId);
      if (msg.ok) p.resolve(msg.data);
      else p.reject(new Error(msg.error));
      return;
    }
    case 'error':
      useGame.setState({ workerError: msg.message });
      return;
  }
}

/** Toast level-ups that happen during live play (catch-up gains go in the away report). */
function announceLevelUps(prev: GameState | null, next: GameState | null): void {
  const g = useGame.getState();
  if (!prev || !next || prev.character.id !== next.character.id || g.away || g.catchUp) return;
  const flash = { ...g.levelFlash };
  let changed = false;
  for (const id of SKILL_IDS) {
    const before = levelForXp(prev.skills[id].xp);
    const after = levelForXp(next.skills[id].xp);
    if (after > before) {
      toast(t('skill.levelUp', { skill: nameOf(id), level: after }), 'success');
      flash[id] = true;
      changed = true;
      setTimeout(() => {
        const { [id]: _done, ...rest } = useGame.getState().levelFlash;
        useGame.setState({ levelFlash: rest });
      }, 2500);
    }
  }
  if (changed) useGame.setState({ levelFlash: flash });
  const lvBefore = characterLevel(prev.charXp);
  const lvAfter = characterLevel(next.charXp);
  if (lvAfter > lvBefore) toast(t('combat.log.level', { n: lvAfter }), 'success');
  if (next.stats.deaths > prev.stats.deaths)
    toast(t('combat.dead', { name: next.character.name }), 'error', 8000);
}

export function startGame(): void {
  if (worker) return;
  worker = new Worker(new URL('../worker/game.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<FromWorker>) => onMessage(e.data);
  worker.onerror = (e) => useGame.setState({ workerError: e.message || 'Game worker crashed' });

  // Save whenever the page is hidden or closed (best effort).
  const saveNow = () => void request({ type: 'saveNow' }).catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('pagehide', saveNow);
}

export function send(msg: ToWorker): void {
  worker?.postMessage(msg);
}

export function request<T = unknown>(req: WorkerRequest): Promise<T> {
  if (!worker) return Promise.reject(new Error('Game is not running'));
  const reqId = nextReqId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(reqId, { resolve: resolve as (v: unknown) => void, reject });
    send({ type: 'request', reqId, req });
  });
}

/** Send a player command; failures (e.g. "Level too low") show as a toast. */
export function command(cmd: Command): Promise<boolean> {
  return request({ type: 'command', cmd }).then(
    () => true,
    (err: Error) => {
      toast(err.message, 'error');
      return false;
    },
  );
}
