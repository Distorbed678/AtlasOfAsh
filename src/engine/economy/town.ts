import { CONTENT, type Content } from '../content';
import type { BuildingDef } from '../content/types';
import type { GameState } from '../state';

export function buildingTier(state: GameState, buildingId: string): number {
  return state.town[buildingId] ?? 0;
}

/** Current effect value of a building (its tier-0 value if unbuilt). */
export function buildingValue(
  state: GameState,
  buildingId: string,
  content: Content = CONTENT,
): number {
  const def = content.buildings.get(buildingId);
  return def.values[Math.min(buildingTier(state, buildingId), def.tiers.length)]!;
}

export function nextTierCost(state: GameState, def: BuildingDef) {
  return def.tiers[buildingTier(state, def.id)];
}

export function workerSlotCount(state: GameState, content: Content = CONTENT): number {
  return buildingValue(state, 'building.guild_hall', content);
}

export function workerEfficiency(state: GameState, content: Content = CONTENT): number {
  return buildingValue(state, 'building.workshop', content);
}

export function workerXpShare(state: GameState, content: Content = CONTENT): number {
  return buildingValue(state, 'building.training_yard', content);
}

/** Wage = this × the vendor value of the worker's output. 1.2 → 1.0 with Workshop tiers. */
export function wageMultiplier(state: GameState): number {
  return 1.2 - 0.04 * buildingTier(state, 'building.workshop');
}
