import type { StatId } from '../stats/types';
import type {
  GemModTemplate,
  Scaling,
  SkillGemDef,
  SpiritGemDef,
  SupportGemDef,
  WeaponClass,
} from './types';

/**
 * Phase 5 gems: 60 skills, 45 supports, 12 spirit gems. Values scale with gem
 * level (1–20) as base + perLevel × (level − 1). Names live in i18n.
 */
const S = (base: number, perLevel = 0): Scaling => ({ base, perLevel });
const mod = (
  stat: StatId,
  kind: GemModTemplate['kind'],
  base: number,
  perLevel = 0,
  tags?: string[],
  condition?: string,
): GemModTemplate => ({
  stat,
  kind,
  value: S(base, perLevel),
  tags,
  condition,
});
const q = (
  stat: StatId,
  kind: GemModTemplate['kind'],
  perQuality: number,
  tags?: string[],
): GemModTemplate => ({
  stat,
  kind,
  value: S(perQuality),
  tags,
});

const MELEE: Record<string, true> = {
  mace: true,
  axe: true,
  sword: true,
  dagger: true,
  claw: true,
  flail: true,
  sceptre: true,
  staff: true,
  quarterstaff: true,
};

type AttackOpts = Partial<
  Omit<SkillGemDef, 'id' | 'kind' | 'tier' | 'skillKind' | 'weapons' | 'tags' | 'quality'>
> & {
  extraTags?: string[];
  quality?: GemModTemplate;
};

function attack(
  id: string,
  tier: number,
  weapons: WeaponClass[],
  eff: number,
  o: AttackOpts = {},
): SkillGemDef {
  const melee = weapons.every((w) => MELEE[w]);
  const { extraTags = [], quality, ...rest } = o;
  return {
    id: `gem.${id}`,
    kind: 'skill',
    tier,
    skillKind: 'attack',
    tags: ['attack', 'damaging', melee ? 'melee' : 'projectile', ...weapons, ...extraTags],
    weapons,
    effectiveness: S(eff, eff * 0.06),
    manaCost: S(2, 0.2),
    quality: quality ?? q('damage', 'increased', 1),
    ...rest,
  };
}

type SpellOpts = Partial<
  Omit<SkillGemDef, 'id' | 'kind' | 'tier' | 'skillKind' | 'tags' | 'quality'>
> & {
  extraTags?: string[];
  quality?: GemModTemplate;
};

function spell(
  id: string,
  tier: number,
  element: 'fire' | 'cold' | 'lightning' | 'chaos',
  dmg: [number, number],
  castMs: number,
  crit: number,
  o: SpellOpts = {},
): SkillGemDef {
  const { extraTags = [], quality, ...rest } = o;
  return {
    id: `gem.${id}`,
    kind: 'skill',
    tier,
    skillKind: 'spell',
    tags: [
      'spell',
      'damaging',
      element,
      ...(element === 'chaos' ? [] : ['elemental']),
      ...extraTags,
    ],
    baseDamage: { [element]: dmg },
    damageGrowth: 0.35,
    castTimeMs: castMs,
    critChance: crit,
    manaCost: S(4, 0.4),
    quality: quality ?? q('critChance', 'increased', 1),
    ...rest,
  };
}

export const SKILL_GEMS: SkillGemDef[] = [
  // ---- Maces
  attack('crushing_blow', 1, ['mace', 'flail'], 1.6, {
    mods: [mod('attackSpeed', 'more', -10)],
    chargeGain: { type: 'endurance', chance: 0.3, on: 'kill' },
  }),
  attack('tremor_slam', 2, ['mace'], 1.3, {
    repeats: { count: 1, fraction: 0.4 },
    mods: [mod('attackSpeed', 'more', -15)],
  }),
  attack('molten_hammer', 3, ['mace'], 1.2, {
    conversion: { 'physical.fire': 50 },
    extraTags: ['fire'],
    mods: [mod('ailmentChance.ignite', 'flat', 15, 0.5)],
    quality: q('ailmentChance.ignite', 'flat', 0.5),
  }),
  // ---- Axes
  attack('hew', 1, ['axe'], 1.4, {
    ailmentChance: { bleed: 25 },
    quality: q('ailmentChance.bleed', 'flat', 0.5),
  }),
  attack('rending_chop', 2, ['axe', 'sword'], 1.2, {
    ailmentChance: { bleed: 15 },
    mods: [mod('ailmentEffect.bleed', 'increased', 20, 1)],
    chargeGain: { type: 'frenzy', chance: 0.4, on: 'kill' },
  }),
  attack('berserk_swing', 3, ['axe', 'mace'], 1.0, {
    mods: [mod('damage', 'more', 30, 1, undefined, 'lowLife')],
    quality: q('attackSpeed', 'increased', 0.5),
  }),
  // ---- Swords
  attack('duelists_cut', 1, ['sword'], 1.1, {
    mods: [mod('critChance', 'increased', 30, 2)],
    chargeGain: { type: 'power', chance: 0.3, on: 'crit' },
  }),
  attack('bleeding_edge', 2, ['sword', 'axe'], 0.9, {
    ailmentChance: { bleed: 40 },
    mods: [mod('attackSpeed', 'more', 20)],
    quality: q('ailmentChance.bleed', 'flat', 0.5),
  }),
  attack('sundering_blade', 3, ['sword', 'mace', 'axe'], 1.3, {
    debuff: { durationMs: 4000, armourBreak: S(30, 1) },
  }),
  // ---- Daggers
  attack('puncture', 1, ['dagger'], 1.0, {
    ailmentChance: { poison: 40 },
    quality: q('ailmentChance.poison', 'flat', 0.5),
  }),
  attack('shadow_stab', 2, ['dagger', 'claw'], 1.2, {
    mods: [mod('critChance', 'increased', 60, 3), mod('critBonus', 'flat', 30, 1)],
  }),
  attack('viper_flurry', 3, ['dagger', 'claw'], 0.7, {
    mods: [mod('attackSpeed', 'more', 30)],
    ailmentChance: { poison: 25 },
    combo: 'builder',
    quality: q('attackSpeed', 'increased', 0.5),
  }),
  // ---- Claws
  attack('rake', 1, ['claw', 'dagger'], 0.8, {
    mods: [mod('attackSpeed', 'more', 20)],
    combo: 'builder',
    quality: q('attackSpeed', 'increased', 0.5),
  }),
  attack('talon_finisher', 2, ['claw', 'quarterstaff'], 1.0, { combo: 'finisher' }),
  attack('venom_swipe', 3, ['claw'], 0.9, {
    conversion: { 'physical.chaos': 30 },
    extraTags: ['chaos'],
    ailmentChance: { poison: 30 },
  }),
  // ---- Flails
  attack('chain_lash', 1, ['flail'], 0.65, { repeats: { count: 1, fraction: 1 } }),
  attack('holy_flail', 2, ['flail', 'sceptre'], 1.1, {
    conversion: { 'physical.lightning': 40 },
    extraTags: ['lightning'],
    mods: [mod('ailmentChance.shock', 'flat', 10, 0.5)],
  }),
  attack('penitent_swing', 3, ['flail', 'mace'], 1.3, {
    chargeGain: { type: 'endurance', chance: 0.2, on: 'hit' },
    chargeFinisher: 'endurance',
  }),
  // ---- Sceptres
  attack('smite', 1, ['sceptre', 'mace'], 1.2, {
    mods: [mod('gainAs.physical.lightning', 'flat', 30, 1)],
    extraTags: ['lightning'],
  }),
  attack('consecrated_strike', 2, ['sceptre', 'flail'], 1.0, {
    debuff: { durationMs: 4000, damageTaken: S(10, 0.5) },
  }),
  attack('zealous_blow', 3, ['sceptre'], 1.1, {
    chargeGain: { type: 'power', chance: 0.5, on: 'kill' },
    chargeFinisher: 'power',
  }),
  // ---- Bows
  attack('power_shot', 1, ['bow', 'crossbow'], 1.6, {
    mods: [mod('attackSpeed', 'more', -15), mod('critChance', 'increased', 40, 2)],
  }),
  attack('rapid_volley', 2, ['bow'], 0.75, {
    mods: [mod('attackSpeed', 'more', 30)],
    chargeGain: { type: 'frenzy', chance: 0.1, on: 'hit' },
    quality: q('attackSpeed', 'increased', 0.5),
  }),
  attack('barbed_arrow', 3, ['bow'], 1.1, {
    ailmentChance: { bleed: 35 },
    quality: q('ailmentChance.bleed', 'flat', 0.5),
  }),
  // ---- Crossbows
  attack('bolt_burst', 1, ['crossbow'], 0.45, { repeats: { count: 2, fraction: 1 } }),
  attack('explosive_bolt', 2, ['crossbow'], 1.2, {
    conversion: { 'physical.fire': 50 },
    extraTags: ['fire'],
    mods: [mod('ailmentChance.ignite', 'flat', 20, 0.5)],
  }),
  attack('piercing_round', 3, ['crossbow', 'bow'], 1.4, {
    armourPen: 0.5,
    quality: q('damage', 'increased', 1, ['physical']),
  }),
  // ---- Staves
  attack('arcane_strike', 1, ['staff', 'quarterstaff'], 1.2, {
    mods: [mod('gainAs.physical.lightning', 'flat', 30, 1)],
    extraTags: ['lightning'],
  }),
  attack('ember_sweep', 2, ['staff'], 1.1, {
    conversion: { 'physical.fire': 50 },
    extraTags: ['fire'],
  }),
  attack('frost_slam', 3, ['staff', 'mace'], 1.2, {
    conversion: { 'physical.cold': 60 },
    extraTags: ['cold'],
    mods: [mod('ailmentEffect.chill', 'increased', 30, 1)],
  }),
  // ---- Quarterstaves
  attack('flowing_strikes', 1, ['quarterstaff'], 0.7, {
    mods: [mod('attackSpeed', 'more', 25)],
    combo: 'builder',
    quality: q('attackSpeed', 'increased', 0.5),
  }),
  attack('storm_palm', 2, ['quarterstaff', 'claw'], 0.9, {
    conversion: { 'physical.lightning': 60 },
    extraTags: ['lightning'],
    combo: 'finisher',
  }),
  attack('whirling_staff', 3, ['quarterstaff'], 0.85, {
    repeats: { count: 1, fraction: 1 },
    chargeGain: { type: 'frenzy', chance: 0.25, on: 'kill' },
  }),
  // ---- Wands
  attack('spark_shot', 1, ['wand'], 1.3, {
    conversion: { 'physical.lightning': 100 },
    extraTags: ['lightning'],
  }),
  attack('chilling_bolt', 2, ['wand'], 1.3, {
    conversion: { 'physical.cold': 100 },
    extraTags: ['cold'],
  }),
  attack('withering_ray', 3, ['wand'], 1.2, {
    conversion: { 'physical.chaos': 100 },
    extraTags: ['chaos'],
    ailmentChance: { poison: 30 },
  }),

  // ---- Spells
  spell('ember_orb', 1, 'fire', [7, 11], 900, 6, {
    mods: [mod('ailmentChance.ignite', 'flat', 10, 0.5)],
    quality: q('ailmentChance.ignite', 'flat', 0.5),
  }),
  spell('frost_lance', 1, 'cold', [6, 10], 1000, 6, {
    mods: [mod('ailmentEffect.freeze', 'increased', 50, 2)],
  }),
  spell('arc_bolt', 1, 'lightning', [2, 18], 800, 6, {
    quality: q('ailmentChance.shock', 'flat', 0.5),
  }),
  spell('blight_bolt', 2, 'chaos', [5, 9], 1000, 5, {
    ailmentChance: { poison: 40 },
    quality: q('ailmentChance.poison', 'flat', 0.5),
  }),
  spell('flame_torrent', 2, 'fire', [10, 16], 1200, 7),
  spell('glacial_spike', 2, 'cold', [12, 18], 1300, 6, {
    mods: [mod('ailmentEffect.freeze', 'increased', 100, 3)],
  }),
  spell('storm_call', 3, 'lightning', [4, 40], 1100, 7, {
    mods: [mod('ailmentChance.shock', 'flat', 20, 0.5)],
  }),
  spell('soul_rend', 3, 'chaos', [14, 20], 1200, 6, { mods: [mod('lifeLeech', 'flat', 2)] }),
  spell('meteor_shard', 4, 'fire', [30, 45], 2000, 9, { manaCost: S(8, 0.7) }),
  spell('comet_of_rime', 4, 'cold', [25, 35], 1600, 7, { manaCost: S(7, 0.6) }),
  spell('thunderclap', 5, 'lightning', [8, 80], 1400, 8, { manaCost: S(8, 0.7) }),
  spell('void_nova', 5, 'chaos', [30, 40], 1500, 6, {
    manaCost: S(8, 0.7),
    ailmentChance: { poison: 30 },
  }),

  // ---- Minions
  {
    id: 'gem.raise_skeletons',
    kind: 'skill',
    tier: 1,
    skillKind: 'minion',
    tags: ['minion', 'physical'],
    manaCost: S(0),
    minion: {
      persistent: true,
      count: 2,
      spirit: 25,
      life: S(30, 14),
      damage: S(3, 0.9),
      attackIntervalMs: 1400,
      damageType: 'physical',
      threat: 60,
    },
    quality: q('minionLife', 'increased', 1),
  },
  {
    id: 'gem.spectral_wolves',
    kind: 'skill',
    tier: 2,
    skillKind: 'minion',
    tags: ['minion', 'physical'],
    manaCost: S(8, 0.5),
    cooldownMs: 8000,
    minion: {
      persistent: false,
      count: 2,
      durationMs: 10_000,
      life: S(25, 10),
      damage: S(4, 1.2),
      attackIntervalMs: 900,
      damageType: 'physical',
      threat: 50,
    },
    quality: q('damage', 'increased', 1, ['minion']),
  },
  {
    id: 'gem.beast_companion',
    kind: 'skill',
    tier: 2,
    skillKind: 'minion',
    tags: ['minion', 'physical'],
    manaCost: S(0),
    minion: {
      persistent: true,
      count: 1,
      spirit: 30,
      life: S(60, 25),
      damage: S(6, 1.8),
      attackIntervalMs: 1100,
      damageType: 'physical',
      threat: 80,
    },
    quality: q('minionAttackSpeed', 'increased', 0.5),
  },
  {
    id: 'gem.raise_wraith',
    kind: 'skill',
    tier: 3,
    skillKind: 'minion',
    tags: ['minion', 'lightning'],
    manaCost: S(0),
    minion: {
      persistent: true,
      count: 1,
      spirit: 30,
      life: S(25, 10),
      damage: S(7, 2.2),
      attackIntervalMs: 1300,
      damageType: 'lightning',
      threat: 30,
    },
    quality: q('damage', 'increased', 1, ['minion']),
  },
  {
    id: 'gem.ember_sprites',
    kind: 'skill',
    tier: 3,
    skillKind: 'minion',
    tags: ['minion', 'fire'],
    manaCost: S(8, 0.5),
    cooldownMs: 6000,
    minion: {
      persistent: false,
      count: 3,
      durationMs: 6000,
      life: S(10, 4),
      damage: S(3, 0.7),
      attackIntervalMs: 800,
      damageType: 'fire',
      threat: 20,
    },
    quality: q('damage', 'increased', 1, ['minion']),
  },
  {
    id: 'gem.bone_golem',
    kind: 'skill',
    tier: 4,
    skillKind: 'minion',
    tags: ['minion', 'physical'],
    manaCost: S(0),
    minion: {
      persistent: true,
      count: 1,
      spirit: 40,
      life: S(150, 60),
      damage: S(12, 3.2),
      attackIntervalMs: 1700,
      damageType: 'physical',
      threat: 200,
    },
    quality: q('minionLife', 'increased', 1),
  },

  // ---- Curses
  {
    id: 'gem.elemental_weakness',
    kind: 'skill',
    tier: 2,
    skillKind: 'curse',
    tags: ['curse'],
    manaCost: S(6, 0.3),
    cooldownMs: 1000,
    debuff: { durationMs: 8000, resistDown: S(15, 1) },
    quality: q('curseEffect', 'increased', 0.5),
  },
  {
    id: 'gem.fragile_mark',
    kind: 'skill',
    tier: 2,
    skillKind: 'curse',
    tags: ['curse'],
    manaCost: S(6, 0.3),
    cooldownMs: 1000,
    debuff: { durationMs: 8000, damageTaken: S(10, 0.5) },
    quality: q('curseEffect', 'increased', 0.5),
  },
  {
    id: 'gem.lethargy',
    kind: 'skill',
    tier: 3,
    skillKind: 'curse',
    tags: ['curse'],
    manaCost: S(6, 0.3),
    cooldownMs: 1000,
    debuff: { durationMs: 8000, slow: S(15, 0.5) },
    quality: q('curseEffect', 'increased', 0.5),
  },

  // ---- Warcries / buffs
  {
    id: 'gem.rallying_cry',
    kind: 'skill',
    tier: 1,
    skillKind: 'warcry',
    tags: ['warcry'],
    manaCost: S(8),
    cooldownMs: 8000,
    buff: {
      durationMs: 6000,
      mods: [mod('armour', 'more', 20, 1)],
      charges: { type: 'endurance', count: 3 },
    },
    quality: q('cooldownRecovery', 'increased', 1),
  },
  {
    id: 'gem.battle_fury',
    kind: 'skill',
    tier: 3,
    skillKind: 'warcry',
    tags: ['warcry'],
    manaCost: S(10),
    cooldownMs: 10_000,
    buff: {
      durationMs: 6000,
      mods: [mod('attackSpeed', 'increased', 15, 1), mod('damage', 'more', 10)],
    },
    quality: q('buffEffect', 'increased', 1),
  },

  // ---- Guard
  {
    id: 'gem.ward_of_ash',
    kind: 'skill',
    tier: 2,
    skillKind: 'guard',
    tags: ['guard'],
    manaCost: S(6, 0.3),
    cooldownMs: 6000,
    guard: { absorb: S(40, 15), durationMs: 4000 },
    quality: q('guardEffect', 'increased', 1),
  },
];

// ---------------------------------------------------------------- Supports

const DAMAGING = ['damaging'];
function support(
  id: string,
  tier: number,
  requiresAny: string[],
  mods: GemModTemplate[],
  o: Partial<Pick<SupportGemDef, 'manaMult' | 'flags' | 'quality'>> = {},
): SupportGemDef {
  return {
    id: `gem.${id}`,
    kind: 'support',
    tier,
    requiresAny,
    mods,
    manaMult: o.manaMult ?? 1.2,
    flags: o.flags,
    quality: o.quality ?? q('damage', 'increased', 0.5),
  };
}

export const SUPPORT_GEMS: SupportGemDef[] = [
  support('brutal_force', 1, DAMAGING, [mod('damage', 'more', 20, 1, ['physical'])]),
  support('searing_heat', 1, DAMAGING, [mod('damage', 'more', 15, 1, ['fire'])]),
  support('biting_frost', 1, DAMAGING, [mod('damage', 'more', 15, 1, ['cold'])]),
  support('charged_force', 1, DAMAGING, [mod('damage', 'more', 15, 1, ['lightning'])]),
  support('corrupting_touch', 2, DAMAGING, [mod('damage', 'more', 15, 1, ['chaos'])]),
  support('elemental_focus', 2, DAMAGING, [mod('damage', 'more', 12, 1, ['elemental'])]),
  support('melee_mastery', 1, ['melee'], [mod('damage', 'more', 15, 1)]),
  support('ranged_mastery', 1, ['projectile'], [mod('damage', 'more', 15, 1)]),
  support('echoing_cast', 3, ['spell'], [], {
    manaMult: 1.4,
    flags: { repeat: { count: 1, fraction: 0.6 } },
  }),
  support('concentrated_power', 2, DAMAGING, [
    mod('damage', 'more', 25, 1),
    mod('attackSpeed', 'more', -15),
    mod('castSpeed', 'more', -15),
  ]),
  support('executioner', 3, DAMAGING, [], {
    flags: { execute: { belowLifePct: 35, more: S(40, 1.5) } },
  }),
  support('added_fire', 1, DAMAGING, [
    mod('added.fire.min', 'flat', 2, 1.2),
    mod('added.fire.max', 'flat', 4, 2),
  ]),
  support('added_cold', 1, DAMAGING, [
    mod('added.cold.min', 'flat', 2, 1.1),
    mod('added.cold.max', 'flat', 4, 1.9),
  ]),
  support('added_lightning', 1, DAMAGING, [
    mod('added.lightning.min', 'flat', 1, 0.3),
    mod('added.lightning.max', 'flat', 6, 3),
  ]),
  support('added_chaos', 2, DAMAGING, [
    mod('added.chaos.min', 'flat', 2, 1),
    mod('added.chaos.max', 'flat', 3, 1.6),
  ]),
  support('fire_infusion', 2, DAMAGING, [
    mod('convert.physical.fire', 'flat', 50),
    mod('damage', 'more', 5, 0.5, ['fire']),
  ]),
  support('frost_infusion', 2, DAMAGING, [
    mod('convert.physical.cold', 'flat', 50),
    mod('damage', 'more', 5, 0.5, ['cold']),
  ]),
  support('storm_infusion', 2, DAMAGING, [
    mod('convert.physical.lightning', 'flat', 50),
    mod('damage', 'more', 5, 0.5, ['lightning']),
  ]),
  support('swift_assault', 1, ['attack'], [mod('attackSpeed', 'increased', 20, 0.5)], {
    quality: q('attackSpeed', 'increased', 0.5),
  }),
  support('quickened_casting', 1, ['spell'], [mod('castSpeed', 'increased', 20, 0.5)], {
    quality: q('castSpeed', 'increased', 0.5),
  }),
  support('flurry', 2, ['attack'], [mod('attackSpeed', 'more', 25), mod('damage', 'more', -15)]),
  support('keen_edge', 1, DAMAGING, [mod('critChance', 'increased', 60, 3)], {
    quality: q('critChance', 'increased', 1),
  }),
  support('deadly_precision', 2, DAMAGING, [mod('critBonus', 'flat', 30, 1)]),
  support('opportunist', 3, DAMAGING, [mod('critChance', 'increased', 20, 1)], {
    flags: { chargeGain: { type: 'power', chance: 0.5, on: 'crit' } },
  }),
  support(
    'kindle',
    1,
    DAMAGING,
    [mod('ailmentChance.ignite', 'flat', 25), mod('ailmentEffect.ignite', 'increased', 20, 1)],
    { quality: q('ailmentEffect.ignite', 'increased', 0.5) },
  ),
  support(
    'hemorrhage',
    1,
    DAMAGING,
    [mod('ailmentChance.bleed', 'flat', 25), mod('ailmentEffect.bleed', 'increased', 20, 1)],
    { quality: q('ailmentEffect.bleed', 'increased', 0.5) },
  ),
  support(
    'venom',
    1,
    DAMAGING,
    [mod('ailmentChance.poison', 'flat', 40), mod('ailmentEffect.poison', 'increased', 15, 1)],
    { quality: q('ailmentEffect.poison', 'increased', 0.5) },
  ),
  support('overcharge', 2, DAMAGING, [
    mod('ailmentChance.shock', 'flat', 10),
    mod('ailmentEffect.shock', 'increased', 20, 1),
  ]),
  support('deep_freeze', 2, DAMAGING, [
    mod('ailmentEffect.freeze', 'increased', 30, 1),
    mod('ailmentEffect.chill', 'increased', 20, 1),
  ]),
  support('lingering_pain', 2, DAMAGING, [mod('dotDamage', 'more', 20, 1)]),
  support('life_drinker', 2, DAMAGING, [mod('lifeLeech', 'flat', 3)]),
  support('efficient_casting', 1, ['attack', 'spell', 'minion', 'curse', 'warcry', 'guard'], [], {
    manaMult: 0.7,
    quality: q('manaCost', 'increased', -0.5),
  }),
  support('endurance_on_hit', 2, DAMAGING, [], {
    flags: { chargeGain: { type: 'endurance', chance: 0.15, on: 'hit' } },
  }),
  support('frenzy_on_kill', 2, DAMAGING, [], {
    flags: { chargeGain: { type: 'frenzy', chance: 0.5, on: 'kill' } },
  }),
  support('power_on_crit', 3, DAMAGING, [], {
    flags: { chargeGain: { type: 'power', chance: 0.3, on: 'crit' } },
  }),
  support('flow_state', 2, ['attack'], [mod('attackSpeed', 'increased', 10, 0.5)], {
    flags: { comboBuilder: true },
  }),
  support('cast_on_crit', 3, ['spell'], [mod('damage', 'more', -20)], {
    manaMult: 1,
    flags: { trigger: { on: 'crit', cooldownMs: 500 } },
  }),
  support('cast_when_hit', 3, ['spell', 'curse', 'guard', 'warcry'], [], {
    manaMult: 1,
    flags: { trigger: { on: 'hit', cooldownMs: 2000 } },
  }),
  support('minion_might', 1, ['minion'], [mod('damage', 'more', 25, 1, ['minion'])]),
  support('minion_fortitude', 1, ['minion'], [mod('minionLife', 'increased', 30, 2)]),
  support('minion_frenzy', 2, ['minion'], [mod('minionAttackSpeed', 'increased', 20, 1)]),
  support('taunting_minions', 2, ['minion'], [mod('minionThreat', 'increased', 100)]),
  support('hex_mastery', 2, ['curse'], [mod('curseEffect', 'increased', 20, 1)]),
  support(
    'battle_cadence',
    2,
    ['warcry', 'guard'],
    [mod('buffEffect', 'increased', 20, 1), mod('cooldownRecovery', 'increased', 20, 1)],
  ),
  support('penetrating_force', 3, DAMAGING, [
    mod('penetration.fire', 'flat', 10, 0.5),
    mod('penetration.cold', 'flat', 10, 0.5),
    mod('penetration.lightning', 'flat', 10, 0.5),
  ]),
];

// ---------------------------------------------------------------- Spirit gems

function spirit(
  id: string,
  tier: number,
  cost: number,
  mods: GemModTemplate[],
  quality = q('damage', 'increased', 0.5),
): SpiritGemDef {
  return { id: `gem.${id}`, kind: 'spirit', tier, spirit: cost, mods, quality };
}

export const SPIRIT_GEMS: SpiritGemDef[] = [
  spirit('kindled_fury', 1, 30, [
    mod('added.fire.min', 'flat', 2, 1),
    mod('added.fire.max', 'flat', 4, 1.8),
  ]),
  spirit('storm_mantle', 1, 30, [
    mod('added.lightning.min', 'flat', 1, 0.3),
    mod('added.lightning.max', 'flat', 6, 2.6),
  ]),
  spirit('frost_shroud', 2, 30, [mod('gainAs.physical.cold', 'flat', 8, 0.4)]),
  spirit('iron_bulwark', 1, 30, [mod('armour', 'increased', 20, 2)], q('armour', 'increased', 0.5)),
  spirit(
    'shadow_veil',
    1,
    30,
    [mod('evasion', 'increased', 20, 2)],
    q('evasion', 'increased', 0.5),
  ),
  spirit(
    'arcane_aegis',
    2,
    30,
    [mod('energyShield', 'increased', 15, 1.5)],
    q('energyShield', 'increased', 0.5),
  ),
  spirit('elemental_ward', 3, 40, [
    mod('resist.fire', 'flat', 10, 0.5),
    mod('resist.cold', 'flat', 10, 0.5),
    mod('resist.lightning', 'flat', 10, 0.5),
  ]),
  spirit('clear_mind', 1, 20, [mod('manaRegenPct', 'increased', 30, 2)]),
  spirit('quickening', 3, 40, [
    mod('attackSpeed', 'increased', 8, 0.4),
    mod('castSpeed', 'increased', 8, 0.4),
  ]),
  spirit('hunters_focus', 2, 30, [
    mod('accuracy', 'flat', 100, 10),
    mod('critChance', 'increased', 20, 1),
  ]),
  spirit('herald_of_cinders', 2, 30, [
    mod('ailmentChance.ignite', 'flat', 10),
    mod('ailmentEffect.ignite', 'increased', 20, 1),
  ]),
  spirit('dominion', 2, 30, [
    mod('damage', 'increased', 15, 1, ['minion']),
    mod('minionLife', 'increased', 15, 1),
  ]),
];

export const ALL_GEMS = [...SKILL_GEMS, ...SUPPORT_GEMS, ...SPIRIT_GEMS];

/** Uncut gem item kinds. */
export const UNCUT_KIND: Record<string, 'skill' | 'support' | 'spirit'> = {};
for (let t = 1; t <= 5; t++) {
  UNCUT_KIND[`item.uncut_skill_gem_t${t}`] = 'skill';
  UNCUT_KIND[`item.uncut_support_gem_t${t}`] = 'support';
  UNCUT_KIND[`item.uncut_spirit_gem_t${t}`] = 'spirit';
}

export function scaled(s: Scaling, level: number): number {
  return s.base + s.perLevel * (level - 1);
}
