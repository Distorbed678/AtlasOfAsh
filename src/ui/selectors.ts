import { CONTENT } from '../engine/content';
import { wagePerHour } from '../engine/skills/actions';
import type { GameState } from '../engine/state';

/** Gold per hour currently owed to all assigned workers. */
export function totalWagePerHour(state: GameState): number {
  return state.workers.reduce((sum, w) => {
    if (!w.actionId) return sum;
    return sum + wagePerHour(state, CONTENT.actions.get(w.actionId));
  }, 0);
}
