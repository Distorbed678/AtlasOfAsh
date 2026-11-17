/**
 * Content definitions. Every def has a permanent `id` (see registry.ts).
 * Display names come from i18n using the id as the key.
 */
import type { Mod, StatId } from '../stats/types';

export type ItemCategory =
  | 'ore'
  | 'log'
  | 'herb'
  | 'fish'
  | 'gem'
  | 'seed'
  | 'container'
  | 'valuable'
  | 'junk'
  | 'fibre'
  | 'hide'
  | 'bar'
  | 'plank'
  | 'cloth'
  | 'leather'
  | 'dust'
  | 'reagent';

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
  | 'skill.mining'
  | 'skill.woodcutting'
  | 'skill.herbalism'
  | 'skill.fishing'
  | 'skill.thieving'
  | 'skill.smithing'
  | 'skill.woodworking'
  | 'skill.tailoring'
  | 'skill.jewelcrafting'
  | 'skill.enchanting'
  | 'skill.alchemy';

export interface RareFind {
  readonly itemId: string;
  /** Chance per completed action (0..1). */
  readonly chance: number;
}

export interface SkillDef {
  readonly id: SkillId;
  readonly kind: 'gathering' | 'thieving' | 'artisan';
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

export type CraftOutput =
  | { readonly kind: 'item'; readonly itemId: string; readonly qty: number }
  | { readonly kind: 'gear'; readonly baseId: string }
  | { readonly kind: 'unique'; readonly uniqueId: string };

/** Artisan skills: consume inputs, produce stackable items or gear. */
export interface CraftAction extends ActionBase {
  readonly type: 'craft';
  /** UI grouping, e.g. 'bars', 'weapons', 'armour'. */
  readonly group: string;
  readonly inputs: Readonly<Record<string, number>>;
  readonly output: CraftOutput;
}

export type ActionDef =
  SimpleAction | RockAction | CatchAction | BundleAction | ThieveAction | CraftAction;

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
  /** Ids of the two favoured weapon types. */
  readonly weapons: readonly [string, string];
}

export interface BuildingTier {
  readonly gold: number;
  readonly items: Readonly<Record<string, number>>;
}

export type BuildingEffect =
  'workerSlots' | 'workerEfficiency' | 'workerXpShare' | 'bankSlots' | 'autoBankMinutes';

export interface BuildingDef {
  readonly id: string;
  readonly effect: BuildingEffect;
  /** Effect value at tier 0 (unbuilt), then at each tier. `values.length === tiers.length + 1`. */
  readonly values: readonly number[];
  /** Cost of reaching tier 1, 2, … */
  readonly tiers: readonly BuildingTier[];
}

// ---------------------------------------------------------------- Equipment

export type EquipSlot =
  | 'mainHand'
  | 'offHand'
  | 'helmet'
  | 'body'
  | 'gloves'
  | 'boots'
  | 'belt'
  | 'amulet'
  | 'ring1'
  | 'ring2'
  | 'flask1'
  | 'flask2'
  | 'flask3'
  | 'flask4'
  | 'flask5';

export const EQUIP_SLOTS: readonly EquipSlot[] = [
  'mainHand',
  'offHand',
  'helmet',
  'body',
  'gloves',
  'boots',
  'belt',
  'amulet',
  'ring1',
  'ring2',
  'flask1',
  'flask2',
  'flask3',
  'flask4',
  'flask5',
];

export const FLASK_SLOTS = ['flask1', 'flask2', 'flask3', 'flask4', 'flask5'] as const;
export type FlaskSlot = (typeof FLASK_SLOTS)[number];

export type WeaponClass =
  | 'mace'
  | 'axe'
  | 'sword'
  | 'dagger'
  | 'claw'
  | 'flail'
  | 'sceptre'
  | 'bow'
  | 'crossbow'
  | 'staff'
  | 'quarterstaff'
  | 'wand';

export type BaseClass =
  | WeaponClass
  | 'shield'
  | 'quiver'
  | 'focus'
  | 'helmet'
  | 'body'
  | 'gloves'
  | 'boots'
  | 'belt'
  | 'ring'
  | 'amulet'
  | 'flask';

/** Defence profile of an armour piece: pure or hybrid. */
export type DefenceType = 'ar' | 'ev' | 'es' | 'ar_ev' | 'ar_es' | 'ev_es';

/** A modifier template on a base or unique (fixed value). */
export interface ModTemplate {
  readonly stat: StatId;
  readonly kind: Mod['kind'];
  readonly value: number;
  readonly tags?: readonly string[];
}

export type FlaskKind = 'life' | 'mana' | 'granite' | 'swiftness' | 'warding' | 'cleansing';

export interface FlaskStats {
  readonly kind: FlaskKind;
  /** Life/mana recovered over the duration, or the effect's strength for utility flasks. */
  readonly amount: number;
  readonly durationMs: number;
  readonly maxCharges: number;
  readonly chargesPerUse: number;
}

export interface BaseItemDef {
  readonly id: string;
  readonly class: BaseClass;
  readonly tier: number;
  /** Character level needed to equip. */
  readonly levelReq: number;
  readonly flask?: FlaskStats;
  readonly twoHanded?: boolean;
  readonly weapon?: {
    readonly phys: readonly [number, number];
    readonly attacksPerSecond: number;
    readonly critChance: number;
  };
  readonly defence?: {
    readonly armour?: number;
    readonly evasion?: number;
    readonly energyShield?: number;
    readonly block?: number;
  };
  readonly defenceType?: DefenceType;
  readonly implicits: readonly ModTemplate[];
  readonly req: Readonly<Record<Attribute, number>>;
  /** Used for affix eligibility and as skill tags for attacks (e.g. 'mace', 'melee'). */
  readonly tags: readonly string[];
  readonly sellPrice: number;
}

/** A rolled affix value range per stat for one tier. */
export interface AffixTier {
  /** Minimum item level for this tier. */
  readonly ilvl: number;
  readonly weight: number;
  /** One [min, max] range per stat line of the affix. */
  readonly ranges: readonly (readonly [number, number])[];
}

export interface AffixStatLine {
  readonly stat: StatId;
  readonly kind: Mod['kind'];
  readonly tags?: readonly string[];
  /** Local mods modify the item's own base stats (weapon damage, armour piece defences). */
  readonly local?: boolean;
}

export interface AffixDef {
  readonly id: string;
  readonly kind: 'prefix' | 'suffix' | 'ashen';
  /** Only one affix per group can be on an item. */
  readonly group: string;
  /** The item must have at least one of these tags. */
  readonly allowedTags: readonly string[];
  readonly lines: readonly AffixStatLine[];
  /** Index 0 = worst tier (lowest ilvl); the last = best. Displayed as T1 = best. */
  readonly tiers: readonly AffixTier[];
}

export interface UniqueDef {
  readonly id: string;
  readonly baseId: string;
  /** Fixed affix-like lines; each rolls within its range. */
  readonly lines: readonly (AffixStatLine & { readonly range: readonly [number, number] })[];
}

// ---------------------------------------------------------------- Combat

export type MonsterFamily = 'drowned' | 'wisp' | 'brute' | 'crawler';

export interface MonsterDef {
  readonly id: string;
  readonly family: MonsterFamily;
  readonly lifeMult: number;
  readonly damageMult: number;
  readonly attackIntervalMs: number;
  /** Damage split by type (fractions summing to 1). */
  readonly damageSplit: Partial<
    Record<'physical' | 'fire' | 'cold' | 'lightning' | 'chaos', number>
  >;
  readonly evasionMult: number;
  readonly armourMult: number;
  readonly resists: Partial<Record<'fire' | 'cold' | 'lightning' | 'chaos', number>>;
  /** Chance per kill to drop a tier-matched hide. */
  readonly hideChance: number;
}

export interface MonsterModDef {
  readonly id: string;
  readonly lifeMult?: number;
  readonly damageMult?: number;
  readonly speedMult?: number;
  readonly armourMult?: number;
  readonly evasionMult?: number;
  readonly resistAll?: number;
  /** Extra fire damage as a fraction of the monster's damage. */
  readonly extraFire?: number;
  /** Fraction of damage dealt that the monster heals. */
  readonly leech?: number;
}

export interface ZoneDef {
  readonly id: string;
  readonly act: number;
  readonly index: number;
  readonly level: number;
  readonly monsters: readonly { readonly monsterId: string; readonly weight: number }[];
}
