import type { ItemDef, SkillId } from '../engine/content/types';

/** Icon keys (see iconData.ts) for things the UI shows. */
export const SKILL_ICONS: Record<SkillId, string> = {
  'skill.mining': 'skill.mining',
  'skill.woodcutting': 'skill.woodcutting',
  'skill.herbalism': 'skill.herbalism',
  'skill.fishing': 'skill.fishing',
  'skill.thieving': 'skill.thieving',
  'skill.smithing': 'skill.smithing',
  'skill.woodworking': 'skill.woodworking',
  'skill.tailoring': 'skill.tailoring',
  'skill.jewelcrafting': 'skill.jewelcrafting',
  'skill.enchanting': 'skill.enchanting',
  'skill.gemcutting': 'skill.gemcutting',
  'skill.alchemy': 'skill.alchemy',
};

const PEARLS = new Set(['item.river_pearl', 'item.black_pearl']);

export function itemIcon(def: ItemDef): string {
  return PEARLS.has(def.id) ? 'item.pearl' : `category.${def.category}`;
}
