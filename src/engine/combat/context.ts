import { CONTENT, type Content } from '../content';
import { scaled } from '../content/gems';
import {
  FLASK_SLOTS,
  type ChargeGain,
  type ChargeType,
  type FlaskKind,
  type GemModTemplate,
  type SkillGemDef,
  type SkillKind,
} from '../content/types';
import {
  activeReservations,
  findGem,
  gemDef,
  gemLevel,
  isSkill,
  isSpirit,
  isSupport,
} from '../gems/gems';
import { computeItem, equipmentMods, UNARMED } from '../items/itemStats';
import { ailmentFactors, type AilmentFactors } from '../stats/ailments';
import { computeCharacter, type CharacterSheet } from '../stats/character';
import { computeHit, type SkillStats } from '../stats/damage';
import { hitChance } from '../stats/formulas';
import {
  DAMAGE_TYPES,
  type DamageType,
  type Mod,
  type ModSource,
  type ResistType,
} from '../stats/types';
import type { GameState, GemInstance } from '../state';
import { flaskFor } from './flasks';
import { monsterStats, type MonsterStats } from './monsterStats';
import { characterLevel } from './progression';

export const BASIC_ATTACK: SkillStats = {
  id: 'basic_attack',
  tags: ['attack'],
  damageEffectiveness: 1,
};
/** Time taken by non-damaging skills (curses, warcries, guards, summons). */
export const UTILITY_USE_MS = 600;

/** Basic Spell: fire damage that grows with level; costs 4 + 1 per level mana. */
export function basicSpell(level: number): SkillStats {
  return {
    id: 'basic_spell',
    tags: ['spell', 'projectile'],
    damageEffectiveness: 1,
    baseDamage: { fire: { min: 2 + level, max: 4 + 2 * level } },
    castTimeMs: 1000,
    critChance: 6,
  };
}

export const basicSpellCost = (level: number) => 4 + level;

export function hasSpellWeapon(state: GameState, content: Content = CONTENT): boolean {
  return (['mainHand', 'offHand'] as const).some((slot) => {
    const item = state.equipment[slot];
    return !!item && content.bases.get(item.baseId).tags.includes('spellWeapon');
  });
}

/** A damaging skill's offence against one specific monster. */
export interface OffenceContext {
  skillId: string;
  intervalMs: number;
  manaCost: number;
  isAttack: boolean;
  /** Pre-mitigation, pre-crit damage ranges by type. */
  ranges: Partial<Record<DamageType, [number, number]>>;
  critChance: number;
  critBonus: number;
  hitChance: number;
  penetration: Record<ResistType, number>;
  leechPct: number;
  ailments: AilmentFactors;
  /** Expected DPS (for predictions; ignores DoT, combos and charges). */
  dps: number;
}

export interface MinionStats {
  persistent: boolean;
  count: number;
  life: number;
  damage: number;
  damageType: DamageType;
  intervalMs: number;
  threat: number;
  durationMs?: number;
}

export interface SkillContext {
  slot: number;
  gemUid: number;
  def: SkillGemDef;
  kind: SkillKind;
  level: number;
  usable: boolean;
  unusableReason?: 'weapon';
  manaCost: number;
  cooldownMs: number;
  useTimeMs: number;
  trigger?: { on: 'crit' | 'hit'; cooldownMs: number };
  offence?: OffenceContext;
  repeat?: { count: number; fraction: number };
  comboBuilder: boolean;
  comboFinisher: boolean;
  chargeFinisher?: ChargeType;
  chargeGains: ChargeGain[];
  armourPen: number;
  execute?: { belowLifePct: number; more: number };
  debuff?: {
    durationMs: number;
    curse: boolean;
    resistDown: number;
    damageTaken: number;
    slow: number;
    armourBreak: number;
  };
  buff?: { durationMs: number; mods: Mod[]; charges?: { type: ChargeType; count: number } };
  guard?: { absorb: number; durationMs: number };
  minion?: MinionStats;
  /** Persistent minions only: false if Spirit can't cover them. */
  reserved: boolean;
}

export interface CombatContext {
  sheet: CharacterSheet;
  level: number;
  monster: MonsterStats;
  attack: OffenceContext;
  spell: OffenceContext | null;
  skills: (SkillContext | null)[];
  monsterHitChance: number;
  block: number;
  takenMult: Record<DamageType, number>;
  armour: number;
  maxLife: number;
  maxMana: number;
  maxEs: number;
  lifeRegenPerSec: number;
  manaRegenPerSec: number;
  esRechargePerSec: number;
  esDelayMs: number;
  leechCapPerSec: number;
  playerThreat: number;
}

const gemSource = (id: string): ModSource => ({ kind: 'gem', id, label: id });

function gemMods(
  templates: readonly GemModTemplate[] | undefined,
  level: number,
  id: string,
): Mod[] {
  return (templates ?? []).map((m) => ({
    stat: m.stat,
    kind: m.kind,
    value: scaled(m.value, level),
    tags: m.tags,
    condition: m.condition,
    source: gemSource(id),
  }));
}

function qualityMod(m: GemModTemplate, quality: number, id: string): Mod[] {
  if (quality <= 0) return [];
  return [
    {
      stat: m.stat,
      kind: m.kind,
      value: m.value.base * quality,
      tags: m.tags,
      source: gemSource(id),
    },
  ];
}

const BUFF_SOURCE = (kind: FlaskKind): ModSource => ({
  kind: 'buff',
  id: `flask.${kind}`,
  label: `${kind} flask`,
});
const CHARGE_SOURCE: ModSource = { kind: 'buff', id: 'charges', label: 'Charges' };

/** Modifiers from active utility flasks. */
export function flaskBuffMods(state: GameState, now: number, content: Content = CONTENT): Mod[] {
  const combat = state.combat;
  if (!combat) return [];
  const mods: Mod[] = [];
  for (const slot of FLASK_SLOTS) {
    const fs = combat.flasks[slot];
    const item = state.equipment[slot];
    if (!fs?.activeUntil || fs.activeUntil <= now || !item) continue;
    const f = flaskFor(item, content);
    if (!f) continue;
    const src = BUFF_SOURCE(f.kind);
    if (f.kind === 'granite')
      mods.push({ stat: 'armour', kind: 'flat', value: f.amount, source: src });
    if (f.kind === 'swiftness') {
      mods.push({ stat: 'attackSpeed', kind: 'increased', value: f.amount, source: src });
      mods.push({ stat: 'castSpeed', kind: 'increased', value: f.amount, source: src });
    }
    if (f.kind === 'warding')
      for (const r of ['fire', 'cold', 'lightning'] as const)
        mods.push({ stat: `resist.${r}`, kind: 'flat', value: f.amount, source: src });
  }
  return mods;
}

/** Charges: endurance (DR + resists), frenzy (speed + more damage), power (crit). */
export function chargeMods(counts: Record<ChargeType, number>): Mod[] {
  const mods: Mod[] = [];
  const { endurance: e, frenzy: f, power: p } = counts;
  if (e) {
    mods.push({
      stat: 'damageTaken',
      kind: 'more',
      value: -4 * e,
      tags: ['physical'],
      source: CHARGE_SOURCE,
    });
    for (const r of ['fire', 'cold', 'lightning'] as const)
      mods.push({ stat: `resist.${r}`, kind: 'flat', value: 4 * e, source: CHARGE_SOURCE });
  }
  if (f) {
    mods.push({ stat: 'attackSpeed', kind: 'increased', value: 4 * f, source: CHARGE_SOURCE });
    mods.push({ stat: 'castSpeed', kind: 'increased', value: 4 * f, source: CHARGE_SOURCE });
    mods.push({ stat: 'damage', kind: 'more', value: 4 * f, source: CHARGE_SOURCE });
  }
  if (p) mods.push({ stat: 'critChance', kind: 'increased', value: 40 * p, source: CHARGE_SOURCE });
  return mods;
}

export function activeCharges(state: GameState, now: number): Record<ChargeType, number> {
  const c = state.combat;
  const n = (t: ChargeType) => (c && c.charges[t].until > now ? c.charges[t].n : 0);
  return { endurance: n('endurance'), frenzy: n('frenzy'), power: n('power') };
}

function offence(
  sheet: CharacterSheet,
  skill: SkillStats,
  weapon: ReturnType<typeof computeItem>['weapon'] | typeof UNARMED,
  monster: MonsterStats,
  manaCost: number,
): OffenceContext {
  const target = {
    life: monster.maxLife,
    armour: monster.armour,
    evasion: monster.evasion,
    resists: monster.resists,
    ailmentThreshold: monster.ailmentThreshold,
  };
  const isAttack = skill.tags.includes('attack');
  const hit = computeHit(sheet, skill, isAttack ? (weapon ?? UNARMED) : null, target);
  const ranges: OffenceContext['ranges'] = {};
  for (const t of DAMAGE_TYPES)
    if (hit.byType[t].max > 0) ranges[t] = [hit.byType[t].min, hit.byType[t].max];
  return {
    skillId: skill.id,
    intervalMs: Math.max(100, Math.round(1000 / hit.usesPerSecond)),
    manaCost,
    isAttack,
    ranges,
    critChance: hit.critChance,
    critBonus: hit.critBonus,
    hitChance: hit.hitChance,
    penetration: hit.penetration,
    leechPct: sheet.mods.value('lifeLeech', 0, { ...sheet.ctx, tags: hit.skillTags }),
    ailments: ailmentFactors(sheet.mods, sheet.ctx, hit.skillTags, skill.ailmentChance),
    dps: hit.dps,
  };
}

function skillContext(
  state: GameState,
  slot: number,
  gem: GemInstance,
  baseMods: Mod[],
  level: number,
  monster: MonsterStats,
  weapon: ReturnType<typeof computeItem>['weapon'],
  conditions: Set<string>,
  reserved: Set<number>,
  content: Content,
): SkillContext | null {
  const def = gemDef(gem, content);
  if (!isSkill(def)) return null;
  const L = gemLevel(gem.xp);
  const mods: Mod[] = [
    ...baseMods,
    ...gemMods(def.mods, L, def.id),
    ...qualityMod(def.quality, gem.quality, def.id),
  ];
  let manaMult = 1;
  let repeat = def.repeats ? { ...def.repeats } : undefined;
  let comboBuilder = def.combo === 'builder';
  const chargeGains: ChargeGain[] = def.chargeGain ? [def.chargeGain] : [];
  let trigger: SkillContext['trigger'];
  let execute: SkillContext['execute'];
  for (const sUid of gem.supports) {
    if (sUid === null) continue;
    const sg = findGem(state, sUid);
    if (!sg) continue;
    const sd = gemDef(sg, content);
    if (!isSupport(sd)) continue;
    const sl = gemLevel(sg.xp);
    mods.push(...gemMods(sd.mods, sl, sd.id), ...qualityMod(sd.quality, sg.quality, sd.id));
    manaMult *= sd.manaMult;
    const f = sd.flags;
    if (f?.repeat)
      repeat = repeat
        ? {
            count: repeat.count + f.repeat.count,
            fraction: Math.min(repeat.fraction, f.repeat.fraction),
          }
        : { ...f.repeat };
    if (f?.chargeGain) chargeGains.push(f.chargeGain);
    if (f?.comboBuilder) comboBuilder = true;
    if (f?.trigger) trigger = f.trigger;
    if (f?.execute)
      execute = { belowLifePct: f.execute.belowLifePct, more: scaled(f.execute.more, sl) };
  }
  const sheet = computeCharacter(
    { classId: state.character.classId, level, mods, conditions },
    content,
  );
  const q = (stat: Parameters<typeof sheet.mods.query>[0], tags?: string[]) =>
    sheet.mods.query(stat, 1, { ...sheet.ctx, tags: tags ?? [...def.tags] }).total;

  let usable = true;
  let unusableReason: 'weapon' | undefined;
  if (def.skillKind === 'attack' && def.weapons) {
    const cls = weapon ? content.bases.get(state.equipment.mainHand!.baseId).class : null;
    if (!cls || !def.weapons.includes(cls as never)) {
      usable = false;
      unusableReason = 'weapon';
    }
  }
  const manaCost = Math.max(0, scaled(def.manaCost, L) * manaMult * q('manaCost', []));
  const cooldownMs = def.cooldownMs ? def.cooldownMs / q('cooldownRecovery', []) : 0;
  const ctx: SkillContext = {
    slot,
    gemUid: gem.uid,
    def,
    kind: def.skillKind,
    level: L,
    usable,
    unusableReason,
    manaCost,
    cooldownMs,
    useTimeMs: UTILITY_USE_MS,
    trigger,
    repeat,
    comboBuilder,
    comboFinisher: def.combo === 'finisher',
    chargeFinisher: def.chargeFinisher,
    chargeGains,
    armourPen: def.armourPen ?? 0,
    execute,
    reserved: true,
  };

  if (def.skillKind === 'attack' || def.skillKind === 'spell') {
    const growth = 1 + (def.damageGrowth ?? 0) * (L - 1);
    const stats: SkillStats = {
      id: def.id,
      tags: def.tags,
      damageEffectiveness: def.effectiveness ? scaled(def.effectiveness, L) : 1,
      baseDamage: def.baseDamage
        ? Object.fromEntries(
            Object.entries(def.baseDamage).map(([t, r]) => [
              t,
              { min: r![0] * growth, max: r![1] * growth },
            ]),
          )
        : undefined,
      castTimeMs: def.castTimeMs,
      critChance: def.critChance,
      conversion: def.conversion as SkillStats['conversion'],
      ailmentChance: def.ailmentChance,
    };
    ctx.offence = offence(sheet, stats, weapon ?? UNARMED, monster, manaCost);
    ctx.useTimeMs = ctx.offence.intervalMs;
  }
  if (def.debuff) {
    const eff = def.skillKind === 'curse' ? q('curseEffect', []) : 1;
    const d = def.debuff;
    ctx.debuff = {
      durationMs: d.durationMs,
      curse: def.skillKind === 'curse',
      resistDown: d.resistDown ? scaled(d.resistDown, L) * eff : 0,
      damageTaken: d.damageTaken ? scaled(d.damageTaken, L) * eff : 0,
      slow: d.slow ? scaled(d.slow, L) * eff : 0,
      armourBreak: d.armourBreak ? scaled(d.armourBreak, L) * eff : 0,
    };
  }
  if (def.buff) {
    const eff = q('buffEffect', []);
    ctx.buff = {
      durationMs: def.buff.durationMs,
      mods: gemMods(def.buff.mods, L, def.id).map((m) => ({ ...m, value: m.value * eff })),
      charges: def.buff.charges,
    };
  }
  if (def.guard)
    ctx.guard = {
      absorb: scaled(def.guard.absorb, L) * q('guardEffect', []),
      durationMs: def.guard.durationMs,
    };
  if (def.minion) {
    const m = def.minion;
    ctx.minion = {
      persistent: m.persistent,
      count: m.count,
      life: scaled(m.life, L) * q('minionLife', []),
      damage: scaled(m.damage, L) * q('damage', ['minion', m.damageType, 'hit']),
      damageType: m.damageType,
      intervalMs: Math.round(m.attackIntervalMs / q('minionAttackSpeed', [])),
      threat: m.threat * q('minionThreat', []),
      durationMs: m.durationMs,
    };
    if (m.persistent) ctx.reserved = reserved.has(gem.uid);
  }
  return ctx;
}

/** Per-state cache: a different character (or a restored save) never shares entries. */
const caches = new WeakMap<GameState, Map<string, CombatContext>>();
const CACHE_LIMIT = 256;

/**
 * Everything derived about the player vs the current monster: the shared sheet
 * (defence, recovery) and one context per skill-bar slot. Pure function of the
 * state, cached per state object by a key covering every input. Every command
 * that changes equipment or gems bumps `gearVersion`.
 */
/** The character's Spirit total (from level milestones and gear). */
export function playerSpirit(state: GameState, content: Content = CONTENT): number {
  const level = characterLevel(state.charXp);
  const gearMods = equipmentMods(state.equipment, () => '', content);
  return computeCharacter({ classId: state.character.classId, level, mods: gearMods }, content)
    .spirit.total;
}

export function combatContext(
  state: GameState,
  now: number,
  content: Content = CONTENT,
  lowLife = false,
): CombatContext {
  const combat = state.combat!;
  const m = combat.monster;
  const level = characterLevel(state.charXp);
  const flaskBuffs = flaskBuffMods(state, now, content);
  const charges = activeCharges(state, now);
  const buffs = combat.buffs.filter((b) => b.until > now);
  const key = [
    state.character.classId,
    state.gearVersion,
    level,
    state.combatSettings.skill,
    flaskBuffs.map((b) => `${b.stat}:${b.value}`).join(','),
    `${charges.endurance}${charges.frenzy}${charges.power}`,
    buffs.map((b) => b.gemUid).join(','),
    lowLife ? 'L' : '',
    m.defId,
    m.rarity,
    m.mods.join(','),
    m.level,
  ].join('|');
  let cache = caches.get(state);
  if (!cache) {
    cache = new Map();
    caches.set(state, cache);
  }
  const cached = cache.get(key);
  if (cached) return cached;

  const conditions = new Set<string>(lowLife ? ['lowLife'] : []);
  const gearMods = equipmentMods(state.equipment, () => '', content);
  // Spirit is known only after the sheet; compute it from gear first, then apply auras that fit.
  const preSheet = computeCharacter(
    { classId: state.character.classId, level, mods: gearMods },
    content,
  );
  const reserved = activeReservations(state, preSheet.spirit.total, content);
  const auraMods: Mod[] = [];
  for (const uid of state.activeSpirit) {
    if (!reserved.has(uid)) continue;
    const g = findGem(state, uid);
    const def = g && gemDef(g, content);
    if (g && def && isSpirit(def))
      auraMods.push(
        ...gemMods(def.mods, gemLevel(g.xp), def.id),
        ...qualityMod(def.quality, g.quality, def.id),
      );
  }
  const buffMods = buffs.flatMap((b) => b.mods);
  const baseMods = [...gearMods, ...flaskBuffs, ...auraMods, ...chargeMods(charges), ...buffMods];
  const sheet = computeCharacter(
    { classId: state.character.classId, level, mods: baseMods, conditions },
    content,
  );
  const monster = monsterStats(m.defId, m.level, m.rarity, m.mods, content);
  const main = state.equipment.mainHand;
  const weapon = main ? computeItem(main, '', content).weapon : undefined;
  const wantSpell =
    state.combatSettings.skill === 'spell' ||
    (state.combatSettings.skill === 'auto' && hasSpellWeapon(state, content));
  const takenMult = {} as Record<DamageType, number>;
  for (const t of DAMAGE_TYPES) {
    const mult = sheet.mods.query('damageTaken', 1, { ...sheet.ctx, tags: [t] }).total;
    takenMult[t] = t === 'physical' ? mult : (1 - sheet.resists[t].value / 100) * mult;
  }
  const skills = state.skillBar.map((slot, i) => {
    const gem = slot.gemUid !== null ? findGem(state, slot.gemUid) : undefined;
    return gem
      ? skillContext(state, i, gem, baseMods, level, monster, weapon, conditions, reserved, content)
      : null;
  });
  const ctx: CombatContext = {
    sheet,
    level,
    monster,
    attack: offence(sheet, BASIC_ATTACK, weapon ?? UNARMED, monster, 0),
    spell: wantSpell
      ? offence(sheet, basicSpell(level), weapon ?? UNARMED, monster, basicSpellCost(level))
      : null,
    skills,
    monsterHitChance: hitChance(monster.accuracy, sheet.evasion.total),
    block: sheet.block.value / 100,
    takenMult,
    armour: sheet.armour.total,
    maxLife: sheet.life.total,
    maxMana: sheet.mana.total,
    maxEs: sheet.energyShield.total,
    lifeRegenPerSec: sheet.lifeRegenPerSec,
    manaRegenPerSec: sheet.manaRegenPerSec,
    esRechargePerSec: sheet.esRechargePerSec,
    esDelayMs: sheet.esRechargeDelaySec * 1000,
    leechCapPerSec: (sheet.life.total * sheet.leechCapPct.total) / 100,
    playerThreat: 100,
  };
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, ctx);
  return ctx;
}
