/**
 * Golden-number tests for the stat & damage engine. Every expected value is
 * calculated by hand in the comments; any change to these results must be a
 * deliberate balance decision.
 */
import { describe, expect, it } from 'vitest';
import { computeAilments } from './ailments';
import { computeCharacter, type CharacterInput } from './character';
import { computeHit, type SkillStats, type TargetStats, type WeaponStats } from './damage';
import { maxHits, mitigateIncoming } from './defence';
import { armourReduction, hitChance, maxPhysHit, rollEntropy } from './formulas';
import { ModSet, mod } from './modSet';
import type { Mod, StatId } from './types';

const SRC = { kind: 'debug' as const, id: 'test', label: 'Test' };
const flat = (stat: StatId, value: number, tags?: string[]): Mod =>
  mod(stat, 'flat', value, SRC, { tags });
const inc = (stat: StatId, value: number, tags?: string[]): Mod =>
  mod(stat, 'increased', value, SRC, { tags });
const more = (stat: StatId, value: number, tags?: string[]): Mod =>
  mod(stat, 'more', value, SRC, { tags });

function sheet(mods: Mod[], over: Partial<CharacterInput> = {}) {
  return computeCharacter({ classId: 'class.ironclad', level: 1, mods, ...over });
}

const DUMMY: TargetStats = {
  life: 1000,
  armour: 0,
  evasion: 0,
  resists: { fire: 0, cold: 0, lightning: 0, chaos: 0 },
};

const MACE: WeaponStats = {
  id: 'test.mace',
  damage: { physical: { min: 10, max: 20 } },
  attacksPerSecond: 1.5,
  critChance: 5,
  tags: ['mace', 'melee'],
};
const STRIKE: SkillStats = { id: 'test.strike', tags: ['attack', 'melee'], damageEffectiveness: 1 };
const spell = (over: Partial<SkillStats>): SkillStats => ({
  id: 'test.spell',
  tags: ['spell'],
  damageEffectiveness: 1,
  castTimeMs: 1000,
  critChance: 0,
  ...over,
});

describe('ModSet', () => {
  it('flat → increased (summed) → more (multiplied)', () => {
    // (10 + 5 + 5) × (1 + 0.2 + 0.3) × 1.1 × 1.2 = 20 × 1.5 × 1.32 = 39.6
    const m = new ModSet([
      flat('life', 5),
      flat('life', 5),
      inc('life', 20),
      inc('life', 30),
      more('life', 10),
      more('life', 20),
    ]);
    expect(m.value('life', 10)).toBeCloseTo(39.6);
  });

  it('tags must all match; conditions must be active', () => {
    const m = new ModSet([
      inc('damage', 50, ['fire']),
      inc('damage', 25, ['attack', 'fire']),
      { ...inc('damage', 100), condition: 'onFullLife' },
    ]);
    expect(m.value('damage', 1, { tags: ['fire'] })).toBeCloseTo(1.5);
    expect(m.value('damage', 1, { tags: ['attack', 'fire'] })).toBeCloseTo(1.75);
    expect(
      m.value('damage', 1, { tags: ['fire'], conditions: new Set(['onFullLife']) }),
    ).toBeCloseTo(2.5);
  });
});

describe('character sheet', () => {
  it('class base + per level + Strength life', () => {
    // Ironclad: 70 + 14 × 9 = 196; 50 Str → +20 life.
    expect(sheet([], { level: 10 }).life.total).toBe(196);
    expect(sheet([flat('str', 50)], { level: 10 }).life.total).toBe(216);
  });

  it('Arcanist mana, ES and Int bonus; Zealot Spirit', () => {
    const a = computeCharacter({ classId: 'class.arcanist', level: 1, mods: [flat('int', 25)] });
    expect(a.mana.total).toBe(70); // 60 + 2 × floor(25 / 5)
    expect(a.energyShield.total).toBe(20);
    expect(computeCharacter({ classId: 'class.zealot', level: 1, mods: [] }).spirit.total).toBe(30);
  });

  it('accuracy = 6 × level + 5 per Dex', () => {
    expect(sheet([flat('dex', 10)], { level: 5 }).accuracy.total).toBe(80);
  });

  it('resists cap at 75, act penalty, max resist hard cap 90', () => {
    expect(sheet([flat('resist.fire', 100)]).resists.fire.value).toBe(75);
    expect(sheet([flat('resist.fire', 100)], { actsCompleted: 3 }).resists.fire.value).toBe(70);
    const s = sheet([flat('resist.fire', 100), flat('maxResist.fire', 20)]);
    expect(s.resists.fire.max).toBe(90);
    expect(s.resists.fire.value).toBe(90);
    expect(sheet([], { actsCompleted: 6 }).resists.cold.value).toBe(-60);
  });

  it('block caps at 50 (75 hard cap)', () => {
    expect(sheet([flat('block', 60)]).block.value).toBe(50);
    expect(sheet([flat('block', 60), flat('maxBlock', 30)]).block.value).toBe(60);
    expect(sheet([flat('block', 90), flat('maxBlock', 40)]).block.value).toBe(75);
  });

  it('regen and ES recharge', () => {
    const s = sheet([flat('life', 930), flat('energyShield', 100), flat('esRechargeStart', 100)]);
    expect(s.lifeRegenPerSec).toBeCloseTo(10); // 1% of 1000
    expect(s.manaRegenPerSec).toBeCloseTo(0.6); // 2% of 30
    expect(s.esRechargePerSec).toBeCloseTo(12.5); // 12.5% of 100
    expect(s.esRechargeDelaySec).toBeCloseTo(2); // 4s / (1 + 100%)
  });
});

describe('damage pipeline', () => {
  it('attack: weapon + added, increased & more, crit, speed', () => {
    // Base 10–20 and added 5–10, both × (1.5 inc × 1.2 more) = 27–54, avg 40.5.
    // Crit 5% at +100%: 40.5 × 1.05 = 42.525; × 1.5 APS = 63.7875 DPS.
    const s = sheet([
      flat('added.physical.min', 5, ['attack']),
      flat('added.physical.max', 10, ['attack']),
      inc('damage', 50, ['physical']),
      more('damage', 20, ['attack']),
    ]);
    const h = computeHit(s, STRIKE, MACE, DUMMY);
    expect(h.byType.physical.min).toBeCloseTo(27);
    expect(h.byType.physical.max).toBeCloseTo(54);
    expect(h.avgHit).toBeCloseTo(40.5);
    expect(h.critChance).toBeCloseTo(0.05);
    expect(h.expectedPerHit).toBeCloseTo(42.525);
    expect(h.usesPerSecond).toBeCloseTo(1.5);
    expect(h.dps).toBeCloseTo(63.7875);
  });

  it('converted damage is scaled by modifiers of every type in its chain', () => {
    // 100 phys, 50% → fire. Phys half: 50 × 1.5 = 75. Fire half: 50 × (1 + 0.5 + 1.0) = 125.
    const s = sheet([
      flat('convert.physical.fire', 50),
      inc('damage', 50, ['physical']),
      inc('damage', 100, ['fire']),
    ]);
    const h = computeHit(
      s,
      spell({ baseDamage: { physical: { min: 100, max: 100 } } }),
      null,
      DUMMY,
    );
    expect(h.byType.physical.avg).toBeCloseTo(75);
    expect(h.byType.fire.avg).toBeCloseTo(125);
    expect(h.dps).toBeCloseTo(200);
  });

  it('skill conversion takes priority; other conversion scales into what is left', () => {
    // Skill 60% phys → cold; gear 80% phys → fire gets scaled to 40%.
    const s = sheet([flat('convert.physical.fire', 80)]);
    const h = computeHit(
      s,
      spell({
        baseDamage: { physical: { min: 100, max: 100 } },
        conversion: { 'physical.cold': 60 },
      }),
      null,
      DUMMY,
    );
    expect(h.conversion).toEqual({ 'physical.cold': 60, 'physical.fire': 40 });
    expect(h.byType.physical.avg).toBeCloseTo(0);
    expect(h.byType.cold.avg).toBeCloseTo(60);
    expect(h.byType.fire.avg).toBeCloseTo(40);
  });

  it('conversion is not reported for damage types the hit does not have', () => {
    const s = sheet([flat('convert.physical.fire', 50)]);
    const h = computeHit(s, spell({ baseDamage: { cold: { min: 10, max: 10 } } }), null, DUMMY);
    expect(h.conversion).toEqual({});
    expect(h.byType.cold.avg).toBeCloseTo(10);
  });

  it('chained conversion: physical → lightning → fire', () => {
    // 100 phys: 50% → lightning; then all lightning (50) converts 100% → fire.
    const s = sheet([flat('convert.physical.lightning', 50), flat('convert.lightning.fire', 100)]);
    const h = computeHit(
      s,
      spell({ baseDamage: { physical: { min: 100, max: 100 } } }),
      null,
      DUMMY,
    );
    expect(h.byType.physical.avg).toBeCloseTo(50);
    expect(h.byType.lightning.avg).toBeCloseTo(0);
    expect(h.byType.fire.avg).toBeCloseTo(50);
    expect(h.packets.find((p) => p.type === 'fire')!.chain).toEqual([
      'physical',
      'lightning',
      'fire',
    ]);
  });

  it('gain as extra adds new damage that also benefits from the source type', () => {
    // 100 phys gains 20% as fire (20); fire packet chain [physical, fire] gets +100% fire → 40.
    const s = sheet([flat('gainAs.physical.fire', 20), inc('damage', 100, ['fire'])]);
    const h = computeHit(
      s,
      spell({ baseDamage: { physical: { min: 100, max: 100 } } }),
      null,
      DUMMY,
    );
    expect(h.byType.physical.avg).toBeCloseTo(100);
    expect(h.byType.fire.avg).toBeCloseTo(40);
  });

  it('spell crit, crit bonus, resist and penetration', () => {
    // Avg 25. Crit 6% × (1 + 100%) = 12%; bonus 100 + 50 = 150%.
    // 25 × (0.88 + 0.12 × 2.5) = 29.5; fire res 50 − 10 pen = 40% → 29.5 × 0.6 = 17.7.
    const s = sheet([
      inc('critChance', 100),
      flat('critBonus', 50),
      flat('penetration.fire', 10, ['fire']),
    ]);
    const target = { ...DUMMY, resists: { ...DUMMY.resists, fire: 50 } };
    const h = computeHit(
      s,
      spell({ baseDamage: { fire: { min: 20, max: 30 } }, critChance: 6 }),
      null,
      target,
    );
    expect(h.critChance).toBeCloseTo(0.12);
    expect(h.critBonus).toBeCloseTo(1.5);
    expect(h.dps).toBeCloseTo(17.7);
  });

  it('attacks can miss against evasion; spells cannot', () => {
    // Ironclad L1 accuracy 6 + 5 × 200 Dex = 1006 vs 1000 evasion: 1.2 × 1006 / 1256 = 0.96115
    const s = sheet([flat('dex', 200)]);
    const target = { ...DUMMY, evasion: 1000 };
    expect(computeHit(s, STRIKE, MACE, target).hitChance).toBeCloseTo(0.96115, 4);
    expect(
      computeHit(s, spell({ baseDamage: { fire: { min: 1, max: 1 } } }), null, target).hitChance,
    ).toBe(1);
  });

  it('armour on the target uses the hit size', () => {
    // 100 phys vs 1000 armour → 50% reduction → 50 per hit, 1 cast/s.
    const h = computeHit(
      sheet([]),
      spell({ baseDamage: { physical: { min: 100, max: 100 } } }),
      null,
      { ...DUMMY, armour: 1000 },
    );
    expect(h.dps).toBeCloseTo(50);
  });

  it('leech is capped at 20% of life per second', () => {
    // 200 DPS spell, 10% leech → 20/s, but cap is 20% × 70 life = 14/s.
    const h = computeHit(
      sheet([flat('lifeLeech', 10)]),
      spell({ baseDamage: { fire: { min: 200, max: 200 } } }),
      null,
      DUMMY,
    );
    expect(h.leechPerSecond).toBeCloseTo(14);
  });
});

describe('ailments', () => {
  const base = { ctx: {}, skillTags: ['spell'], threshold: 200 };

  it('ignite: chance = fire / threshold, 20%/s for 4s, only ailment mods scale it', () => {
    const mods = new ModSet([inc('ailmentEffect.ignite', 50, ['ignite'])]);
    const [ignite] = computeAilments({ ...base, mods, hit: { fire: 50 } });
    expect(ignite).toMatchObject({ ailment: 'ignite', durationS: 4 });
    expect(ignite!.chance).toBeCloseTo(0.25);
    expect(ignite!.dps).toBeCloseTo(15); // 50 × 20% × 1.5
  });

  it('shock, chill and freeze from threshold', () => {
    const r = computeAilments({ ...base, mods: new ModSet(), hit: { lightning: 50, cold: 40 } });
    const by = Object.fromEntries(r.map((a) => [a.ailment, a]));
    expect(by.shock!.chance).toBeCloseTo(0.25);
    expect(by.shock!.magnitude).toBe(20);
    expect(by.chill!.magnitude).toBeCloseTo(10); // 50 × 40 / 200
    expect(by.freeze!.chance).toBeCloseTo(0.2);
    expect(by.freeze!.hitsToFreeze).toBe(5);
  });

  it('bleed needs chance; DoT damage mods scale it', () => {
    const none = computeAilments({ ...base, mods: new ModSet(), hit: { physical: 100 } });
    expect(none.find((a) => a.ailment === 'bleed')!.chance).toBe(0);
    const mods = new ModSet([flat('ailmentChance.bleed', 25), inc('dotDamage', 100, ['dot'])]);
    const r = computeAilments({
      ...base,
      mods,
      hit: { physical: 100 },
      skillChance: { bleed: 25 },
    });
    const bleed = r.find((a) => a.ailment === 'bleed')!;
    expect(bleed.chance).toBeCloseTo(0.5);
    expect(bleed.dps).toBeCloseTo(30); // 100 × 15% × 2
  });
});

describe('defence', () => {
  it('formulas', () => {
    expect(armourReduction(1000, 100)).toBeCloseTo(0.5);
    expect(armourReduction(1000, 10)).toBeCloseTo(0.9);
    expect(hitChance(1000, 1000)).toBeCloseTo(0.96);
    expect(hitChance(100, 100_000)).toBe(0.05);
    expect(maxPhysHit(1000, 0)).toBe(1000);
    // 10h² / (1000 + 10h) = 1000 → h = (10000 + √(10⁸ + 4·10⁷)) / 20 ≈ 1091.608
    expect(maxPhysHit(1000, 1000)).toBeCloseTo(1091.608, 2);
  });

  it('incoming hit: resists, evasion and block', () => {
    const s = sheet([
      flat('life', 930),
      flat('resist.fire', 50),
      flat('evasion', 1000),
      flat('block', 25),
    ]);
    const r = mitigateIncoming(s, { damage: { fire: 100 }, accuracy: 1000 });
    expect(r.taken).toBeCloseTo(50);
    expect(r.evadeChance).toBeCloseTo(0.04);
    expect(r.avoidChance).toBeCloseTo(0.28); // 1 − 0.96 × 0.75
    expect(maxHits(s).fire).toBeCloseTo(2000);
    expect(maxHits(s).physical).toBe(1000);
  });

  it('energy shield takes damage first', () => {
    const s = sheet([flat('energyShield', 30)]);
    const r = mitigateIncoming(s, { damage: { chaos: 50 } });
    expect(r.toEnergyShield).toBe(30);
    expect(r.toLife).toBe(20);
  });
});

describe('entropy', () => {
  it('produces exactly the expected number of hits without streaks', () => {
    let e = 0.37;
    let hits = 0;
    let longestMissStreak = 0;
    let streak = 0;
    for (let i = 0; i < 100; i++) {
      const [hit, next] = rollEntropy(e, 0.75);
      e = next;
      if (hit) {
        hits++;
        streak = 0;
      } else longestMissStreak = Math.max(longestMissStreak, ++streak);
    }
    expect(hits).toBeGreaterThanOrEqual(74);
    expect(hits).toBeLessThanOrEqual(76);
    expect(longestMissStreak).toBe(1);
  });
});
