import { CONTENT, type Content } from '../content';
import { FLASK_SLOTS, type FlaskKind } from '../content/types';
import { computeItem, equipmentMods, UNARMED } from '../items/itemStats';
import { ailmentFactors, type AilmentFactors } from '../stats/ailments';
import { computeCharacter, type CharacterSheet } from '../stats/character';
import { computeHit, type SkillStats } from '../stats/damage';
import { hitChance } from '../stats/formulas';
import { DAMAGE_TYPES, type DamageType, type Mod, type ResistType } from '../stats/types';
import type { GameState } from '../state';
import { flaskFor } from './flasks';
import { monsterStats, type MonsterStats } from './monsterStats';
import { characterLevel } from './progression';

export const BASIC_ATTACK: SkillStats = {
  id: 'basic_attack',
  tags: ['attack'],
  damageEffectiveness: 1,
};

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

/** The player's offence against one specific monster, with one skill. */
export interface OffenceContext {
  skillId: 'basic_attack' | 'basic_spell';
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
  /** Expected DPS (for predictions). */
  dps: number;
}

export interface CombatContext {
  sheet: CharacterSheet;
  level: number;
  monster: MonsterStats;
  attack: OffenceContext;
  spell: OffenceContext | null;
  /** Chance the monster's attack hits the player (before block). */
  monsterHitChance: number;
  block: number;
  /** Damage-taken multipliers after resists (non-physical) and damageTaken mods. */
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
}

const BUFF_SOURCE = (kind: FlaskKind) => ({
  kind: 'buff' as const,
  id: `flask.${kind}`,
  label: `${kind} flask`,
});

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

function offence(
  sheet: CharacterSheet,
  skill: SkillStats,
  state: GameState,
  monster: MonsterStats,
  level: number,
  content: Content,
): OffenceContext {
  const main = state.equipment.mainHand;
  const weapon = (main && computeItem(main, '', content).weapon) || UNARMED;
  const target = {
    life: monster.maxLife,
    armour: monster.armour,
    evasion: monster.evasion,
    resists: monster.resists,
    ailmentThreshold: monster.ailmentThreshold,
  };
  const isAttack = skill.tags.includes('attack');
  const hit = computeHit(sheet, skill, isAttack ? weapon : null, target);
  const ranges: OffenceContext['ranges'] = {};
  for (const t of DAMAGE_TYPES) {
    if (hit.byType[t].max > 0) ranges[t] = [hit.byType[t].min, hit.byType[t].max];
  }
  return {
    skillId: isAttack ? 'basic_attack' : 'basic_spell',
    intervalMs: Math.max(100, Math.round(1000 / hit.usesPerSecond)),
    manaCost: isAttack ? 0 : basicSpellCost(level),
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

/** Per-state cache: a different character (or a restored save) never shares entries. */
const caches = new WeakMap<GameState, Map<string, CombatContext>>();
const CACHE_LIMIT = 128;

/**
 * Everything derived about the player vs the current monster. Pure function of
 * the state, cached per state object by a key covering every input (gear version,
 * level, active buffs, monster), so offline catch-up stays fast and deterministic.
 * Every command that changes equipment bumps `gearVersion`.
 */
export function combatContext(
  state: GameState,
  now: number,
  content: Content = CONTENT,
): CombatContext {
  const combat = state.combat!;
  const m = combat.monster;
  const level = characterLevel(state.charXp);
  const buffs = flaskBuffMods(state, now, content);
  const key = [
    state.character.classId,
    state.gearVersion,
    level,
    state.combatSettings.skill,
    buffs.map((b) => `${b.stat}:${b.value}`).join(','),
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
  const hit = cache.get(key);
  if (hit) return hit;

  const sheet = computeCharacter(
    {
      classId: state.character.classId,
      level,
      mods: [...equipmentMods(state.equipment, () => '', content), ...buffs],
    },
    content,
  );
  const monster = monsterStats(m.defId, m.level, m.rarity, m.mods, content);
  const wantSpell =
    state.combatSettings.skill === 'spell' ||
    (state.combatSettings.skill === 'auto' && hasSpellWeapon(state, content));
  const takenMult = {} as Record<DamageType, number>;
  for (const t of DAMAGE_TYPES) {
    const mult = sheet.mods.query('damageTaken', 1, { ...sheet.ctx, tags: [t] }).total;
    takenMult[t] = t === 'physical' ? mult : (1 - sheet.resists[t].value / 100) * mult;
  }
  const ctx: CombatContext = {
    sheet,
    level,
    monster,
    attack: offence(sheet, BASIC_ATTACK, state, monster, level, content),
    spell: wantSpell ? offence(sheet, basicSpell(level), state, monster, level, content) : null,
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
  };
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, ctx);
  return ctx;
}
