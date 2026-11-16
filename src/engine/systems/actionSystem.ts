import { Rng } from '../core/rng';
import type { System } from '../sim';
import { addItem } from '../state';

/** Runs the player's single active timed action (one action at a time). */
export const actionSystem: System = {
  id: 'action',

  nextEventTime(state) {
    return state.action ? state.action.nextAt : Infinity;
  },

  processEvent(state, ctx) {
    const action = state.action;
    if (!action) return;
    const def = ctx.content.actions.get(action.actionId);
    const rng = new Rng(state.rng.action);

    for (const out of def.outputs) {
      if (out.chance !== undefined && !rng.chance(out.chance)) continue;
      const qty = out.min === out.max ? out.min : rng.int(out.min, out.max);
      addItem(state, out.itemId, qty);
      ctx.emit({ type: 'itemGained', itemId: out.itemId, qty, time: state.time });
    }

    state.stats.actionsCompleted++;
    ctx.emit({ type: 'actionComplete', actionId: def.id, time: state.time });

    // Absolute scheduling: the next cycle starts exactly when this one ended.
    action.startedAt = action.nextAt;
    action.nextAt += def.durationMs;
  },
};
