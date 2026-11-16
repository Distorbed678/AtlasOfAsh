import type { ActionDef, ItemDef, SkillDef, WeightedItem } from './types';

/**
 * Phase 1 gathering + thieving content. 10 tiers per skill; tier numbers
 * are shared so balance can be tuned in one place.
 */
export const TIER_LEVELS = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
export const TIER_DURATION_MS = [5000, 5500, 6500, 7000, 8000, 9000, 9500, 10500, 11000, 12000];
export const TIER_XP = [10, 18, 28, 40, 55, 75, 98, 125, 160, 200];
export const TIER_VALUE = [1, 3, 5, 8, 12, 18, 26, 36, 50, 70];

const ORES = [
  'copper_ore',
  'tin_ore',
  'iron_ore',
  'coal',
  'silver_ore',
  'duskiron_ore',
  'bloodstone',
  'sunsteel_ore',
  'voidglass',
  'aetherite',
];
const ROCKS = [
  'copper',
  'tin',
  'iron',
  'coal',
  'silver',
  'duskiron',
  'bloodstone',
  'sunsteel',
  'voidglass',
  'aetherite',
];
const LOGS = [
  'pine',
  'oak',
  'birch',
  'maple',
  'yew',
  'gloamwood',
  'ironbark',
  'emberwood',
  'silverheart',
  'elderroot',
];
const HERBS = [
  'sage',
  'mint',
  'nettle',
  'thistle',
  'wormwood',
  'duskbloom',
  'gravemoss',
  'sunpetal',
  'starpetal',
  'wraithcap',
];
const FISH = [
  'sardine',
  'trout',
  'salmon',
  'pike',
  'eel',
  'glowfin',
  'duskray',
  'emberscale_carp',
  'abyssal_angler',
  'leviathan_eel',
];
const SPOTS = [
  'shallows',
  'stream',
  'river',
  'lake',
  'marsh',
  'glowing_pool',
  'dusk_lagoon',
  'cinder_springs',
  'abyssal_trench',
  'leviathan_deep',
];
const TARGETS = [
  'farmhand',
  'peddler',
  'watchman',
  'merchant',
  'courier',
  'smuggler',
  'noble',
  'treasurer',
  'assessor',
  'vault_keeper',
];
const TRINKETS = [
  'copper_ring',
  'pewter_brooch',
  'watchmans_whistle',
  'merchants_ledger',
  'sealed_letter',
  'contraband_spices',
  'jeweled_cufflink',
  'tithe_chalice',
  'royal_seal',
  'vault_key_fragment',
];
const TRINKET_VALUE = [30, 60, 100, 160, 240, 350, 500, 700, 950, 1300];
const THIEF_GOLD: [number, number][] = [
  [1, 4],
  [3, 9],
  [6, 15],
  [10, 24],
  [15, 36],
  [22, 52],
  [32, 74],
  [45, 105],
  [62, 145],
  [85, 200],
];
const HERB_VALUE = TIER_VALUE.map((v) => Math.max(1, Math.round(v * 0.6)));

export const ORE_IDS = ORES.map((o) => `item.${o}`);
export const LOG_IDS = LOGS.map((l) => `item.${l}_log`);
export const HERB_IDS = HERBS.map((h) => `item.${h}`);
export const FISH_IDS = FISH.map((f) => `item.${f}`);

const tiers = [...Array(10).keys()];
const base = (i: number) => ({
  tier: i + 1,
  level: TIER_LEVELS[i]!,
  durationMs: TIER_DURATION_MS[i]!,
  xp: TIER_XP[i]!,
});

/** Main item at `mainWeight`% with the previous tier's item as a minor pick. */
function tableWithPrevious(ids: string[], i: number, mainWeight: number): WeightedItem[] {
  const table: WeightedItem[] = [{ itemId: ids[i]!, weight: mainWeight, min: 1, max: 1 }];
  if (i > 0) table.push({ itemId: ids[i - 1]!, weight: 100 - mainWeight, min: 1, max: 1 });
  return table;
}

export const JUNK_IDS = ['item.driftwood', 'item.old_boot', 'item.tangled_net'];

/**
 * Fishing: the spot's fish (80), the previous tier's fish (12), junk (6, split
 * across three items) and a pearl (2). Tier 1 has no previous fish, so its main
 * catch takes that weight.
 */
function fishTable(i: number): WeightedItem[] {
  const one = (itemId: string, weight: number): WeightedItem => ({
    itemId,
    weight,
    min: 1,
    max: 1,
  });
  const table = [one(FISH_IDS[i]!, i > 0 ? 80 : 92)];
  if (i > 0) table.push(one(FISH_IDS[i - 1]!, 12));
  for (const junk of JUNK_IDS) table.push(one(junk, 2));
  table.push(one(i < 5 ? 'item.river_pearl' : 'item.black_pearl', 2));
  return table;
}

export const SKILL_ITEMS: ItemDef[] = [
  ...tiers.map((i) => ({
    id: ORE_IDS[i]!,
    category: 'ore' as const,
    tier: i + 1,
    sellPrice: TIER_VALUE[i]!,
  })),
  ...tiers.map((i) => ({
    id: LOG_IDS[i]!,
    category: 'log' as const,
    tier: i + 1,
    sellPrice: TIER_VALUE[i]!,
  })),
  ...tiers.map((i) => ({
    id: HERB_IDS[i]!,
    category: 'herb' as const,
    tier: i + 1,
    sellPrice: HERB_VALUE[i]!,
  })),
  ...tiers.map((i) => ({
    id: FISH_IDS[i]!,
    category: 'fish' as const,
    tier: i + 1,
    sellPrice: TIER_VALUE[i]!,
  })),
  ...tiers.map((i) => ({
    id: `item.${TRINKETS[i]}`,
    category: 'valuable' as const,
    tier: i + 1,
    sellPrice: TRINKET_VALUE[i]!,
  })),
  ...JUNK_IDS.map((id) => ({ id, category: 'junk' as const, tier: 1, sellPrice: 1 })),
  { id: 'item.river_pearl', category: 'valuable', tier: 3, sellPrice: 60 },
  { id: 'item.black_pearl', category: 'valuable', tier: 8, sellPrice: 250 },
  { id: 'item.gem_fragment', category: 'gem', tier: 1, sellPrice: 40 },
  { id: 'item.seed_pod', category: 'seed', tier: 1, sellPrice: 15 },
  { id: 'item.wild_seed', category: 'seed', tier: 1, sellPrice: 20 },
  {
    id: 'item.sunken_cache',
    category: 'container',
    tier: 1,
    sellPrice: 10,
    container: {
      gold: [20, 150],
      rolls: 2,
      items: [...ORE_IDS.slice(0, 5), ...LOG_IDS.slice(0, 5)].map((itemId) => ({
        itemId,
        weight: 1,
        min: 3,
        max: 10,
      })),
    },
  },
];

const RARE_CHANCE = 1 / 200;

export const SKILLS: SkillDef[] = [
  {
    id: 'skill.mining',
    kind: 'gathering',
    rareFinds: [{ itemId: 'item.gem_fragment', chance: RARE_CHANCE }],
  },
  {
    id: 'skill.woodcutting',
    kind: 'gathering',
    rareFinds: [{ itemId: 'item.seed_pod', chance: RARE_CHANCE }],
  },
  {
    id: 'skill.herbalism',
    kind: 'gathering',
    rareFinds: [{ itemId: 'item.wild_seed', chance: RARE_CHANCE }],
  },
  {
    id: 'skill.fishing',
    kind: 'gathering',
    rareFinds: [{ itemId: 'item.sunken_cache', chance: RARE_CHANCE }],
  },
  { id: 'skill.thieving', kind: 'thieving', rareFinds: [] },
];

export const SKILL_ACTIONS: ActionDef[] = [
  ...tiers.map((i): ActionDef => ({
    ...base(i),
    id: `action.mine_${ROCKS[i]}`,
    skillId: 'skill.mining',
    type: 'rock',
    itemId: ORE_IDS[i]!,
    qty: 1,
    rockHp: 8,
    respawnMs: 5000 + i * 1000,
  })),
  ...tiers.map((i): ActionDef => ({
    ...base(i),
    id: `action.chop_${LOGS[i]}`,
    skillId: 'skill.woodcutting',
    type: 'simple',
    itemId: LOG_IDS[i]!,
    qty: 1,
  })),
  ...tiers.map((i): ActionDef => ({
    ...base(i),
    id: `action.gather_${HERBS[i]}`,
    skillId: 'skill.herbalism',
    type: 'bundle',
    picks: [1, 3],
    table: tableWithPrevious(HERB_IDS, i, 80),
  })),
  ...tiers.map((i): ActionDef => ({
    ...base(i),
    id: `action.fish_${SPOTS[i]}`,
    skillId: 'skill.fishing',
    type: 'catch',
    table: fishTable(i),
  })),
  ...tiers.map((i): ActionDef => ({
    ...base(i),
    id: `action.pickpocket_${TARGETS[i]}`,
    skillId: 'skill.thieving',
    type: 'thieve',
    perception: TIER_LEVELS[i]! + 10,
    gold: THIEF_GOLD[i]!,
    rares: [{ itemId: `item.${TRINKETS[i]}`, chance: 1 / 150 }],
  })),
];
