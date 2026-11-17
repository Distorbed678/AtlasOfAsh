import type { ItemDef, MonsterDef, MonsterFamily, MonsterModDef, ZoneDef } from './types';

/**
 * Act 1 — The Cinder Coast. Monster stats scale from per-level baselines
 * (combat/monsterStats.ts) multiplied by their family and individual tweaks.
 */
type FamilyTemplate = Omit<MonsterDef, 'id' | 'family'>;

const FAMILIES: Record<MonsterFamily, FamilyTemplate> = {
  // Slow, hard physical hits.
  drowned: {
    lifeMult: 1.15,
    damageMult: 1.3,
    attackIntervalMs: 2000,
    damageSplit: { physical: 1 },
    evasionMult: 0.6,
    armourMult: 1,
    resists: { cold: 20 },
    hideChance: 0,
  },
  // Fast elemental hits, very evasive, fragile.
  wisp: {
    lifeMult: 0.7,
    damageMult: 0.75,
    attackIntervalMs: 1100,
    damageSplit: { fire: 1 },
    evasionMult: 1.6,
    armourMult: 0.3,
    resists: { fire: 40 },
    hideChance: 0,
  },
  // Big life and armour.
  brute: {
    lifeMult: 1.8,
    damageMult: 1.15,
    attackIntervalMs: 1800,
    damageSplit: { physical: 1 },
    evasionMult: 0.5,
    armourMult: 2.2,
    resists: {},
    hideChance: 0.2,
  },
  // Fast and weak.
  crawler: {
    lifeMult: 0.75,
    damageMult: 0.65,
    attackIntervalMs: 1000,
    damageSplit: { physical: 1 },
    evasionMult: 1.2,
    armourMult: 0.8,
    resists: {},
    hideChance: 0.15,
  },
};

function monster(
  id: string,
  family: MonsterFamily,
  tweak: Partial<FamilyTemplate> = {},
): MonsterDef {
  return { id: `monster.${id}`, family, ...FAMILIES[family], ...tweak };
}

export const MONSTERS: MonsterDef[] = [
  monster('drowned_fisherman', 'drowned'),
  monster('sand_crawler', 'crawler'),
  monster('drowned_villager', 'drowned', { lifeMult: 1.05 }),
  monster('bloated_corpse', 'drowned', {
    lifeMult: 1.6,
    attackIntervalMs: 2400,
    damageSplit: { physical: 0.7, chaos: 0.3 },
  }),
  monster('ash_wisp', 'wisp'),
  monster('marsh_brute', 'brute'),
  monster('bog_crawler', 'crawler', { damageSplit: { physical: 0.8, chaos: 0.2 } }),
  monster('cave_crawler', 'crawler', { lifeMult: 0.85 }),
  monster('smuggler_ghoul', 'drowned', { attackIntervalMs: 1700 }),
  monster('tunnel_brute', 'brute', { armourMult: 2.6 }),
  monster('ember_wisp', 'wisp', { damageMult: 0.85 }),
  monster('cinder_wolf', 'crawler', { lifeMult: 0.9, damageMult: 0.8, hideChance: 0.3 }),
  monster('charred_stalker', 'brute', {
    lifeMult: 1.4,
    attackIntervalMs: 1500,
    damageSplit: { physical: 0.6, fire: 0.4 },
  }),
  monster('ridge_brute', 'brute', { lifeMult: 2 }),
  monster('drowned_sailor', 'drowned', { damageSplit: { physical: 0.7, cold: 0.3 } }),
  monster('storm_wisp', 'wisp', { damageSplit: { lightning: 1 }, resists: { lightning: 40 } }),
  monster('lighthouse_keeper', 'drowned', {
    lifeMult: 1.4,
    damageMult: 1.45,
    damageSplit: { physical: 0.5, lightning: 0.5 },
  }),
  monster('gate_brute', 'brute', {
    lifeMult: 2.1,
    damageMult: 1.25,
    damageSplit: { physical: 0.7, fire: 0.3 },
  }),
];

const z = (index: number, id: string, level: number, monsters: [string, number][]): ZoneDef => ({
  id: `zone.${id}`,
  act: 1,
  index,
  level,
  monsters: monsters.map(([m, weight]) => ({ monsterId: `monster.${m}`, weight })),
});

export const ZONES: ZoneDef[] = [
  z(1, 'ashfall_beach', 1, [
    ['drowned_fisherman', 60],
    ['sand_crawler', 40],
  ]),
  z(2, 'drowned_hamlet', 2, [
    ['drowned_villager', 50],
    ['bloated_corpse', 25],
    ['ash_wisp', 25],
  ]),
  z(3, 'saltmarsh', 4, [
    ['marsh_brute', 40],
    ['bog_crawler', 40],
    ['ash_wisp', 20],
  ]),
  z(4, 'smugglers_caves', 5, [
    ['cave_crawler', 40],
    ['smuggler_ghoul', 35],
    ['tunnel_brute', 25],
  ]),
  z(5, 'blackened_woods', 7, [
    ['ember_wisp', 35],
    ['cinder_wolf', 40],
    ['charred_stalker', 25],
  ]),
  z(6, 'charcoal_ridge', 8, [
    ['ridge_brute', 45],
    ['ember_wisp', 25],
    ['charred_stalker', 30],
  ]),
  z(7, 'hollow_lighthouse', 10, [
    ['drowned_sailor', 40],
    ['storm_wisp', 35],
    ['lighthouse_keeper', 25],
  ]),
  z(8, 'ember_gate', 12, [
    ['gate_brute', 40],
    ['cinder_wolf', 30],
    ['storm_wisp', 30],
  ]),
];

export const MONSTER_MODS: MonsterModDef[] = [
  { id: 'monstermod.hulking', lifeMult: 1.6 },
  { id: 'monstermod.armoured', armourMult: 2 },
  { id: 'monstermod.evasive', evasionMult: 1.6 },
  { id: 'monstermod.hasted', speedMult: 1.3 },
  { id: 'monstermod.brutal', damageMult: 1.3 },
  { id: 'monstermod.fire_touched', extraFire: 0.4 },
  { id: 'monstermod.vampiric', leech: 0.15 },
  { id: 'monstermod.warded', resistAll: 30 },
];

/** Uncut gems drop in combat; Gemcutting cuts them into gems of the same tier. */
export const UNCUT_GEMS: ItemDef[] = [1, 2, 3, 4, 5].flatMap((t) => [
  { id: `item.uncut_skill_gem_t${t}`, category: 'gem' as const, tier: t, sellPrice: 50 * t },
  { id: `item.uncut_support_gem_t${t}`, category: 'gem' as const, tier: t, sellPrice: 40 * t },
  { id: `item.uncut_spirit_gem_t${t}`, category: 'gem' as const, tier: t, sellPrice: 60 * t },
]);
