/** Core combat formulas (Phase 2 decisions, PLAN §1.9). Pure functions. */

export const MIN_HIT_CHANCE = 0.05;
export const ARMOUR_HIT_FACTOR = 10;
export const MAX_ARMOUR_REDUCTION = 0.9;
export const BASE_MAX_RESIST = 75;
export const HARD_MAX_RESIST = 90;
export const RESIST_PENALTY_PER_ACT = 10;
export const BASE_MAX_BLOCK = 50;
export const HARD_MAX_BLOCK = 75;
export const BASE_CRIT_BONUS = 100;
export const ES_RECHARGE_DELAY_S = 4;
export const ES_RECHARGE_PCT_PER_S = 12.5;
export const BASE_LIFE_REGEN_PCT = 1;
export const BASE_MANA_REGEN_PCT = 2;
export const BASE_LEECH_CAP_PCT = 20;
export const LEECH_DURATION_S = 1;
export const ACCURACY_PER_LEVEL = 6;
export const ACCURACY_PER_DEX = 5;
export const LIFE_PER_5_STR = 2;
export const MANA_PER_5_INT = 2;

/** Chance for an attack to hit: 1.2 × acc / (acc + eva / 4), clamped to [5%, 100%]. */
export function hitChance(accuracy: number, evasion: number): number {
  if (evasion <= 0) return 1;
  if (accuracy <= 0) return MIN_HIT_CHANCE;
  const raw = (1.2 * accuracy) / (accuracy + evasion / 4);
  return Math.min(1, Math.max(MIN_HIT_CHANCE, raw));
}

/** Physical damage reduction from armour for a single hit (hit-size scaling). */
export function armourReduction(armour: number, hit: number): number {
  if (armour <= 0 || hit <= 0) return armour > 0 ? MAX_ARMOUR_REDUCTION : 0;
  return Math.min(MAX_ARMOUR_REDUCTION, armour / (armour + ARMOUR_HIT_FACTOR * hit));
}

/** Physical damage actually taken from a hit after armour. */
export function physAfterArmour(armour: number, hit: number): number {
  return hit * (1 - armourReduction(armour, hit));
}

/**
 * Largest physical hit survivable with `pool` life+ES and `armour`.
 * Solves 10h² / (A + 10h) = pool (or 0.1h = pool while the 90% cap applies).
 */
export function maxPhysHit(pool: number, armour: number): number {
  if (armour <= 0) return pool;
  const capped = pool / (1 - MAX_ARMOUR_REDUCTION);
  // The 90% cap applies while A/(A+10h) ≥ 0.9  ⇔  h ≤ A/90.
  if (capped <= armour / 90) return capped;
  const k = ARMOUR_HIT_FACTOR;
  return (k * pool + Math.sqrt(k * k * pool * pool + 4 * k * pool * armour)) / (2 * k);
}

/**
 * Deterministic hit resolution (entropy): accumulate the chance each attempt
 * and register a hit whenever the total crosses 1. Over N attempts exactly
 * ~N × chance hits occur, without streaks. Returns [hit, newEntropy].
 */
export function rollEntropy(entropy: number, chance: number): [boolean, number] {
  const next = entropy + chance;
  return next >= 1 ? [true, next - 1] : [false, next];
}
