import { CONTENT, type Content } from '../content';
import { cycleDuration, startRunner, wagePerCycle } from '../skills/actions';
import type { GameState, WorkerSlot } from '../state';
import { workerSlotCount } from './town';

/** Make sure `state.workers` has exactly as many slots as the Guild Hall allows. */
export function syncWorkerSlots(state: GameState, content: Content = CONTENT): void {
  const count = workerSlotCount(state, content);
  while (state.workers.length < count)
    state.workers.push({ actionId: null, runner: null, paused: false });
}

/**
 * Try to pay for and begin a new cycle for an assigned worker at `at`.
 * If gold is short the worker pauses (and resumes automatically once gold arrives).
 */
export function tryStartWorkerCycle(
  state: GameState,
  slot: number,
  at: number,
  content: Content = CONTENT,
): void {
  const w = state.workers[slot]!;
  if (!w.actionId) return;
  const def = content.actions.get(w.actionId);
  const wage = wagePerCycle(state, def, content);
  if (state.gold < wage) {
    w.paused = true;
    w.runner = null;
    return;
  }
  state.gold -= wage;
  state.stats.wagesPaid += wage;
  const prev = w.runner;
  const runner =
    prev && prev.actionId === def.id
      ? prev
      : startRunner(state, def, { kind: 'worker', slot }, at, content);
  if (runner === prev) {
    // Continuing: the next cycle was already scheduled by completeCycle; recompute with
    // the current efficiency in case the Workshop was upgraded mid-cycle.
    runner.nextAt = runner.startedAt + cycleDuration(state, def, { kind: 'worker', slot }, content);
  }
  runner.paid = wage;
  w.runner = runner;
  w.paused = false;
}

/** Refund the unworked part of the current cycle when a worker is reassigned or dismissed. */
export function refundWorker(state: GameState, w: WorkerSlot): void {
  const r = w.runner;
  if (!r || !r.paid) return;
  const total = r.nextAt - r.startedAt;
  const remaining = Math.min(total, Math.max(0, r.nextAt - Math.max(state.time, r.startedAt)));
  const refund = total > 0 ? Math.floor((r.paid * remaining) / total) : 0;
  state.gold += refund;
  state.stats.wagesPaid -= refund;
}
