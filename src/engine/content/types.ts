/**
 * Content definitions. Every def has a permanent `id` (see registry.ts).
 * Display names come from i18n using the id as the key.
 */

export type ItemCategory =
  'ore' | 'log' | 'herb' | 'fish' | 'gem' | 'seed' | 'container' | 'valuable' | 'junk';

export interface WeightedItem {
  readonly itemId: string;
  readonly weight: number;
  readonly min: number;
  readonly max: number;
}

/** Contents of an openable container item. */
export interface ContainerLoot {
  readonly gold: readonly [number, number];
  /** Number of item rolls from `items`. */
  readonly rolls: number;
  readonly items: readonly WeightedItem[];
}

export interface ItemDef {
  readonly id: string;
  readonly category: ItemCategory;
  readonly tier: number;
  readonly sellPrice: number;
  readonly container?: ContainerLoot;
}

export type SkillId =
  'skill.mining' | 'skill.woodcutting' | 'skill.herbalism' | 'skill.fishing' | 'skill.thieving';

export interface RareFind {
  readonly itemId: string;
  /** Chance per completed action (0..1). */
  readonly chance: number;
}

export interface SkillDef {
  readonly id: SkillId;
  readonly kind: 'gathering' | 'thieving';
  /** Rolled after every completed action of this skill. */
  readonly rareFinds: readonly RareFind[];
}

interface ActionBase {
  readonly id: string;
  readonly skillId: SkillId;
  readonly tier: number;
  readonly level: number;
  readonly durationMs: number;
  readonly xp: number;
}

/** Fixed output, e.g. woodcutting a tree. */
export interface SimpleAction extends ActionBase {
  readonly type: 'simple';
  readonly itemId: string;
  readonly qty: number;
}

/** Mining: the rock holds limited ore, then respawns. */
export interface RockAction extends ActionBase {
  readonly type: 'rock';
  readonly itemId: string;
  readonly qty: number;
  readonly rockHp: number;
  readonly respawnMs: number;
}

/** Fishing: each catch is one weighted pick from the spot's table. */
export interface CatchAction extends ActionBase {
  readonly type: 'catch';
  readonly table: readonly WeightedItem[];
}

/** Herbalism: each gather picks `picks` herbs from the patch's table. */
export interface BundleAction extends ActionBase {
  readonly type: 'bundle';
  readonly picks: readonly [number, number];
  readonly table: readonly WeightedItem[];
}

/** Thieving: success vs the target's perception, otherwise a stun. */
export interface ThieveAction extends ActionBase {
  readonly type: 'thieve';
  readonly perception: number;
  readonly gold: readonly [number, number];
  readonly rares: readonly RareFind[];
}

export type ActionDef = SimpleAction | RockAction | CatchAction | BundleAction | ThieveAction;

export type Attribute = 'str' | 'dex' | 'int';

/** Class starting stats at level 1 and growth per level. */
export interface ClassBase {
  readonly life: number;
  readonly lifePerLevel: number;
  readonly mana: number;
  readonly manaPerLevel: number;
  readonly spirit: number;
  readonly energyShield: number;
}

export interface ClassDef {
  readonly id: string;
  readonly base: ClassBase;
  readonly attributes: readonly Attribute[];
  /** Ids of the two favoured weapon types (weapon content arrives in Phase 3). */
  readonly weapons: readonly [string, string];
}

export interface BuildingTier {
  readonly gold: number;
  readonly items: Readonly<Record<string, number>>;
}

export type BuildingEffect = 'workerSlots' | 'workerEfficiency' | 'workerXpShare' | 'bankSlots';

export interface BuildingDef {
  readonly id: string;
  readonly effect: BuildingEffect;
  /** Effect value at tier 0 (unbuilt), then at each tier. `values.length === tiers.length + 1`. */
  readonly values: readonly number[];
  /** Cost of reaching tier 1, 2, … */
  readonly tiers: readonly BuildingTier[];
}
