import type { ActionDef, ItemDef } from './types';

/**
 * Phase 0 demo content: proves the action loop, saves and offline catch-up.
 * Replaced by real skills in Phase 1 (these ids then go to RETIRED_IDS).
 */
export const DEMO_ITEMS: ItemDef[] = [
  { id: 'item.demo_ember', nameKey: 'item.demo_ember', sellPrice: 1 },
  { id: 'item.demo_ash', nameKey: 'item.demo_ash', sellPrice: 1 },
  { id: 'item.demo_cinder_shard', nameKey: 'item.demo_cinder_shard', sellPrice: 25 },
];

export const DEMO_ACTIONS: ActionDef[] = [
  {
    id: 'action.demo_kindle',
    nameKey: 'action.demo_kindle',
    durationMs: 3000,
    outputs: [
      { itemId: 'item.demo_ember', min: 1, max: 2 },
      { itemId: 'item.demo_cinder_shard', min: 1, max: 1, chance: 0.02 },
    ],
  },
  {
    id: 'action.demo_sift',
    nameKey: 'action.demo_sift',
    durationMs: 5000,
    outputs: [{ itemId: 'item.demo_ash', min: 1, max: 3 }],
  },
];
