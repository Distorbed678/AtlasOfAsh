import { levelForXp, xpForLevel } from '../skills/xp';

/** Character levels 1–100 use the same exponential curve as skills (90→100 ≈ 1.7× of 1→90). */
export const MAX_CHARACTER_LEVEL = 100;

export function characterLevel(xp: number): number {
  return levelForXp(xp, MAX_CHARACTER_LEVEL);
}

export function characterXpForLevel(level: number): number {
  return xpForLevel(level);
}

/** XP for killing a normal monster of this level (no level-difference penalty). Provisional; tuned in Phase 7. */
export function monsterXp(level: number): number {
  return 5 * 1.09 ** level * (1 + level / 20);
}

/** Softcore death: lose 10% of the current level's XP span, never dropping a level. */
export function xpAfterDeath(xp: number): number {
  const level = characterLevel(xp);
  if (level >= MAX_CHARACTER_LEVEL) return xp;
  const start = characterXpForLevel(level);
  const span = characterXpForLevel(level + 1) - start;
  return Math.max(start, xp - span * 0.1);
}
