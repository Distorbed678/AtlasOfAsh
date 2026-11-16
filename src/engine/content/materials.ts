import type { ItemDef } from './types';
import { FISH_IDS, HERB_IDS, LOG_IDS, ORE_IDS, TIER_VALUE } from './skills';

/** Phase 3 crafting materials. Index i = material tier i+1. */
export const FIBRE_IDS = [
  'flax',
  'hemp',
  'cotton',
  'jute',
  'silkgrass',
  'duskthread',
  'gravesilk',
  'sunfibre',
  'starthread',
  'wraithsilk',
].map((x) => `item.${x}`);
export const HIDE_IDS = [
  'rough_pelt',
  'wolf_pelt',
  'boar_hide',
  'bear_hide',
  'drake_hide',
  'duskstalker_hide',
  'gravehound_hide',
  'emberscale_hide',
  'voidbeast_hide',
  'wyrm_hide',
].map((x) => `item.${x}`);
export const BAR_IDS = [
  'copper_bar',
  'bronze_bar',
  'iron_bar',
  'steel_bar',
  'silver_bar',
  'duskiron_bar',
  'bloodsteel_bar',
  'sunsteel_bar',
  'voidforged_bar',
  'aetherite_bar',
].map((x) => `item.${x}`);
export const PLANK_IDS = [
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
].map((x) => `item.${x}_plank`);
export const CLOTH_IDS = [
  'linen',
  'hemp_cloth',
  'cotton_cloth',
  'jute_cloth',
  'silkgrass_cloth',
  'duskweave',
  'gravesilk_cloth',
  'sunweave',
  'starweave',
  'wraithweave',
].map((x) => `item.${x}`);
export const LEATHER_IDS = [
  'rough_leather',
  'wolf_leather',
  'boar_leather',
  'bear_leather',
  'drake_leather',
  'duskstalker_leather',
  'gravehound_leather',
  'emberscale_leather',
  'voidbeast_leather',
  'wyrm_leather',
].map((x) => `item.${x}`);
export const CUT_GEM = 'item.cut_gem';
export const ARCANE_DUST = 'item.arcane_dust';

const ORE = (i: number) => ORE_IDS[i]!;
const COAL = 'item.coal';

/** Smelting inputs per bar tier. Coal joins from steel (tier 4) onwards. */
export const BAR_INPUTS: Record<string, number>[] = [
  { [ORE(0)]: 2 },
  { [ORE(0)]: 1, [ORE(1)]: 1 },
  { [ORE(2)]: 2 },
  { [ORE(2)]: 1, [COAL]: 2 },
  { [ORE(4)]: 2, [COAL]: 1 },
  { [ORE(5)]: 2, [COAL]: 2 },
  { [ORE(6)]: 2, [ORE(2)]: 1, [COAL]: 2 },
  { [ORE(7)]: 2, [COAL]: 3 },
  { [ORE(8)]: 2, [COAL]: 3 },
  { [ORE(9)]: 2, [COAL]: 4 },
];

const tiers = [...Array(10).keys()];
const HERB_VALUE = TIER_VALUE.map((v) => Math.max(1, Math.round(v * 0.6)));
const price = (id: string, all: ItemDef[]) => all.find((d) => d.id === id)?.sellPrice ?? 0;

function sumInputs(inputs: Record<string, number>, known: ItemDef[]): number {
  return Object.entries(inputs).reduce((s, [id, q]) => s + price(id, known) * q, 0);
}

/** Built in dependency order so refined goods are priced from their inputs. */
function build(raw: ItemDef[]): ItemDef[] {
  const out: ItemDef[] = [];
  const known = () => [...raw, ...out];
  for (const i of tiers)
    out.push({ id: FIBRE_IDS[i]!, category: 'fibre', tier: i + 1, sellPrice: HERB_VALUE[i]! });
  for (const i of tiers)
    out.push({ id: HIDE_IDS[i]!, category: 'hide', tier: i + 1, sellPrice: TIER_VALUE[i]! * 3 });
  for (const i of tiers)
    out.push({
      id: BAR_IDS[i]!,
      category: 'bar',
      tier: i + 1,
      sellPrice: Math.ceil(sumInputs(BAR_INPUTS[i]!, known()) * 1.2),
    });
  for (const i of tiers)
    out.push({
      id: PLANK_IDS[i]!,
      category: 'plank',
      tier: i + 1,
      sellPrice: Math.ceil(price(LOG_IDS[i]!, known()) * 2 * 1.2),
    });
  for (const i of tiers)
    out.push({
      id: CLOTH_IDS[i]!,
      category: 'cloth',
      tier: i + 1,
      sellPrice: Math.ceil(HERB_VALUE[i]! * 3 * 1.2),
    });
  for (const i of tiers)
    out.push({
      id: LEATHER_IDS[i]!,
      category: 'leather',
      tier: i + 1,
      sellPrice: Math.ceil(TIER_VALUE[i]! * 3 * 1.5),
    });
  out.push({ id: CUT_GEM, category: 'gem', tier: 1, sellPrice: 60 });
  out.push({ id: ARCANE_DUST, category: 'dust', tier: 1, sellPrice: 1 });
  return out;
}

// Raw inputs needed for pricing (copied shapes to avoid a circular import of SKILL_ITEMS).
const RAW_FOR_PRICING: ItemDef[] = [
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
];

export const MATERIAL_ITEMS: ItemDef[] = build(RAW_FOR_PRICING);

// ------------------------------------------------------------- Enchanting reagents

export interface ReagentSpec {
  id: string;
  level: number;
  inputs: Record<string, number>;
  sellPrice: number;
}

const H = HERB_IDS;
const GEM = 'item.gem_fragment';

export const REAGENTS: ReagentSpec[] = [
  { id: 'item.spark_of_change', level: 1, inputs: { [ARCANE_DUST]: 5, [H[0]!]: 1 }, sellPrice: 8 },
  {
    id: 'item.ember_of_growth',
    level: 5,
    inputs: { [ARCANE_DUST]: 10, [H[1]!]: 2 },
    sellPrice: 15,
  },
  {
    id: 'item.kindled_heart',
    level: 15,
    inputs: { [ARCANE_DUST]: 25, [H[2]!]: 3, [GEM]: 1 },
    sellPrice: 70,
  },
  {
    id: 'item.ashfall_powder',
    level: 25,
    inputs: { [ARCANE_DUST]: 40, [H[3]!]: 3, [GEM]: 1 },
    sellPrice: 100,
  },
  {
    id: 'item.tempering_oil',
    level: 35,
    inputs: { [ARCANE_DUST]: 60, [H[5]!]: 2, [FISH_IDS[4]!]: 2 },
    sellPrice: 120,
  },
  {
    id: 'item.severing_salt',
    level: 45,
    inputs: { [ARCANE_DUST]: 80, [H[6]!]: 3, [GEM]: 2 },
    sellPrice: 200,
  },
  {
    id: 'item.warding_wax',
    level: 60,
    inputs: { [ARCANE_DUST]: 150, [H[7]!]: 5, [GEM]: 3 },
    sellPrice: 400,
  },
  {
    id: 'item.binding_wax',
    level: 60,
    inputs: { [ARCANE_DUST]: 150, [H[7]!]: 5, [GEM]: 3 },
    sellPrice: 400,
  },
  {
    id: 'item.ashfire_brand',
    level: 80,
    inputs: { [ARCANE_DUST]: 400, [H[9]!]: 5, [GEM]: 5, 'item.black_pearl': 1 },
    sellPrice: 1500,
  },
];

/** Targeted infusions: guarantee one affix group while rerolling the rest. */
export const INFUSIONS: { id: string; group: string }[] = [
  { id: 'item.infusion_vitality', group: 'life' },
  { id: 'item.infusion_clarity', group: 'mana' },
  { id: 'item.infusion_fury', group: 'pctPhysLocal' },
  { id: 'item.infusion_sorcery', group: 'spellDamage' },
  { id: 'item.infusion_embers', group: 'fireRes' },
  { id: 'item.infusion_frost', group: 'coldRes' },
  { id: 'item.infusion_storms', group: 'lightningRes' },
  { id: 'item.infusion_haste', group: 'attackSpeedLocal' },
  { id: 'item.infusion_ruin', group: 'critBonus' },
  { id: 'item.infusion_incantation', group: 'castSpeed' },
];
export const INFUSION_LEVEL = 70;
export const INFUSION_INPUTS = { [ARCANE_DUST]: 200, [H[8]!]: 5, [GEM]: 3 };

export const REAGENT_ITEMS: ItemDef[] = [
  ...REAGENTS.map((r) => ({
    id: r.id,
    category: 'reagent' as const,
    tier: 1,
    sellPrice: r.sellPrice,
  })),
  ...INFUSIONS.map((r) => ({ id: r.id, category: 'reagent' as const, tier: 1, sellPrice: 600 })),
];
