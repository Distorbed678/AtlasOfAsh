import { create } from 'zustand';
import { CONTENT } from '../engine/content';
import type { ItemInstance } from '../engine/items/types';
import { nameOf } from '../i18n';

/** Display name of an item instance. */
export function itemName(item: ItemInstance): string {
  if (item.uniqueId) return nameOf(item.uniqueId);
  if (item.rarity === 'rare' && item.name) return item.name.join(' ');
  return nameOf(item.baseId);
}

export function baseIcon(item: ItemInstance): string {
  return `class.${CONTENT.bases.get(item.baseId).class}`;
}

/** Tier label shown to players: T1 is the best tier. */
export function tierLabel(affixId: string, tierIndex: number): string {
  const total = CONTENT.affixes.get(affixId).tiers.length;
  return `T${total - tierIndex}`;
}

/** Shared UI selection (e.g. Stash → Enchant). */
interface SelectionStore {
  itemUid: number | null;
  select(uid: number | null): void;
}

export const useSelection = create<SelectionStore>((set) => ({
  itemUid: null,
  select: (itemUid) => set({ itemUid }),
}));
