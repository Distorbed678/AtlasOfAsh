import type { ModSet, QueryContext } from './modSet';
import type { Ailment, DamageType } from './types';

/** PLAN §1.9 ailment numbers. */
export const AILMENT_RULES = {
  ignite: { dpsPct: 20, durationS: 4 },
  bleed: { dpsPct: 15, durationS: 5 },
  poison: { dpsPct: 20, durationS: 2 },
  shock: { effectPct: 20, durationS: 4 },
  chill: { maxSlowPct: 30, slowPerThreshold: 50, durationS: 2 },
  freeze: { durationS: 3 },
} as const;

export interface AilmentResult {
  ailment: Ailment;
  /** Chance per hit to apply (0..1). For freeze: buildup per hit as a fraction of the threshold. */
  chance: number;
  /** Damaging ailments: damage per second of one instance. */
  dps?: number;
  /** Shock: % more damage taken. Chill: % slow. */
  magnitude?: number;
  durationS: number;
  /** Freeze: hits needed to freeze from zero. */
  hitsToFreeze?: number;
}

export interface AilmentInput {
  mods: ModSet;
  ctx: QueryContext;
  /** Tags of the skill (attack/spell, weapon, etc.). */
  skillTags: readonly string[];
  /** Average pre-mitigation hit damage by type. */
  hit: Partial<Record<DamageType, number>>;
  /** Target's ailment threshold (≈ its max life). */
  threshold: number;
  /** Skill-intrinsic % chance for bleed / poison. */
  skillChance?: Partial<Record<'bleed' | 'poison', number>>;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Threshold-based ailments (PoE2-style): elemental ailments happen innately with
 * chance = damage of that type / threshold; bleed and poison need chance mods.
 * Only ailment-specific modifiers and "damage over time" scale ailment damage.
 */
export function computeAilments(input: AilmentInput): AilmentResult[] {
  const { mods, ctx, skillTags, hit, threshold } = input;
  const dmg = (t: DamageType) => hit[t] ?? 0;
  const tags = (...extra: string[]) => ({ ...ctx, tags: [...skillTags, ...extra] });
  const chanceFor = (ailment: Ailment, innate: number, intrinsicPct = 0) => {
    const b = mods.query(`ailmentChance.${ailment}`, 0, tags(ailment));
    return clamp01((innate + (intrinsicPct + b.flatSum) / 100) * (1 + b.incSum / 100) * b.moreMult);
  };
  const effect = (ailment: Ailment, ...types: DamageType[]) =>
    mods.query(`ailmentEffect.${ailment}`, 1, tags(ailment)).total *
    (AILMENT_DOT.has(ailment)
      ? mods.query('dotDamage', 1, tags('dot', ailment, ...types)).total
      : 1);
  const t = Math.max(1, threshold);
  const out: AilmentResult[] = [];

  if (dmg('fire') > 0) {
    const r = AILMENT_RULES.ignite;
    out.push({
      ailment: 'ignite',
      chance: chanceFor('ignite', dmg('fire') / t),
      dps: ((dmg('fire') * r.dpsPct) / 100) * effect('ignite', 'fire'),
      durationS: r.durationS,
    });
  }
  if (dmg('lightning') > 0) {
    const r = AILMENT_RULES.shock;
    out.push({
      ailment: 'shock',
      chance: chanceFor('shock', dmg('lightning') / t),
      magnitude: r.effectPct * effect('shock'),
      durationS: r.durationS,
    });
  }
  if (dmg('cold') > 0) {
    const c = AILMENT_RULES.chill;
    out.push({
      ailment: 'chill',
      chance: 1,
      magnitude: Math.min(c.maxSlowPct, ((c.slowPerThreshold * dmg('cold')) / t) * effect('chill')),
      durationS: c.durationS,
    });
    const buildup = (dmg('cold') / t) * effect('freeze');
    out.push({
      ailment: 'freeze',
      chance: buildup,
      hitsToFreeze: buildup > 0 ? Math.ceil(1 / buildup) : Infinity,
      durationS: AILMENT_RULES.freeze.durationS,
    });
  }
  if (dmg('physical') > 0) {
    const r = AILMENT_RULES.bleed;
    out.push({
      ailment: 'bleed',
      chance: chanceFor('bleed', 0, input.skillChance?.bleed ?? 0),
      dps: ((dmg('physical') * r.dpsPct) / 100) * effect('bleed', 'physical'),
      durationS: r.durationS,
    });
  }
  const poisonBase = dmg('physical') + dmg('chaos');
  if (poisonBase > 0) {
    const r = AILMENT_RULES.poison;
    out.push({
      ailment: 'poison',
      chance: chanceFor('poison', 0, input.skillChance?.poison ?? 0),
      dps: ((poisonBase * r.dpsPct) / 100) * effect('poison', 'physical', 'chaos'),
      durationS: r.durationS,
    });
  }
  return out;
}

const AILMENT_DOT = new Set<Ailment>(['ignite', 'bleed', 'poison']);
