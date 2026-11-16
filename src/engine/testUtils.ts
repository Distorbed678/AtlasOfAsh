import { CONTENT } from './content';
import type { SkillId } from './content/types';
import { xpForLevel } from './skills/xp';
import { createInitialState, type GameState } from './state';

export const HOUR = 3_600_000;

export function newState(seed = 42): GameState {
  return createInitialState(seed, 0);
}

export function setLevel(state: GameState, skillId: SkillId, level: number): void {
  state.skills[skillId].xp = xpForLevel(level);
}

export function action(id: string) {
  return CONTENT.actions.get(id);
}
