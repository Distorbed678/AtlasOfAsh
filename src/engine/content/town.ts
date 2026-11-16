import { FISH_IDS, HERB_IDS, LOG_IDS, ORE_IDS } from './skills';
import type { BuildingDef, BuildingTier } from './types';

const cost = (gold: number, items: Record<string, number>): BuildingTier => ({ gold, items });

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'building.guild_hall',
    effect: 'workerSlots',
    values: [0, 1, 2, 3, 4, 5, 6],
    tiers: [
      cost(250, { [LOG_IDS[0]!]: 40, [ORE_IDS[0]!]: 40 }),
      cost(1_500, { [LOG_IDS[1]!]: 120, [ORE_IDS[1]!]: 100 }),
      cost(6_000, { [LOG_IDS[2]!]: 250, [ORE_IDS[2]!]: 200 }),
      cost(20_000, { [LOG_IDS[3]!]: 400, [ORE_IDS[3]!]: 300 }),
      cost(60_000, { [LOG_IDS[4]!]: 600, [ORE_IDS[4]!]: 450 }),
      cost(150_000, { [LOG_IDS[5]!]: 800, [ORE_IDS[5]!]: 600 }),
    ],
  },
  {
    id: 'building.workshop',
    effect: 'workerEfficiency',
    values: [0.3, 0.38, 0.46, 0.54, 0.62, 0.7],
    tiers: [
      cost(1_000, { [LOG_IDS[1]!]: 100, [ORE_IDS[0]!]: 150 }),
      cost(5_000, { [LOG_IDS[2]!]: 200, [ORE_IDS[2]!]: 150 }),
      cost(18_000, { [LOG_IDS[3]!]: 350, [ORE_IDS[3]!]: 300 }),
      cost(55_000, { [LOG_IDS[4]!]: 500, [ORE_IDS[4]!]: 400 }),
      cost(140_000, { [LOG_IDS[6]!]: 700, [ORE_IDS[6]!]: 500 }),
    ],
  },
  {
    id: 'building.training_yard',
    effect: 'workerXpShare',
    values: [0.1, 0.14, 0.18, 0.22, 0.26, 0.3],
    tiers: [
      cost(800, { [FISH_IDS[0]!]: 100, [HERB_IDS[0]!]: 100 }),
      cost(4_000, { [FISH_IDS[1]!]: 200, [HERB_IDS[1]!]: 200 }),
      cost(15_000, { [FISH_IDS[2]!]: 300, [HERB_IDS[2]!]: 300 }),
      cost(45_000, { [FISH_IDS[3]!]: 450, [HERB_IDS[3]!]: 450 }),
      cost(120_000, { [FISH_IDS[4]!]: 600, [HERB_IDS[4]!]: 600 }),
    ],
  },
  {
    id: 'building.vault',
    effect: 'bankSlots',
    values: [40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140],
    tiers: [...Array(10).keys()].map((i) =>
      cost(Math.round((400 * 2.6 ** i) / 10) * 10, {
        [LOG_IDS[i]!]: 60 + 40 * i,
        [ORE_IDS[i]!]: 60 + 40 * i,
      }),
    ),
  },
];
