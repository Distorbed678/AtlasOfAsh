import { CONTENT, type Content } from '../content';
import { buildingValue } from './town';
import type { GameState } from '../state';

export function bankCapacity(state: GameState, content: Content = CONTENT): number {
  return buildingValue(state, 'building.vault', content);
}

export function bankSlotsUsed(state: GameState): number {
  return Object.keys(state.bank.items).length;
}

/**
 * Add items to the bank. A brand-new item type needs a free slot; if the bank
 * is full the items are discarded (existing stacks always grow).
 * Returns the quantity actually added.
 */
export function addItem(
  state: GameState,
  itemId: string,
  qty: number,
  content: Content = CONTENT,
): number {
  if (qty <= 0) return 0;
  const bank = state.bank.items;
  if (bank[itemId] === undefined && bankSlotsUsed(state) >= bankCapacity(state, content)) {
    state.stats.itemsDiscarded += qty;
    return 0;
  }
  bank[itemId] = (bank[itemId] ?? 0) + qty;
  return qty;
}

export function removeItem(state: GameState, itemId: string, qty: number): void {
  const owned = state.bank.items[itemId] ?? 0;
  if (qty > owned) throw new Error(`Not enough ${itemId} (${owned} < ${qty})`);
  if (owned === qty) delete state.bank.items[itemId];
  else state.bank.items[itemId] = owned - qty;
}

export function hasItems(state: GameState, items: Readonly<Record<string, number>>): boolean {
  return Object.entries(items).every(([id, qty]) => (state.bank.items[id] ?? 0) >= qty);
}

export function isLocked(state: GameState, itemId: string): boolean {
  return state.bank.locked.includes(itemId);
}

export function addGold(state: GameState, amount: number): void {
  state.gold += amount;
  if (amount > 0) state.stats.goldEarned += amount;
}
