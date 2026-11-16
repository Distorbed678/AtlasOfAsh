export type Rarity = 'normal' | 'magic' | 'rare' | 'unique';

/** A rolled affix: which affix, which tier (index into its tiers, 0 = worst) and the rolled values. */
export interface RolledMod {
  affixId: string;
  tierIndex: number;
  values: number[];
}

/** One concrete piece of equipment. Lives in a stash tab or an equipment slot. */
export interface ItemInstance {
  uid: number;
  baseId: string;
  rarity: Rarity;
  ilvl: number;
  prefixes: RolledMod[];
  suffixes: RolledMod[];
  /** Rolled lines of a unique (same order as the unique's definition). */
  uniqueId?: string;
  uniqueValues?: number[];
  /** Ashen Brand result: final, can no longer be modified. */
  ashen?: boolean;
  ashenImplicits?: RolledMod[];
  /** Generated name for rares, e.g. ["Grim", "Clasp"]. */
  name?: [string, string];
}

export const AFFIX_LIMITS: Record<Rarity, number> = { normal: 0, magic: 1, rare: 3, unique: 0 };
