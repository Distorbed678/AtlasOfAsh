/**
 * Core types for the modifier / stat engine.
 *
 * Every number on a character is computed from a base value plus a list of
 * modifiers, and every modifier remembers where it came from (provenance), so
 * the Codex can explain each number.
 */

export const DAMAGE_TYPES = ['physical', 'lightning', 'cold', 'fire', 'chaos'] as const;
/** Ordered for conversion: damage can only convert to a type later in this list. */
export type DamageType = (typeof DAMAGE_TYPES)[number];
export const ELEMENTS = ['fire', 'cold', 'lightning'] as const;
export type Element = (typeof ELEMENTS)[number];
export type ResistType = Element | 'chaos';
export const RESIST_TYPES: readonly ResistType[] = ['fire', 'cold', 'lightning', 'chaos'];

export const AILMENTS = ['ignite', 'bleed', 'poison', 'shock', 'chill', 'freeze'] as const;
export type Ailment = (typeof AILMENTS)[number];

/**
 * Stat ids. Templated ids carry their parameters:
 *  - `added.<type>.min|max`: flat added damage
 *  - `convert.<from>.<to>` / `gainAs.<from>.<to>`: % conversion / extra damage
 */
export type StatId =
  | 'life'
  | 'mana'
  | 'spirit'
  | 'energyShield'
  | 'armour'
  | 'evasion'
  | 'accuracy'
  | 'str'
  | 'dex'
  | 'int'
  | 'lifeRegenPct'
  | 'lifeRegen'
  | 'manaRegenPct'
  | `resist.${ResistType}`
  | `maxResist.${ResistType}`
  | 'block'
  | 'maxBlock'
  | 'damage'
  | `added.${DamageType}.min`
  | `added.${DamageType}.max`
  | `convert.${DamageType}.${DamageType}`
  | `gainAs.${DamageType}.${DamageType}`
  | `penetration.${ResistType}`
  | 'critChance'
  | 'critBonus'
  | 'attackSpeed'
  | 'castSpeed'
  | `ailmentChance.${Ailment}`
  | `ailmentEffect.${Ailment}`
  | 'dotDamage'
  | 'lifeLeech'
  | 'leechCap'
  | 'esRechargeRate'
  | 'esRechargeStart'
  | 'damageTaken'
  | 'flaskRecovery'
  | 'flaskMaxCharges'
  | 'flaskChargesUsed'
  | 'flaskDuration';

/**
 * - flat: added to the base
 * - increased: summed, then applied once (value in %)
 * - more: each multiplies separately (value in %)
 * - override: replaces the result entirely
 */
export type ModKind = 'flat' | 'increased' | 'more' | 'override';

export type SourceKind =
  'base' | 'class' | 'attribute' | 'item' | 'tree' | 'gem' | 'skill' | 'buff' | 'debug';

export interface ModSource {
  kind: SourceKind;
  /** Content id or other stable reference. */
  id: string;
  /** Human-readable label for the Codex. */
  label: string;
}

export interface Mod {
  stat: StatId;
  kind: ModKind;
  value: number;
  /** The mod applies only to queries that carry ALL of these tags. */
  tags?: readonly string[];
  /** The mod applies only while this condition is true in the context. */
  condition?: string;
  source: ModSource;
}

export interface BreakdownEntry {
  value: number;
  source: ModSource;
  tags?: readonly string[];
  condition?: string;
}

export interface StatBreakdown {
  stat: StatId;
  base: number;
  baseSource?: ModSource;
  flat: BreakdownEntry[];
  increased: BreakdownEntry[];
  more: BreakdownEntry[];
  override?: BreakdownEntry;
  flatSum: number;
  incSum: number;
  moreMult: number;
  total: number;
}
