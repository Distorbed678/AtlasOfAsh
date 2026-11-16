import type { SkillStats, WeaponStats } from '../engine/stats/damage';
import { AILMENTS, DAMAGE_TYPES, RESIST_TYPES, type StatId } from '../engine/stats/types';
import type { BenchMod } from './bench';

/** Dev-only test weapons and skills (not game content; real ones arrive in Phases 3 and 5). */
export const BENCH_WEAPONS: (WeaponStats & { label: string })[] = [
  {
    id: 'bench.mace',
    label: 'Test mace (10–20 phys, 1.5/s, 5%)',
    damage: { physical: { min: 10, max: 20 } },
    attacksPerSecond: 1.5,
    critChance: 5,
    tags: ['mace', 'melee'],
  },
  {
    id: 'bench.bow',
    label: 'Test bow (8–24 phys, 1.3/s, 6%)',
    damage: { physical: { min: 8, max: 24 } },
    attacksPerSecond: 1.3,
    critChance: 6,
    tags: ['bow', 'projectile'],
  },
  {
    id: 'bench.claw',
    label: 'Test claw (6–14 phys, 1.7/s, 7%)',
    damage: { physical: { min: 6, max: 14 } },
    attacksPerSecond: 1.7,
    critChance: 7,
    tags: ['claw', 'melee'],
  },
];

export const BENCH_SKILLS: (SkillStats & { label: string })[] = [
  {
    id: 'bench.heavy_strike',
    label: 'Heavy Strike (attack, 150% damage)',
    tags: ['attack', 'melee'],
    damageEffectiveness: 1.5,
  },
  {
    id: 'bench.volley',
    label: 'Volley (attack, 85% damage)',
    tags: ['attack', 'projectile'],
    damageEffectiveness: 0.85,
  },
  {
    id: 'bench.venom_slash',
    label: 'Venom Slash (attack, 30% phys → chaos, 40% poison)',
    tags: ['attack', 'melee'],
    damageEffectiveness: 1,
    conversion: { 'physical.chaos': 30 },
    ailmentChance: { poison: 40 },
  },
  {
    id: 'bench.fire_bolt',
    label: 'Fire Bolt (spell, 12–20 fire, 1.0s)',
    tags: ['spell', 'projectile'],
    damageEffectiveness: 1,
    baseDamage: { fire: { min: 12, max: 20 } },
    castTimeMs: 1000,
    critChance: 6,
  },
  {
    id: 'bench.frost_lance',
    label: 'Frost Lance (spell, 20–30 cold, 1.2s)',
    tags: ['spell', 'projectile'],
    damageEffectiveness: 1.2,
    baseDamage: { cold: { min: 20, max: 30 } },
    castTimeMs: 1200,
    critChance: 7,
  },
  {
    id: 'bench.arc_pulse',
    label: 'Arc Pulse (spell, 4–40 lightning, 0.8s)',
    tags: ['spell'],
    damageEffectiveness: 0.8,
    baseDamage: { lightning: { min: 4, max: 40 } },
    castTimeMs: 800,
    critChance: 6,
  },
];

/** Every stat id, for the modifier editor. */
export const ALL_STATS: StatId[] = [
  'life',
  'mana',
  'spirit',
  'energyShield',
  'armour',
  'evasion',
  'accuracy',
  'str',
  'dex',
  'int',
  'lifeRegenPct',
  'lifeRegen',
  'manaRegenPct',
  'block',
  'maxBlock',
  'damage',
  'critChance',
  'critBonus',
  'attackSpeed',
  'castSpeed',
  'dotDamage',
  'lifeLeech',
  'leechCap',
  'esRechargeRate',
  'esRechargeStart',
  'damageTaken',
  ...RESIST_TYPES.flatMap((r) => [`resist.${r}`, `maxResist.${r}`, `penetration.${r}`] as StatId[]),
  ...DAMAGE_TYPES.flatMap((d) => [`added.${d}.min`, `added.${d}.max`] as StatId[]),
  ...DAMAGE_TYPES.flatMap((from) =>
    DAMAGE_TYPES.filter((to) => to !== from).flatMap((to) => [`gainAs.${from}.${to}`] as StatId[]),
  ),
  ...DAMAGE_TYPES.flatMap((from, i) =>
    DAMAGE_TYPES.slice(i + 1).map((to) => `convert.${from}.${to}` as StatId),
  ),
  ...AILMENTS.flatMap((a) => [`ailmentChance.${a}`, `ailmentEffect.${a}`] as StatId[]),
];

type Preset = { label: string; mods: Omit<BenchMod, 'id'>[] };

export const BENCH_PRESETS: Preset[] = [
  { label: '+50 Str', mods: [{ stat: 'str', kind: 'flat', value: 50, tags: '' }] },
  { label: '+100 life', mods: [{ stat: 'life', kind: 'flat', value: 100, tags: '' }] },
  {
    label: '+40% all resists',
    mods: (['fire', 'cold', 'lightning'] as const).map((r) => ({
      stat: `resist.${r}` as StatId,
      kind: 'flat' as const,
      value: 40,
      tags: '',
    })),
  },
  { label: '+500 armour', mods: [{ stat: 'armour', kind: 'flat', value: 500, tags: '' }] },
  {
    label: '+10–20 phys to attacks',
    mods: [
      { stat: 'added.physical.min', kind: 'flat', value: 10, tags: 'attack' },
      { stat: 'added.physical.max', kind: 'flat', value: 20, tags: 'attack' },
    ],
  },
  {
    label: '+100% physical damage',
    mods: [{ stat: 'damage', kind: 'increased', value: 100, tags: 'physical' }],
  },
  {
    label: '50% phys → fire',
    mods: [{ stat: 'convert.physical.fire', kind: 'flat', value: 50, tags: '' }],
  },
  {
    label: '+80% fire damage',
    mods: [{ stat: 'damage', kind: 'increased', value: 80, tags: 'fire' }],
  },
  {
    label: '30% more spell damage',
    mods: [{ stat: 'damage', kind: 'more', value: 30, tags: 'spell' }],
  },
  {
    label: '+100% crit chance',
    mods: [{ stat: 'critChance', kind: 'increased', value: 100, tags: '' }],
  },
  {
    label: '+15% attack speed',
    mods: [{ stat: 'attackSpeed', kind: 'increased', value: 15, tags: '' }],
  },
  {
    label: '25% chance to bleed',
    mods: [{ stat: 'ailmentChance.bleed', kind: 'flat', value: 25, tags: '' }],
  },
];
