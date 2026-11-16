import type { CharacterSheet } from './character';
import { hitChance, maxPhysHit, physAfterArmour } from './formulas';
import { DAMAGE_TYPES, type DamageType } from './types';

export interface IncomingHit {
  damage: Partial<Record<DamageType, number>>;
  /** Attacker accuracy. Present for attacks (which can be evaded); omit for spells. */
  accuracy?: number;
}

export interface IncomingResult {
  evadeChance: number;
  blockChance: number;
  /** Chance the hit is fully avoided (evaded or blocked). */
  avoidChance: number;
  takenByType: Record<DamageType, number>;
  /** Damage taken if the hit lands. */
  taken: number;
  /** Portion absorbed by energy shield (from full ES). */
  toEnergyShield: number;
  toLife: number;
  /** Damage taken averaged over avoidance. */
  expectedTaken: number;
}

function takenMult(sheet: CharacterSheet, type: DamageType): number {
  return sheet.mods.query('damageTaken', 1, { ...sheet.ctx, tags: [type] }).total;
}

function afterMitigation(sheet: CharacterSheet, type: DamageType, amount: number): number {
  const mult = takenMult(sheet, type);
  if (type === 'physical') return physAfterArmour(sheet.armour.total, amount) * mult;
  return amount * (1 - sheet.resists[type].value / 100) * mult;
}

/** What a single incoming hit does to this character (from full life/ES). */
export function mitigateIncoming(sheet: CharacterSheet, hit: IncomingHit): IncomingResult {
  const evadeChance =
    hit.accuracy === undefined ? 0 : 1 - hitChance(hit.accuracy, sheet.evasion.total);
  const blockChance = sheet.block.value / 100;
  const avoidChance = 1 - (1 - evadeChance) * (1 - blockChance);
  const takenByType = Object.fromEntries(
    DAMAGE_TYPES.map((t) => [t, afterMitigation(sheet, t, hit.damage[t] ?? 0)]),
  ) as Record<DamageType, number>;
  const taken = DAMAGE_TYPES.reduce((s, t) => s + takenByType[t], 0);
  const toEnergyShield = Math.min(sheet.energyShield.total, taken);
  return {
    evadeChance,
    blockChance,
    avoidChance,
    takenByType,
    taken,
    toEnergyShield,
    toLife: taken - toEnergyShield,
    expectedTaken: taken * (1 - avoidChance),
  };
}

/** Largest single hit of each damage type survivable from full life + ES (ignoring avoidance). */
export function maxHits(sheet: CharacterSheet): Record<DamageType, number> {
  const pool = sheet.life.total + sheet.energyShield.total;
  const out = {} as Record<DamageType, number>;
  for (const t of DAMAGE_TYPES) {
    const mult = takenMult(sheet, t);
    if (t === 'physical') out[t] = maxPhysHit(pool / mult, sheet.armour.total);
    else {
      const factor = (1 - sheet.resists[t].value / 100) * mult;
      out[t] = factor > 0 ? pool / factor : Infinity;
    }
  }
  return out;
}
