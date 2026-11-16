import { CLASSES } from './classes';
import { ContentRegistry } from './registry';
import { SKILL_ACTIONS, SKILL_ITEMS, SKILLS } from './skills';
import { BUILDINGS } from './town';
import type { ActionDef, BuildingDef, ClassDef, ItemDef, SkillDef, SkillId } from './types';

export type * from './types';

/** All game content, validated at module load. */
export const CONTENT = {
  items: new ContentRegistry<ItemDef>('item', SKILL_ITEMS),
  skills: new ContentRegistry<SkillDef>('skill', SKILLS),
  actions: new ContentRegistry<ActionDef>('action', SKILL_ACTIONS),
  classes: new ContentRegistry<ClassDef>('class', CLASSES),
  buildings: new ContentRegistry<BuildingDef>('building', BUILDINGS),
} as const;

export type Content = typeof CONTENT;

export const SKILL_IDS = SKILLS.map((s) => s.id) as SkillId[];

export function actionsForSkill(skillId: SkillId, content: Content = CONTENT): ActionDef[] {
  return content.actions.all().filter((a) => a.skillId === skillId);
}
