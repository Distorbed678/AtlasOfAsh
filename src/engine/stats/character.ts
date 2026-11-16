import { CONTENT, type Content } from '../content';
import {
  ACCURACY_PER_DEX,
  ACCURACY_PER_LEVEL,
  BASE_CRIT_BONUS,
  BASE_LEECH_CAP_PCT,
  BASE_LIFE_REGEN_PCT,
  BASE_MANA_REGEN_PCT,
  BASE_MAX_BLOCK,
  BASE_MAX_RESIST,
  ES_RECHARGE_DELAY_S,
  ES_RECHARGE_PCT_PER_S,
  HARD_MAX_BLOCK,
  HARD_MAX_RESIST,
  LIFE_PER_5_STR,
  MANA_PER_5_INT,
  RESIST_PENALTY_PER_ACT,
} from './formulas';
import { ModSet, type QueryContext } from './modSet';
import {
  RESIST_TYPES,
  type Mod,
  type ModSource,
  type ResistType,
  type StatBreakdown,
} from './types';

export interface CharacterInput {
  classId: string;
  level: number;
  mods: readonly Mod[];
  /** Act bosses beaten (each lowers resistances by 10%). */
  actsCompleted?: number;
  conditions?: ReadonlySet<string>;
}

export interface ResistLine {
  type: ResistType;
  /** Uncapped resistance after the act penalty. */
  raw: number;
  max: number;
  /** Effective (capped) resistance. */
  value: number;
  breakdown: StatBreakdown;
  maxBreakdown: StatBreakdown;
}

export interface CharacterSheet {
  classId: string;
  level: number;
  mods: ModSet;
  ctx: QueryContext;
  str: StatBreakdown;
  dex: StatBreakdown;
  int: StatBreakdown;
  life: StatBreakdown;
  mana: StatBreakdown;
  spirit: StatBreakdown;
  energyShield: StatBreakdown;
  armour: StatBreakdown;
  evasion: StatBreakdown;
  accuracy: StatBreakdown;
  block: { value: number; max: number; breakdown: StatBreakdown; maxBreakdown: StatBreakdown };
  resists: Record<ResistType, ResistLine>;
  lifeRegenPerSec: number;
  lifeRegenPct: StatBreakdown;
  manaRegenPerSec: number;
  manaRegenPct: StatBreakdown;
  esRechargeDelaySec: number;
  esRechargePerSec: number;
  leechCapPct: StatBreakdown;
  critBonus: StatBreakdown;
  actPenalty: number;
}

const ATTRIBUTE_SOURCE: ModSource = { kind: 'attribute', id: 'attributes', label: 'Attributes' };

/**
 * Compute the full character sheet from class, level and every modifier.
 * Attribute bonuses are injected as their own sourced modifiers so the Codex
 * can show "+20 life from Strength".
 */
export function computeCharacter(
  input: CharacterInput,
  content: Content = CONTENT,
): CharacterSheet {
  const cls = content.classes.get(input.classId);
  const classSource: ModSource = {
    kind: 'class',
    id: cls.id,
    label: `Class (level ${input.level})`,
  };
  const ctx: QueryContext = { conditions: input.conditions };
  const base = new ModSet(input.mods);

  const str = base.query('str', 0, ctx);
  const dex = base.query('dex', 0, ctx);
  const int = base.query('int', 0, ctx);

  const mods = new ModSet(input.mods);
  const strLife = Math.floor(str.total / 5) * LIFE_PER_5_STR;
  const intMana = Math.floor(int.total / 5) * MANA_PER_5_INT;
  const dexAcc = Math.floor(dex.total) * ACCURACY_PER_DEX;
  if (strLife)
    mods.add({
      stat: 'life',
      kind: 'flat',
      value: strLife,
      source: { ...ATTRIBUTE_SOURCE, label: 'Strength' },
    });
  if (intMana)
    mods.add({
      stat: 'mana',
      kind: 'flat',
      value: intMana,
      source: { ...ATTRIBUTE_SOURCE, label: 'Intelligence' },
    });
  if (dexAcc)
    mods.add({
      stat: 'accuracy',
      kind: 'flat',
      value: dexAcc,
      source: { ...ATTRIBUTE_SOURCE, label: 'Dexterity' },
    });

  const lvl = input.level - 1;
  const life = mods.query('life', cls.base.life + cls.base.lifePerLevel * lvl, ctx, classSource);
  const mana = mods.query('mana', cls.base.mana + cls.base.manaPerLevel * lvl, ctx, classSource);
  const spirit = mods.query('spirit', cls.base.spirit, ctx, classSource);
  const energyShield = mods.query('energyShield', cls.base.energyShield, ctx, classSource);
  const armour = mods.query('armour', 0, ctx);
  const evasion = mods.query('evasion', 0, ctx);
  const accuracy = mods.query('accuracy', ACCURACY_PER_LEVEL * input.level, ctx, classSource);

  const actPenalty = (input.actsCompleted ?? 0) * RESIST_PENALTY_PER_ACT;
  const resists = {} as Record<ResistType, ResistLine>;
  for (const type of RESIST_TYPES) {
    const breakdown = mods.query(`resist.${type}`, 0, ctx);
    const maxBreakdown = mods.query(`maxResist.${type}`, BASE_MAX_RESIST, ctx);
    const max = Math.min(HARD_MAX_RESIST, maxBreakdown.total);
    const raw = breakdown.total - actPenalty;
    resists[type] = { type, raw, max, value: Math.min(max, raw), breakdown, maxBreakdown };
  }

  const blockBreakdown = mods.query('block', 0, ctx);
  const maxBlockBreakdown = mods.query('maxBlock', BASE_MAX_BLOCK, ctx);
  const maxBlock = Math.min(HARD_MAX_BLOCK, maxBlockBreakdown.total);

  const lifeRegenPct = mods.query('lifeRegenPct', BASE_LIFE_REGEN_PCT, ctx);
  const manaRegenPct = mods.query('manaRegenPct', BASE_MANA_REGEN_PCT, ctx);
  const esRate = mods.query('esRechargeRate', ES_RECHARGE_PCT_PER_S, ctx);
  const esStart = mods.query('esRechargeStart', 0, ctx);

  return {
    classId: cls.id,
    level: input.level,
    mods,
    ctx,
    str,
    dex,
    int,
    life,
    mana,
    spirit,
    energyShield,
    armour,
    evasion,
    accuracy,
    block: {
      value: Math.min(maxBlock, blockBreakdown.total),
      max: maxBlock,
      breakdown: blockBreakdown,
      maxBreakdown: maxBlockBreakdown,
    },
    resists,
    lifeRegenPct,
    lifeRegenPerSec: (life.total * lifeRegenPct.total) / 100 + mods.value('lifeRegen', 0, ctx),
    manaRegenPct,
    manaRegenPerSec: (mana.total * manaRegenPct.total) / 100,
    // "Faster start of recharge" is an increased-style stat: delay = 4s / (1 + x%).
    esRechargeDelaySec: ES_RECHARGE_DELAY_S / (1 + esStart.flatSum / 100 + esStart.incSum / 100),
    esRechargePerSec: (energyShield.total * esRate.total) / 100,
    leechCapPct: mods.query('leechCap', BASE_LEECH_CAP_PCT, ctx),
    critBonus: mods.query('critBonus', BASE_CRIT_BONUS, ctx),
    actPenalty,
  };
}
