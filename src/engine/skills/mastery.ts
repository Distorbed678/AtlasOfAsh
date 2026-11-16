import { actionsForSkill, CONTENT, type Content } from '../content';
import type { ActionDef, SkillId } from '../content/types';
import type { GameState } from '../state';
import { levelForXp, MAX_MASTERY_LEVEL, xpForLevel } from './xp';

/** Mastery XP per second of base action time. */
export const MASTERY_XP_PER_SECOND = 20;
/** Share of mastery XP that also flows into the skill's pool. */
export const POOL_SHARE = 0.25;
/** Pool capacity per action in the skill. */
export const POOL_CAP_PER_ACTION = 500_000;
export const POOL_THRESHOLDS = [0.1, 0.25, 0.5, 0.95] as const;

export function masteryXpPerAction(def: ActionDef): number {
  return Math.round((def.durationMs / 1000) * MASTERY_XP_PER_SECOND);
}

export function masteryLevel(state: GameState, def: ActionDef): number {
  return levelForXp(state.skills[def.skillId].mastery[def.id] ?? 0, MAX_MASTERY_LEVEL);
}

export function poolCap(skillId: SkillId, content: Content = CONTENT): number {
  return POOL_CAP_PER_ACTION * actionsForSkill(skillId, content).length;
}

export function poolFraction(
  state: GameState,
  skillId: SkillId,
  content: Content = CONTENT,
): number {
  return Math.min(1, state.skills[skillId].pool / poolCap(skillId, content));
}

/** Pool bonuses reached: [10%, 25%, 50%, 95%]. */
export function poolTiers(
  state: GameState,
  skillId: SkillId,
  content: Content = CONTENT,
): boolean[] {
  const f = poolFraction(state, skillId, content);
  return POOL_THRESHOLDS.map((t) => f >= t);
}

/** Everything mastery changes about an action, for the player. */
export interface ActionModifiers {
  durationMult: number;
  doubleChance: number;
  rockHpBonus: number;
  stealth: number;
  skillXpMult: number;
  masteryXpMult: number;
}

export const NO_MODIFIERS: ActionModifiers = {
  durationMult: 1,
  doubleChance: 0,
  rockHpBonus: 0,
  stealth: 0,
  skillXpMult: 1,
  masteryXpMult: 1,
};

export function playerModifiers(
  state: GameState,
  def: ActionDef,
  skillLevel: number,
  content: Content = CONTENT,
): ActionModifiers {
  const mlvl = masteryLevel(state, def);
  const [p10, p25, p50, p95] = poolTiers(state, def.skillId, content);
  const isThieving = def.type === 'thieve';
  return {
    durationMult: 1 - Math.floor(mlvl / 10) * 0.01 - (p50 ? 0.05 : 0),
    doubleChance: isThieving ? 0 : Math.floor(mlvl / 10) * 0.02 + (p95 ? 0.1 : 0),
    rockHpBonus: Math.floor(mlvl / 5),
    stealth: skillLevel + Math.floor(mlvl / 2) + 10 + (isThieving && p95 ? 10 : 0),
    skillXpMult: p25 ? 1.05 : 1,
    masteryXpMult: p10 ? 1.05 : 1,
  };
}

/** Workers get no mastery bonuses; stealth comes from the player's skill level only. */
export function workerModifiers(skillLevel: number): ActionModifiers {
  return { ...NO_MODIFIERS, stealth: skillLevel + 10 };
}

export function thievingSuccessChance(stealth: number, perception: number): number {
  return Math.min(0.95, Math.max(0.05, 0.7 + (stealth - perception) * 0.01));
}

/** Pool XP needed to raise this action's mastery by one level (null at cap). */
export function poolCostForNextMastery(state: GameState, def: ActionDef): number | null {
  const lvl = masteryLevel(state, def);
  if (lvl >= MAX_MASTERY_LEVEL) return null;
  return xpForLevel(lvl + 1) - (state.skills[def.skillId].mastery[def.id] ?? 0);
}
