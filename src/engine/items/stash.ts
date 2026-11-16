import type { EquipSlot } from '../content/types';
import { STASH_TAB_SIZE, type GameState, type StashTab } from '../state';
import type { ItemInstance } from './types';

/** Gold cost of the next stash tab (the first tab is free). */
export const STASH_TAB_COSTS = [
  1_000, 5_000, 20_000, 80_000, 300_000, 1_000_000, 3_000_000, 8_000_000, 20_000_000,
];
export const MAX_STASH_TABS = STASH_TAB_COSTS.length + 1;

export function nextTabCost(state: GameState): number | null {
  return STASH_TAB_COSTS[state.stash.tabs.length - 1] ?? null;
}

export function stashFree(state: GameState): number {
  return state.stash.tabs.reduce((s, t) => s + (STASH_TAB_SIZE - t.items.length), 0);
}

/** Put an item in the first tab with room (or `preferTab`). Returns false if the stash is full. */
export function addToStash(state: GameState, item: ItemInstance, preferTab?: number): boolean {
  const tabs = [...state.stash.tabs];
  if (preferTab !== undefined)
    tabs.sort((a, b) => (a.id === preferTab ? -1 : b.id === preferTab ? 1 : 0));
  const tab = tabs.find((t) => t.items.length < STASH_TAB_SIZE);
  if (!tab) return false;
  tab.items.push(item);
  return true;
}

export type ItemLocation =
  | { where: 'stash'; tab: StashTab; index: number; item: ItemInstance }
  | { where: 'equipment'; slot: EquipSlot; item: ItemInstance };

export function findItem(state: GameState, uid: number): ItemLocation | null {
  for (const tab of state.stash.tabs) {
    const index = tab.items.findIndex((i) => i.uid === uid);
    if (index >= 0) return { where: 'stash', tab, index, item: tab.items[index]! };
  }
  for (const [slot, item] of Object.entries(state.equipment)) {
    if (item?.uid === uid) return { where: 'equipment', slot: slot as EquipSlot, item };
  }
  return null;
}

export function takeFromStash(state: GameState, uid: number): ItemInstance | null {
  const loc = findItem(state, uid);
  if (!loc || loc.where !== 'stash') return null;
  loc.tab.items.splice(loc.index, 1);
  return loc.item;
}

export function allocateUid(state: GameState): number {
  return state.nextItemUid++;
}
