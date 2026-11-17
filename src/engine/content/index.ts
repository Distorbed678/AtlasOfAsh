import { AFFIXES, ASHEN_AFFIXES } from './affixes';
import { ARTISAN_ACTIONS, ARTISAN_SKILLS } from './artisan';
import { BASES } from './bases';
import { CLASSES } from './classes';
import { FLASK_ACTIONS, FLASK_AFFIXES, FLASK_BASES } from './flasks';
import { MONSTER_MODS, MONSTERS, UNCUT_GEMS, ZONES } from './monsters';
import { MATERIAL_ITEMS, REAGENT_ITEMS } from './materials';
import { ContentRegistry } from './registry';
import { SKILL_ACTIONS, SKILL_ITEMS, SKILLS } from './skills';
import { BUILDINGS } from './town';
import type {
  ActionDef,
  AffixDef,
  BaseItemDef,
  BuildingDef,
  ClassDef,
  ItemDef,
  SkillDef,
  SkillId,
  UniqueDef,
  MonsterDef,
  MonsterModDef,
  ZoneDef,
} from './types';
import { UNIQUES } from './uniques';

export type * from './types';

/** All game content, validated at module load. */
export const CONTENT = {
  items: new ContentRegistry<ItemDef>('item', [
    ...SKILL_ITEMS,
    ...MATERIAL_ITEMS,
    ...REAGENT_ITEMS,
    ...UNCUT_GEMS,
  ]),
  skills: new ContentRegistry<SkillDef>('skill', [
    ...SKILLS,
    ...ARTISAN_SKILLS,
    { id: 'skill.alchemy', kind: 'artisan', rareFinds: [] },
  ]),
  actions: new ContentRegistry<ActionDef>('action', [
    ...SKILL_ACTIONS,
    ...ARTISAN_ACTIONS,
    ...FLASK_ACTIONS,
  ]),
  classes: new ContentRegistry<ClassDef>('class', CLASSES),
  buildings: new ContentRegistry<BuildingDef>('building', BUILDINGS),
  bases: new ContentRegistry<BaseItemDef>('base', [...BASES, ...FLASK_BASES]),
  affixes: new ContentRegistry<AffixDef>('affix', [...AFFIXES, ...FLASK_AFFIXES, ...ASHEN_AFFIXES]),
  uniques: new ContentRegistry<UniqueDef>('unique', UNIQUES),
  monsters: new ContentRegistry<MonsterDef>('monster', MONSTERS),
  monsterMods: new ContentRegistry<MonsterModDef>('monstermod', MONSTER_MODS),
  zones: new ContentRegistry<ZoneDef>('zone', ZONES),
} as const;

export type Content = typeof CONTENT;

export const SKILL_IDS = CONTENT.skills.all().map((s) => s.id) as SkillId[];

const bySkill = new Map<SkillId, ActionDef[]>();
for (const a of CONTENT.actions.all()) {
  const list = bySkill.get(a.skillId) ?? [];
  list.push(a);
  bySkill.set(a.skillId, list);
}

export function actionsForSkill(skillId: SkillId, content: Content = CONTENT): ActionDef[] {
  if (content === CONTENT) return bySkill.get(skillId) ?? [];
  return content.actions.all().filter((a) => a.skillId === skillId);
}
