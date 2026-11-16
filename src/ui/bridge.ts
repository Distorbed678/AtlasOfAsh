import { create } from 'zustand';
import type { Command } from '../engine/commands';
import type { GameState } from '../engine/state';
import type { ProgressSummary } from '../engine/summary';
import type { FromWorker, ToWorker, WorkerRequest } from '../worker/protocol';

/** UI-side mirror of the worker's game state (read-only snapshots). */
interface GameStore {
  state: GameState | null;
  catchUp: { done: number; total: number } | null;
  away: { summary: ProgressSummary; reason: 'offline' | 'devSkip' } | null;
  workerError: string | null;
  dismissAway(): void;
  dismissError(): void;
}

export const useGame = create<GameStore>((set) => ({
  state: null,
  catchUp: null,
  away: null,
  workerError: null,
  dismissAway: () => set({ away: null }),
  dismissError: () => set({ workerError: null }),
}));

let worker: Worker | null = null;
let nextReqId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function onMessage(msg: FromWorker): void {
  switch (msg.type) {
    case 'snapshot':
      useGame.setState({ state: msg.state });
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
    case 'ready':
      return;
  }
}

export function startGame(): void {
  if (worker) return;
  worker = new Worker(new URL('../worker/game.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<FromWorker>) => onMessage(e.data);
  worker.onerror = (e) => useGame.setState({ workerError: e.message || 'Game worker crashed' });

  // Save whenever the page is hidden or closed (best effort).
  const saveOnHide = () => {
    if (document.visibilityState === 'hidden') void request({ type: 'saveNow' }).catch(() => {});
  };
  document.addEventListener('visibilitychange', saveOnHide);
  window.addEventListener('pagehide', () => void request({ type: 'saveNow' }).catch(() => {}));
}

export function send(msg: ToWorker): void {
  worker?.postMessage(msg);
}

export function command(cmd: Command): void {
  send({ type: 'command', cmd });
}

export function request<T = unknown>(req: WorkerRequest): Promise<T> {
  if (!worker) return Promise.reject(new Error('Game is not running'));
  const reqId = nextReqId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(reqId, { resolve: resolve as (v: unknown) => void, reject });
    send({ type: 'request', reqId, req });
  });
}
