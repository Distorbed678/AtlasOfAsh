import type { UniqueDef } from './types';

/** Phase 3 craftable uniques (one per crafting skill, plus two). */
export const UNIQUES: UniqueDef[] = [
  {
    id: 'unique.oathbreaker',
    baseId: 'base.mace_t6',
    lines: [
      { stat: 'damage', kind: 'increased', tags: ['physical'], local: true, range: [160, 200] },
      { stat: 'attackSpeed', kind: 'increased', local: true, range: [10, 15] },
      { stat: 'lifeLeech', kind: 'flat', tags: ['attack'], range: [2, 3] },
      { stat: 'str', kind: 'flat', range: [20, 30] },
    ],
  },
  {
    id: 'unique.whisperwind',
    baseId: 'base.bow_t7',
    lines: [
      { stat: 'attackSpeed', kind: 'increased', local: true, range: [15, 20] },
      { stat: 'critChance', kind: 'increased', local: true, range: [40, 60] },
      { stat: 'dex', kind: 'flat', range: [30, 40] },
      { stat: 'gainAs.physical.lightning', kind: 'flat', range: [10, 15] },
    ],
  },
  {
    id: 'unique.shroud_last_lamp',
    baseId: 'base.body_es_t8',
    lines: [
      { stat: 'energyShield', kind: 'increased', local: true, range: [120, 160] },
      { stat: 'int', kind: 'flat', range: [30, 40] },
      { stat: 'resist.fire', kind: 'flat', range: [15, 20] },
      { stat: 'resist.cold', kind: 'flat', range: [15, 20] },
      { stat: 'resist.lightning', kind: 'flat', range: [15, 20] },
    ],
  },
  {
    id: 'unique.ring_of_cinders',
    baseId: 'base.ring_t5',
    lines: [
      { stat: 'added.fire.min', kind: 'flat', tags: ['attack'], range: [8, 12] },
      { stat: 'added.fire.max', kind: 'flat', tags: ['attack'], range: [16, 22] },
      { stat: 'resist.fire', kind: 'flat', range: [30, 40] },
      { stat: 'ailmentChance.ignite', kind: 'flat', range: [10, 15] },
    ],
  },
  {
    id: 'unique.bulwark_of_ash',
    baseId: 'base.shield_t9',
    lines: [
      { stat: 'block', kind: 'flat', range: [6, 8] },
      { stat: 'armour', kind: 'increased', local: true, range: [100, 140] },
      { stat: 'life', kind: 'flat', range: [60, 80] },
      { stat: 'maxResist.fire', kind: 'flat', range: [2, 3] },
    ],
  },
  {
    id: 'unique.wanderers_wraps',
    baseId: 'base.boots_ev_t1',
    lines: [
      { stat: 'life', kind: 'flat', range: [20, 30] },
      { stat: 'resist.fire', kind: 'flat', range: [8, 12] },
      { stat: 'resist.cold', kind: 'flat', range: [8, 12] },
      { stat: 'resist.lightning', kind: 'flat', range: [8, 12] },
      { stat: 'dex', kind: 'flat', range: [10, 15] },
    ],
  },
];

/** Recipes: skill, level and inputs for each unique. */
export const UNIQUE_RECIPES: Record<
  string,
  {
    skillId: 'skill.smithing' | 'skill.woodworking' | 'skill.tailoring' | 'skill.jewelcrafting';
    level: number;
    inputs: Record<string, number>;
  }
> = {
  'unique.oathbreaker': {
    skillId: 'skill.smithing',
    level: 65,
    inputs: { 'item.duskiron_bar': 8, 'item.cut_gem': 3, 'item.contraband_spices': 1 },
  },
  'unique.whisperwind': {
    skillId: 'skill.woodworking',
    level: 75,
    inputs: { 'item.ironbark_plank': 10, 'item.jeweled_cufflink': 1, 'item.river_pearl': 2 },
  },
  'unique.shroud_last_lamp': {
    skillId: 'skill.tailoring',
    level: 85,
    inputs: { 'item.sunweave': 12, 'item.tithe_chalice': 1, 'item.black_pearl': 2 },
  },
  'unique.ring_of_cinders': {
    skillId: 'skill.jewelcrafting',
    level: 55,
    inputs: {
      'item.silver_bar': 4,
      'item.cut_gem': 4,
      'item.river_pearl': 1,
      'item.merchants_ledger': 1,
    },
  },
  'unique.bulwark_of_ash': {
    skillId: 'skill.smithing',
    level: 95,
    inputs: { 'item.voidforged_bar': 12, 'item.royal_seal': 1, 'item.black_pearl': 2 },
  },
  'unique.wanderers_wraps': {
    skillId: 'skill.tailoring',
    level: 20,
    inputs: { 'item.rough_leather': 6, 'item.copper_ring': 1, 'item.river_pearl': 1 },
  },
};
