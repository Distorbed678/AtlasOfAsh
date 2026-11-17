import { BASES, BASE_CRAFT, baseInputs } from './bases';
import {
  ARCANE_DUST,
  BAR_IDS,
  BAR_INPUTS,
  CLOTH_IDS,
  CUT_GEM,
  FIBRE_IDS,
  HIDE_IDS,
  INFUSION_INPUTS,
  INFUSION_LEVEL,
  INFUSIONS,
  LEATHER_IDS,
  PLANK_IDS,
  REAGENTS,
} from './materials';
import { LOG_IDS, TIER_LEVELS, TIER_XP } from './skills';
import type { CraftAction, SkillDef, SkillId } from './types';
import { UNIQUE_RECIPES, UNIQUES } from './uniques';

const tiers = [...Array(10).keys()];
export const REFINE_DURATION_MS = [3000, 3300, 3600, 4000, 4300, 4600, 5000, 5300, 5600, 6000];
export const GEAR_DURATION_MS = tiers.map((i) => 8000 + Math.round(i * 780));
const refineXp = (i: number) => Math.max(1, Math.round(TIER_XP[i]! * 0.7));
const gearXp = (i: number) => Math.round(TIER_XP[i]! * 2.5);
const slug = (id: string) => id.slice(id.indexOf('.') + 1);

export const ARTISAN_SKILLS: SkillDef[] = (
  [
    'skill.smithing',
    'skill.woodworking',
    'skill.tailoring',
    'skill.jewelcrafting',
    'skill.enchanting',
    'skill.gemcutting',
  ] as SkillId[]
).map((id) => ({ id, kind: 'artisan', rareFinds: [] }));

function refine(
  verb: string,
  skillId: SkillId,
  group: string,
  i: number,
  outId: string,
  inputs: Record<string, number>,
): CraftAction {
  return {
    id: `action.${verb}_${slug(outId)}`,
    skillId,
    type: 'craft',
    group,
    tier: i + 1,
    level: TIER_LEVELS[i]!,
    durationMs: REFINE_DURATION_MS[i]!,
    xp: refineXp(i),
    inputs,
    output: { kind: 'item', itemId: outId, qty: 1 },
  };
}

const refining: CraftAction[] = [
  ...tiers.map((i) => refine('smelt', 'skill.smithing', 'bars', i, BAR_IDS[i]!, BAR_INPUTS[i]!)),
  ...tiers.map((i) =>
    refine('plane', 'skill.woodworking', 'planks', i, PLANK_IDS[i]!, { [LOG_IDS[i]!]: 2 }),
  ),
  ...tiers.map((i) =>
    refine('weave', 'skill.tailoring', 'cloth', i, CLOTH_IDS[i]!, { [FIBRE_IDS[i]!]: 3 }),
  ),
  ...tiers.map((i) =>
    refine('tan', 'skill.tailoring', 'leather', i, LEATHER_IDS[i]!, { [HIDE_IDS[i]!]: 1 }),
  ),
  {
    id: 'action.cut_gem',
    skillId: 'skill.jewelcrafting',
    type: 'craft',
    group: 'gems',
    tier: 1,
    level: 1,
    durationMs: 4000,
    xp: 8,
    inputs: { 'item.gem_fragment': 1 },
    output: { kind: 'item', itemId: CUT_GEM, qty: 1 },
  },
];

const gear: CraftAction[] = BASES.map((b) => {
  const i = b.tier - 1;
  const spec = BASE_CRAFT[b.id]!;
  return {
    id: `action.craft_${slug(b.id)}`,
    skillId: spec.skillId,
    type: 'craft',
    group: spec.group,
    tier: b.tier,
    level: TIER_LEVELS[i]!,
    durationMs: GEAR_DURATION_MS[i]!,
    xp: gearXp(i),
    inputs: baseInputs(b.id),
    output: { kind: 'gear', baseId: b.id },
  };
});

const uniques: CraftAction[] = UNIQUES.map((u) => {
  const r = UNIQUE_RECIPES[u.id]!;
  const tier = BASES.find((b) => b.id === u.baseId)!.tier;
  return {
    id: `action.craft_${slug(u.id)}`,
    skillId: r.skillId,
    type: 'craft',
    group: 'uniques',
    tier,
    level: r.level,
    durationMs: 20_000,
    xp: TIER_XP[tier - 1]! * 10,
    inputs: r.inputs,
    output: { kind: 'unique', uniqueId: u.id },
  };
});

const reagents: CraftAction[] = [
  ...REAGENTS.map((r) => ({
    id: `action.make_${slug(r.id)}`,
    skillId: 'skill.enchanting' as const,
    type: 'craft' as const,
    group: 'reagents',
    tier: Math.min(10, Math.floor(r.level / 10) + 1),
    level: r.level,
    durationMs: 4000 + r.level * 40,
    xp: Math.round(5 + r.level * 1.2),
    inputs: r.inputs,
    output: { kind: 'item' as const, itemId: r.id, qty: 1 },
  })),
  ...INFUSIONS.map((r) => ({
    id: `action.make_${slug(r.id)}`,
    skillId: 'skill.enchanting' as const,
    type: 'craft' as const,
    group: 'infusions',
    tier: 8,
    level: INFUSION_LEVEL,
    durationMs: 8000,
    xp: 100,
    inputs: INFUSION_INPUTS,
    output: { kind: 'item' as const, itemId: r.id, qty: 1 },
  })),
];

export const ARTISAN_ACTIONS: CraftAction[] = [...refining, ...gear, ...uniques, ...reagents];

/** The arcane dust a disenchanted item yields. */
export const DUST_ITEM = ARCANE_DUST;
