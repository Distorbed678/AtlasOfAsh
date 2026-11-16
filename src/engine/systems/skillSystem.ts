import { CONTENT } from '../content';
import { tryStartWorkerCycle } from '../economy/workers';
import { completeCycle, wagePerCycle } from '../skills/actions';
import type { System } from '../sim';

/**
 * Runs the player's action and every worker. All runners due at the same
 * time are resolved in one call (player first, then workers by slot), then
 * workers are paid for their next cycle, then paused workers resume if gold
 * is now available. This keeps ordering deterministic.
 */
export const skillSystem: System = {
  id: 'skills',

  nextEventTime(state) {
    let t = state.action ? state.action.nextAt : Infinity;
    for (const w of state.workers) {
      if (w.runner && w.runner.nextAt < t) t = w.runner.nextAt;
      else if (w.paused && w.actionId) {
        const def = CONTENT.actions.get(w.actionId);
        if (state.gold >= wagePerCycle(state, def)) t = Math.min(t, state.time);
      }
    }
    return t;
  },

  processEvent(state, ctx) {
    const t = state.time;
    if (state.action && state.action.nextAt === t) {
      completeCycle(state, state.action, { kind: 'player' }, ctx.emit, ctx.content);
    }
    const due: number[] = [];
    state.workers.forEach((w, slot) => {
      if (w.runner && w.runner.nextAt === t) {
        completeCycle(state, w.runner, { kind: 'worker', slot }, ctx.emit, ctx.content);
        due.push(slot);
      }
    });
    for (const slot of due) tryStartWorkerCycle(state, slot, t, ctx.content);
    state.workers.forEach((w, slot) => {
      if (w.paused && w.actionId) tryStartWorkerCycle(state, slot, t, ctx.content);
    });
  },
};
