import { ContentRegistry } from './registry';
import { DEMO_ACTIONS, DEMO_ITEMS } from './demo';
import type { ActionDef, ItemDef } from './types';

export type { ActionDef, ItemDef } from './types';

/** All game content, validated at module load. */
export const CONTENT = {
  items: new ContentRegistry<ItemDef>('item', DEMO_ITEMS),
  actions: new ContentRegistry<ActionDef>('action', DEMO_ACTIONS),
} as const;

export type Content = typeof CONTENT;
