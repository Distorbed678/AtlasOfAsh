import { computeAilments, type AilmentResult } from './ailments';
import type { CharacterSheet } from './character';
import { hitChance, physAfterArmour } from './formulas';
import type { QueryContext } from './modSet';
import { DAMAGE_TYPES, type DamageType, type ResistType, type StatBreakdown } from './types';

export interface DamageRange {
  min: number;
  max: number;
}
export type DamageMap = Partial<Record<DamageType, DamageRange>>;

export interface WeaponStats {
  id: string;
  damage: DamageMap;
  attacksPerSecond: number;
  /** Base crit chance in %. */
  critChance: number;
  /** e.g. ['mace', 'melee', 'weapon'] */
  tags: readonly string[];
}

export interface SkillStats {
  id: string;
  /** Must include 'attack' or 'spell'. */
  tags: readonly string[];
  /** Multiplies weapon damage (attacks) and all added flat damage. 1 = 100%. */
  damageEffectiveness: number;
  /** Spells: base damage. */
  baseDamage?: DamageMap;
  /** Spells: base cast time in ms. */
  castTimeMs?: number;
  /** Spells: base crit chance in %. */
  critChance?: number;
  /** Skill-intrinsic conversion, e.g. { 'physical.fire': 50 } (applied before other conversion). */
  conversion?: Partial<Record<`${DamageType}.${DamageType}`, number>>;
  /** Skill-intrinsic chance (%) to bleed / poison. */
  ailmentChance?: Partial<Record<'bleed' | 'poison', number>>;
}

export interface TargetStats {
  life: number;
  armour: number;
  evasion: number;
  resists: Record<ResistType, number>;
  /** Defaults to life. */
  ailmentThreshold?: number;
  /** Shocked targets take +20% damage (or more with shock effect). */
  damageTakenMult?: number;
}

/** A portion of damage with its conversion history. Modifiers for every type in `chain` apply. */
export interface DamagePacket {
  type: DamageType;
  chain: DamageType[];
  origin: 'base' | 'added' | 'gained';
  min: number;
  max: number;
  /** Final min/max after increased/more. */
  finalMin: number;
  finalMax: number;
  breakdown: StatBreakdown;
}

export interface HitCalculation {
  isAttack: boolean;
  skillTags: string[];
  packets: DamagePacket[];
  /** Final pre-mitigation damage by type. */
  byType: Record<DamageType, DamageRange & { avg: number }>;
  avgHit: number;
  critChance: number;
  critChanceBreakdown: StatBreakdown;
  critBonus: number;
  critBonusBreakdown: StatBreakdown;
  usesPerSecond: number;
  speedBreakdown: StatBreakdown;
  hitChance: number;
  /** Conversion actually applied, as % of the source type: { 'physical.fire': 50 }. */
  conversion: Record<string, number>;
  /** Expected damage per use after crit and target mitigation (before hit chance). */
  expectedPerHit: number;
  /** Mitigated average damage by type (non-crit). */
  mitigatedByType: Record<DamageType, number>;
  penetration: Record<ResistType, number>;
  dps: number;
  ailments: AilmentResult[];
  leechPerSecond: number;
}

const ORDER = DAMAGE_TYPES;

function emptyByType(): Record<DamageType, DamageRange & { avg: number }> {
  return Object.fromEntries(ORDER.map((t) => [t, { min: 0, max: 0, avg: 0 }])) as Record<
    DamageType,
    DamageRange & { avg: number }
  >;
}

/**
 * The damage pipeline:
 * base → added flat → conversion (skill first, ordered, capped at 100%) →
 * gain as extra → increased (summed) & more (multiplied) per packet → crit →
 * speed → hit chance → target mitigation.
 */
export function computeHit(
  sheet: CharacterSheet,
  skill: SkillStats,
  weapon: WeaponStats | null,
  target: TargetStats,
): HitCalculation {
  const isAttack = skill.tags.includes('attack');
  if (isAttack && !weapon) throw new Error(`Attack skill ${skill.id} needs a weapon`);
  const { mods } = sheet;
  const skillTags = [...skill.tags, ...(isAttack && weapon ? weapon.tags : [])];
  const q = (extra: readonly string[] = []): QueryContext => ({
    ...sheet.ctx,
    tags: [...skillTags, ...extra],
  });
  const eff = skill.damageEffectiveness;

  // 1-2. Base and added damage, one packet per type.
  type Raw = {
    type: DamageType;
    chain: DamageType[];
    origin: DamagePacket['origin'];
    min: number;
    max: number;
  };
  let raw: Raw[] = [];
  const baseMap = isAttack ? weapon!.damage : (skill.baseDamage ?? {});
  for (const type of ORDER) {
    const b = baseMap[type];
    if (b && (b.min > 0 || b.max > 0)) {
      const scale = isAttack ? eff : 1;
      raw.push({ type, chain: [type], origin: 'base', min: b.min * scale, max: b.max * scale });
    }
    const aMin = mods.value(`added.${type}.min`, 0, q());
    const aMax = mods.value(`added.${type}.max`, 0, q());
    if (aMin > 0 || aMax > 0) {
      raw.push({ type, chain: [type], origin: 'added', min: aMin * eff, max: aMax * eff });
    }
  }

  // 3. Conversion, processed in type order so converted damage can convert further.
  const conversion: Record<string, number> = {};
  for (let i = 0; i < ORDER.length; i++) {
    const from = ORDER[i]!;
    const targets = ORDER.slice(i + 1);
    const skillPct = targets.map((to) => skill.conversion?.[`${from}.${to}`] ?? 0);
    const modPct = targets.map((to) => Math.max(0, mods.value(`convert.${from}.${to}`, 0, q())));
    const skillTotal = skillPct.reduce((a, b) => a + b, 0);
    const skillScale = skillTotal > 100 ? 100 / skillTotal : 1;
    const remaining = 100 - Math.min(100, skillTotal);
    const modTotal = modPct.reduce((a, b) => a + b, 0);
    const modScale = modTotal > remaining ? remaining / modTotal : 1;
    const pcts = targets.map((_, j) => skillPct[j]! * skillScale + modPct[j]! * modScale);
    const totalPct = pcts.reduce((a, b) => a + b, 0);
    // Only record conversion for damage types this hit actually has.
    if (totalPct <= 0 || !raw.some((p) => p.type === from)) continue;
    targets.forEach((to, j) => {
      if (pcts[j]! > 0) conversion[`${from}.${to}`] = pcts[j]!;
    });
    const next: Raw[] = [];
    for (const p of raw) {
      if (p.type !== from) {
        next.push(p);
        continue;
      }
      const keep = 1 - totalPct / 100;
      if (keep > 0) next.push({ ...p, min: p.min * keep, max: p.max * keep });
      targets.forEach((to, j) => {
        const f = pcts[j]! / 100;
        if (f > 0)
          next.push({ ...p, type: to, chain: [...p.chain, to], min: p.min * f, max: p.max * f });
      });
    }
    raw = next;
  }

  // 4. Gain as extra (based on post-conversion damage; gained damage doesn't gain again).
  const gained: Raw[] = [];
  for (const p of raw) {
    for (const to of ORDER) {
      if (to === p.type) continue;
      const pct = mods.value(`gainAs.${p.type}.${to}`, 0, q());
      if (pct > 0) {
        gained.push({
          type: to,
          chain: p.chain.includes(to) ? p.chain : [...p.chain, to],
          origin: 'gained',
          min: (p.min * pct) / 100,
          max: (p.max * pct) / 100,
        });
      }
    }
  }
  raw = [...raw, ...gained];

  // 5. Increased / more per packet, using every type in its chain.
  const packets: DamagePacket[] = raw.map((p) => {
    const breakdown = mods.query('damage', 1, q([...p.chain, 'hit']));
    return {
      ...p,
      finalMin: p.min * breakdown.total,
      finalMax: p.max * breakdown.total,
      breakdown,
    };
  });
  const byType = emptyByType();
  for (const p of packets) {
    byType[p.type].min += p.finalMin;
    byType[p.type].max += p.finalMax;
  }
  for (const t of ORDER) byType[t].avg = (byType[t].min + byType[t].max) / 2;
  const avgHit = ORDER.reduce((s, t) => s + byType[t].avg, 0);

  // 6. Crit.
  const baseCrit = isAttack ? weapon!.critChance : (skill.critChance ?? 0);
  const critChanceBreakdown = mods.query('critChance', baseCrit, q());
  const critChance = Math.min(100, Math.max(0, critChanceBreakdown.total)) / 100;
  const critBonusBreakdown = mods.query('critBonus', 100, q());
  const critBonus = critBonusBreakdown.total / 100;

  // 7. Speed.
  const speedBreakdown = isAttack
    ? mods.query('attackSpeed', weapon!.attacksPerSecond, q())
    : mods.query('castSpeed', 1000 / (skill.castTimeMs ?? 1000), q());
  const usesPerSecond = speedBreakdown.total;

  // 8. Hit chance (spells always hit).
  const chance = isAttack ? hitChance(sheet.accuracy.total, target.evasion) : 1;

  // 9. Mitigation by the target (armour per hit size, resists minus penetration).
  const penetration = {} as Record<ResistType, number>;
  for (const r of ['fire', 'cold', 'lightning', 'chaos'] as const) {
    penetration[r] = mods.value(`penetration.${r}`, 0, q([r]));
  }
  const taken = target.damageTakenMult ?? 1;
  const mitigate = (type: DamageType, amount: number) => {
    if (type === 'physical') return physAfterArmour(target.armour, amount) * taken;
    const res = target.resists[type] - penetration[type];
    return amount * (1 - res / 100) * taken;
  };
  const mitigatedByType = Object.fromEntries(
    ORDER.map((t) => [t, mitigate(t, byType[t].avg)]),
  ) as Record<DamageType, number>;
  const nonCrit = ORDER.reduce((s, t) => s + mitigatedByType[t], 0);
  const crit = ORDER.reduce((s, t) => s + mitigate(t, byType[t].avg * (1 + critBonus)), 0);
  const expectedPerHit = (1 - critChance) * nonCrit + critChance * crit;
  const dps = expectedPerHit * chance * usesPerSecond;

  const ailments = computeAilments({
    mods,
    ctx: sheet.ctx,
    skillTags,
    hit: Object.fromEntries(ORDER.map((t) => [t, byType[t].avg])),
    threshold: target.ailmentThreshold ?? target.life,
    skillChance: skill.ailmentChance,
  });

  const leechPct = mods.value('lifeLeech', 0, q());
  const leechCap = (sheet.life.total * sheet.leechCapPct.total) / 100;
  const leechPerSecond = Math.min(leechCap, (dps * leechPct) / 100);

  return {
    isAttack,
    skillTags,
    packets,
    byType,
    avgHit,
    critChance,
    critChanceBreakdown,
    critBonus,
    critBonusBreakdown,
    usesPerSecond,
    speedBreakdown,
    hitChance: chance,
    conversion,
    expectedPerHit,
    mitigatedByType,
    penetration,
    dps,
    ailments,
    leechPerSecond,
  };
}
