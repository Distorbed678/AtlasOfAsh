/**
 * Classic idle-game exponential XP curve (each level ≈ 10% more XP).
 * Level 99 ≈ 13.03M XP; half of that is reached around level 92.
 * The table extends to 120 for post-99 content (Phase 9).
 */
export const MAX_SKILL_LEVEL = 99;
export const MAX_MASTERY_LEVEL = 99;
export const XP_TABLE_MAX_LEVEL = 120;

const XP_TABLE: number[] = (() => {
  const table = [0, 0]; // index = level; level 1 needs 0 XP
  let points = 0;
  for (let lvl = 1; lvl < XP_TABLE_MAX_LEVEL; lvl++) {
    points += Math.floor(lvl + 300 * 2 ** (lvl / 7));
    table.push(Math.floor(points / 4));
  }
  return table;
})();

/** Total XP required to reach `level`. */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.min(XP_TABLE_MAX_LEVEL, Math.floor(level)));
  return XP_TABLE[l]!;
}

/** Level for a total XP amount, capped at `cap`. */
export function levelForXp(xp: number, cap = MAX_SKILL_LEVEL): number {
  let lo = 1;
  let hi = Math.min(cap, XP_TABLE_MAX_LEVEL);
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (XP_TABLE[mid]! <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface LevelProgress {
  level: number;
  /** XP into the current level. */
  current: number;
  /** XP needed for the whole current level (0 at cap). */
  needed: number;
  fraction: number;
  atCap: boolean;
}

export function levelProgress(xp: number, cap = MAX_SKILL_LEVEL): LevelProgress {
  const level = levelForXp(xp, cap);
  if (level >= cap) return { level, current: 0, needed: 0, fraction: 1, atCap: true };
  const start = xpForLevel(level);
  const needed = xpForLevel(level + 1) - start;
  const current = xp - start;
  return { level, current, needed, fraction: current / needed, atCap: false };
}
