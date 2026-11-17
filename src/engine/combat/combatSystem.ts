import { CONTENT, type Content } from '../content';
import { FLASK_SLOTS, type ChargeType, type FlaskSlot } from '../content/types';
import type { Rng } from '../core/rng';
import { buildingValue } from '../economy/town';
import { gemLevel, MAX_GEM_LEVEL, gemXpForLevel, xpEarningGems } from '../gems/gems';
import type { SimContext, SimEvent, System } from '../sim';
import { AILMENT_RULES } from '../stats/ailments';
import { armourReduction, rollEntropy } from '../stats/formulas';
import { DAMAGE_TYPES, type DamageType } from '../stats/types';
import {
  rngFor,
  type CombatState,
  type GameState,
  type MinionInstance,
  type MonsterInstance,
  type SkillRule,
} from '../state';
import {
  combatContext,
  type CombatContext,
  type OffenceContext,
  type SkillContext,
} from './context';
import { CHARGES_PER_HIT_TAKEN, CHARGES_PER_KILL, flaskFor } from './flasks';
import { bankBag, collectDrops, emptyBag, pickZoneMonster, rollDrops } from './loot';
import { monsterStats, RARITY_CHANCE, type MonsterRarity } from './monsterStats';
import { characterLevel, xpAfterDeath } from './progression';

export const COMBAT_TICK_MS = 500;
export const RETREAT_COOLDOWN_MS = 15_000;
export const MAX_CHARGES = 3;
export const CHARGE_DURATION_MS = 10_000;
export const MAX_COMBO = 8;
export const COMBO_DECAY_MS = 4000;
export const COMBO_MORE_PER_POINT = 0.25;
export const CHARGE_FINISHER_MORE = 0.1;
export const MINION_REVIVE_MS = 6000;
const STREAM = 'combat';

type Emit = (e: SimEvent) => void;

// ---------------------------------------------------------------- Setup

export function spawnMonster(
  state: GameState,
  rng: Rng,
  at: number,
  content: Content = CONTENT,
): MonsterInstance {
  const zone = content.zones.get(state.combat!.zoneId);
  const defId = pickZoneMonster(rng, zone);
  const roll = rng.float();
  const rarity: MonsterRarity =
    roll < RARITY_CHANCE.rare
      ? 'rare'
      : roll < RARITY_CHANCE.rare + RARITY_CHANCE.magic
        ? 'magic'
        : 'normal';
  const mods: string[] = [];
  const count = rarity === 'magic' ? rng.int(1, 2) : rarity === 'rare' ? rng.int(3, 4) : 0;
  const pool = content.monsterMods.all().map((m) => m.id);
  while (mods.length < count) {
    const id = pool[rng.int(0, pool.length - 1)]!;
    if (!mods.includes(id)) mods.push(id);
  }
  const stats = monsterStats(defId, zone.level, rarity, mods, content);
  return {
    defId,
    rarity,
    mods,
    level: zone.level,
    maxLife: stats.maxLife,
    life: stats.maxLife,
    nextAt: at + stats.attackIntervalMs,
    entropy: rng.float(),
    poison: [],
    freezeBuildup: 0,
    debuffs: [],
  };
}

const noCharges = (): CombatState['charges'] => ({
  endurance: { n: 0, until: 0 },
  frenzy: { n: 0, until: 0 },
  power: { n: 0, until: 0 },
});

/** Begin fighting in a zone at full life, mana, ES and flask charges. */
export function startCombat(state: GameState, zoneId: string, content: Content = CONTENT): void {
  const rng = rngFor(state, STREAM);
  const t = state.time;
  const flasks: CombatState['flasks'] = {};
  for (const slot of FLASK_SLOTS) {
    const item = state.equipment[slot];
    const f = item ? flaskFor(item, content) : null;
    if (f) flasks[slot] = { charges: f.maxCharges };
  }
  state.combat = {
    zoneId,
    startedAt: t,
    monster: undefined as unknown as MonsterInstance,
    life: 0,
    mana: 0,
    es: 0,
    playerNextAt: t,
    playerEntropy: rng.float(),
    lastHitAt: -Infinity,
    leechPool: 0,
    retreatReadyAt: t,
    flasks,
    tickAt: t + COMBAT_TICK_MS,
    bag: emptyBag(),
    lastBankAt: t,
    kills: 0,
    charges: noCharges(),
    combo: { points: 0, lastHitAt: 0 },
    cooldowns: {},
    buffs: [],
    minions: [],
    nextMinionId: 1,
  };
  const c = state.combat;
  c.monster = spawnMonster(state, rng, t, content);
  const ctx = combatContext(state, t, content);
  c.life = ctx.maxLife;
  c.mana = ctx.maxMana;
  c.es = ctx.maxEs;
  maintainMinions(state, ctx, t);
  c.playerNextAt = t + firstInterval(ctx);
}

function firstInterval(ctx: CombatContext): number {
  const first = ctx.skills.find((s) => s?.usable && s.offence && !s.trigger);
  return first?.offence?.intervalMs ?? (ctx.spell ?? ctx.attack).intervalMs;
}

/** Stop combat, banking the trip bag. */
export function stopCombat(state: GameState, content: Content = CONTENT): void {
  if (!state.combat) return;
  bankBag(state, state.combat.bag, content);
  state.stats.itemsLost += state.combat.bag.gear.length;
  state.combat = null;
}

/** Manual bank: instant, but both attack timers restart. */
export function bankNow(state: GameState, content: Content = CONTENT): void {
  const c = state.combat;
  if (!c) return;
  bankBag(state, c.bag, content);
  c.lastBankAt = state.time;
  const ctx = combatContext(state, state.time, content);
  c.playerNextAt = state.time + firstInterval(ctx);
  c.monster.nextAt = state.time + ctx.monster.attackIntervalMs;
}

/** Retreat: success chance = current life %. Success banks and stops; failure → 15s cooldown. */
export function attemptRetreat(state: GameState, content: Content = CONTENT): boolean {
  const c = state.combat;
  if (!c) return false;
  if (state.time < c.retreatReadyAt) throw new Error('Retreat is on cooldown');
  const ctx = combatContext(state, state.time, content);
  const chance = Math.max(0, Math.min(1, c.life / ctx.maxLife));
  if (rngFor(state, 'retreat').chance(chance)) {
    stopCombat(state, content);
    return true;
  }
  c.retreatReadyAt = state.time + RETREAT_COOLDOWN_MS;
  return false;
}

// ---------------------------------------------------------------- Helpers

const isLowLife = (c: CombatState, ctx: CombatContext) => c.life / ctx.maxLife < 0.5;

function ctxFor(state: GameState, t: number, content: Content): CombatContext {
  const c = state.combat!;
  const base = combatContext(state, t, content);
  return isLowLife(c, base) ? combatContext(state, t, content, true) : base;
}

function gainCharge(c: CombatState, type: ChargeType, t: number, count = 1) {
  const ch = c.charges[type];
  if (ch.until <= t) ch.n = 0;
  ch.n = Math.min(MAX_CHARGES, ch.n + count);
  ch.until = t + CHARGE_DURATION_MS;
}

function activeDebuffs(m: MonsterInstance, t: number) {
  let resistDown = 0;
  let damageTaken = 0;
  let armourBreak = 0;
  let slow = 0;
  for (const d of m.debuffs) {
    if (d.until <= t) continue;
    resistDown += d.resistDown;
    damageTaken += d.damageTaken;
    armourBreak += d.armourBreak;
    slow += d.slow;
  }
  return {
    resistDown,
    damageTaken: 1 + damageTaken / 100,
    armourBreak: Math.min(0.9, armourBreak / 100),
    slow: Math.min(75, slow),
  };
}

/** Damage after the monster's armour/resists, penetration, curses and shock. */
function mitigateOnMonster(
  ctx: CombatContext,
  m: MonsterInstance,
  type: DamageType,
  dmg: number,
  pen: Record<'fire' | 'cold' | 'lightning' | 'chaos', number> | null,
  armourPen: number,
  t: number,
): number {
  const d = activeDebuffs(m, t);
  const shock = m.shock && m.shock.until > t ? 1 + m.shock.pct / 100 : 1;
  let after: number;
  if (type === 'physical') {
    const armour = ctx.monster.armour * (1 - d.armourBreak) * (1 - armourPen);
    after = dmg * (1 - armourReduction(armour, dmg));
  } else {
    const res = ctx.monster.resists[type] - d.resistDown - (pen?.[type] ?? 0);
    after = dmg * (1 - res / 100);
  }
  return Math.max(0, after) * shock * d.damageTaken;
}

function ruleOk(
  rule: SkillRule,
  sc: SkillContext,
  c: CombatState,
  ctx: CombatContext,
  t: number,
): boolean {
  switch (rule.kind) {
    case 'always':
      return true;
    case 'lifeBelow':
      return (c.life / ctx.maxLife) * 100 < rule.value;
    case 'manaAbove':
      return ctx.maxMana > 0 && (c.mana / ctx.maxMana) * 100 > rule.value;
    case 'targetLacksDebuff':
      return !c.monster.debuffs.some((d) => d.gemUid === sc.gemUid && d.until > t);
    case 'buffNotActive':
      return !c.buffs.some((b) => b.gemUid === sc.gemUid && b.until > t);
    case 'chargesAtLeast':
      return (c.charges[rule.charge].until > t ? c.charges[rule.charge].n : 0) >= rule.value;
    case 'comboAtLeast':
      return c.combo.points >= rule.value;
  }
}

/** Skills that would do nothing right now are skipped automatically. */
function wouldDoSomething(sc: SkillContext, c: CombatState, t: number): boolean {
  switch (sc.kind) {
    case 'curse':
      return !c.monster.debuffs.some((d) => d.gemUid === sc.gemUid && d.until > t);
    case 'warcry':
      return !c.buffs.some((b) => b.gemUid === sc.gemUid && b.until > t);
    case 'guard':
      return !c.guard || c.guard.until <= t;
    case 'minion':
      return !sc.minion!.persistent && !c.minions.some((mi) => mi.gemUid === sc.gemUid);
    default:
      return true;
  }
}

// ---------------------------------------------------------------- Player actions

function playerAction(state: GameState, rng: Rng, t: number, emit: Emit, content: Content) {
  const c = state.combat!;
  const ctx = ctxFor(state, t, content);
  for (const sc of ctx.skills) {
    if (!sc || !sc.usable || sc.trigger) continue;
    if (sc.kind === 'minion' && sc.minion!.persistent) continue;
    if ((c.cooldowns[sc.gemUid] ?? 0) > t) continue;
    if (c.mana < sc.manaCost) continue;
    if (!wouldDoSomething(sc, c, t)) continue;
    if (!ruleOk(state.skillBar[sc.slot]!.rule, sc, c, ctx, t)) continue;
    castSkill(state, rng, sc, ctx, t, emit, content, false);
    if (state.combat) state.combat.playerNextAt = t + sc.useTimeMs;
    return;
  }
  // Fallback: Basic Spell (spell weapon + mana) or Basic Attack.
  const off = ctx.spell && c.mana >= ctx.spell.manaCost ? ctx.spell : ctx.attack;
  c.mana -= off.manaCost;
  c.playerNextAt = t + off.intervalMs;
  c.lastSkill = off.skillId;
  performHits(state, rng, off, null, ctx, t, emit, content, false);
}

function castSkill(
  state: GameState,
  rng: Rng,
  sc: SkillContext,
  ctx: CombatContext,
  t: number,
  emit: Emit,
  content: Content,
  triggered: boolean,
) {
  const c = state.combat!;
  c.mana -= sc.manaCost;
  if (sc.cooldownMs) c.cooldowns[sc.gemUid] = t + sc.cooldownMs;
  c.lastSkill = sc.def.id;
  for (const g of sc.chargeGains)
    if (g.on === 'use' && rng.chance(g.chance)) gainCharge(c, g.type, t, g.count);
  if (!triggered) emit({ type: 'skillUsed', gemId: sc.def.id, time: t });

  if (sc.offence) {
    performHits(state, rng, sc.offence, sc, ctx, t, emit, content, triggered);
    return;
  }
  if (sc.debuff) {
    const m = c.monster;
    if (sc.debuff.curse) m.debuffs = m.debuffs.filter((d) => !d.curse || d.until <= t);
    m.debuffs = m.debuffs.filter((d) => d.gemUid !== sc.gemUid);
    m.debuffs.push({ gemUid: sc.gemUid, until: t + sc.debuff.durationMs, ...sc.debuff });
    return;
  }
  if (sc.buff) {
    c.buffs = c.buffs.filter((b) => b.gemUid !== sc.gemUid && b.until > t);
    c.buffs.push({ gemUid: sc.gemUid, until: t + sc.buff.durationMs, mods: sc.buff.mods });
    if (sc.buff.charges) gainCharge(c, sc.buff.charges.type, t, sc.buff.charges.count);
    return;
  }
  if (sc.guard) {
    c.guard = { absorb: sc.guard.absorb, until: t + sc.guard.durationMs };
    return;
  }
  if (sc.minion && !sc.minion.persistent) {
    c.minions = c.minions.filter((mi) => mi.gemUid !== sc.gemUid);
    for (let i = 0; i < sc.minion.count; i++) {
      c.minions.push({
        id: c.nextMinionId++,
        gemUid: sc.gemUid,
        life: sc.minion.life,
        maxLife: sc.minion.life,
        nextAt: t + sc.minion.intervalMs,
        until: t + (sc.minion.durationMs ?? 5000),
      });
    }
  }
}

/** One use of a damaging skill: the main hit plus any repeats. */
function performHits(
  state: GameState,
  rng: Rng,
  off: OffenceContext,
  sc: SkillContext | null,
  ctx: CombatContext,
  t: number,
  emit: Emit,
  content: Content,
  triggered: boolean,
) {
  const c = state.combat!;
  let more = 1;
  if (sc?.comboFinisher) more *= 1 + COMBO_MORE_PER_POINT * c.combo.points;
  if (sc?.chargeFinisher) {
    const ch = c.charges[sc.chargeFinisher];
    if (ch.until > t) more *= 1 + CHARGE_FINISHER_MORE * ch.n;
  }
  const hits = 1 + (sc?.repeat?.count ?? 0);
  let anyCrit = false;
  for (let h = 0; h < hits && state.combat; h++) {
    const m = c.monster;
    const fraction = h === 0 ? 1 : sc!.repeat!.fraction;
    if (off.isAttack) {
      const [hit, e] = rollEntropy(c.playerEntropy, off.hitChance);
      c.playerEntropy = e;
      if (!hit) {
        emit({ type: 'combatMiss', time: t });
        continue;
      }
    }
    const crit = rng.chance(off.critChance);
    anyCrit ||= crit;
    let execute = 1;
    if (sc?.execute && m.life / m.maxLife < sc.execute.belowLifePct / 100)
      execute = 1 + sc.execute.more / 100;
    let total = 0;
    const raw: Partial<Record<DamageType, number>> = {};
    for (const type of DAMAGE_TYPES) {
      const r = off.ranges[type];
      if (!r) continue;
      let dmg = (r[0] + rng.float() * (r[1] - r[0])) * fraction * more * execute;
      if (crit) dmg *= 1 + off.critBonus;
      raw[type] = dmg;
      total += mitigateOnMonster(ctx, m, type, dmg, off.penetration, sc?.armourPen ?? 0, t);
    }
    m.life -= total;
    c.leechPool += (total * off.leechPct) / 100;
    emit({ type: 'combatHit', damage: total, crit, skill: off.skillId, time: t });
    applyAilments(m, off, raw, ctx.monster.ailmentThreshold, rng, t);
    if (sc?.debuff && h === 0) {
      m.debuffs = m.debuffs.filter((d) => d.gemUid !== sc.gemUid);
      m.debuffs.push({ gemUid: sc.gemUid, until: t + sc.debuff.durationMs, ...sc.debuff });
    }
    if (sc?.comboBuilder) {
      c.combo.points = Math.min(MAX_COMBO, c.combo.points + 1);
      c.combo.lastHitAt = t;
    }
    for (const g of sc?.chargeGains ?? []) {
      if ((g.on === 'hit' || (g.on === 'crit' && crit)) && rng.chance(g.chance))
        gainCharge(c, g.type, t, g.count);
    }
    if (m.life <= 0) {
      for (const g of sc?.chargeGains ?? [])
        if (g.on === 'kill' && rng.chance(g.chance)) gainCharge(c, g.type, t, g.count);
      killMonster(state, rng, t, emit, content);
      break;
    }
  }
  if (state.combat && sc?.comboFinisher) c.combo.points = 0;
  if (state.combat && sc?.chargeFinisher) c.charges[sc.chargeFinisher].n = 0;
  if (state.combat && anyCrit && off.isAttack && !triggered)
    fireTriggers(state, rng, 'crit', t, emit, content);
}

function fireTriggers(
  state: GameState,
  rng: Rng,
  on: 'crit' | 'hit',
  t: number,
  emit: Emit,
  content: Content,
) {
  const c = state.combat;
  if (!c) return;
  const ctx = ctxFor(state, t, content);
  for (const sc of ctx.skills) {
    if (!state.combat || !sc?.trigger || sc.trigger.on !== on || !sc.usable) continue;
    if ((c.cooldowns[sc.gemUid] ?? 0) > t || c.mana < sc.manaCost) continue;
    castSkill(state, rng, sc, ctx, t, emit, content, true);
    if (state.combat) c.cooldowns[sc.gemUid] = t + Math.max(sc.trigger.cooldownMs, sc.cooldownMs);
    emit({ type: 'skillTriggered', gemId: sc.def.id, time: t });
  }
}

function applyAilments(
  m: MonsterInstance,
  off: OffenceContext,
  raw: Partial<Record<DamageType, number>>,
  threshold: number,
  rng: Rng,
  t: number,
) {
  const a = off.ailments;
  const chance = (ail: keyof typeof a.chanceFlat, innate: number) =>
    Math.min(1, Math.max(0, (innate + a.chanceFlat[ail]) * a.chanceMult[ail]));
  const fire = raw.fire ?? 0;
  const phys = raw.physical ?? 0;
  const chaos = raw.chaos ?? 0;
  const cold = raw.cold ?? 0;
  const lightning = raw.lightning ?? 0;
  if (fire > 0 && rng.chance(chance('ignite', fire / threshold))) {
    const dps = ((fire * AILMENT_RULES.ignite.dpsPct) / 100) * a.effect.ignite;
    if (!m.ignite || m.ignite.until <= t || dps >= m.ignite.dps)
      m.ignite = { dps, until: t + AILMENT_RULES.ignite.durationS * 1000 };
  }
  if (phys > 0 && rng.chance(chance('bleed', 0))) {
    const dps = ((phys * AILMENT_RULES.bleed.dpsPct) / 100) * a.effect.bleed;
    if (!m.bleed || m.bleed.until <= t || dps >= m.bleed.dps)
      m.bleed = { dps, until: t + AILMENT_RULES.bleed.durationS * 1000 };
  }
  if (phys + chaos > 0 && rng.chance(chance('poison', 0))) {
    m.poison.push({
      dps: (((phys + chaos) * AILMENT_RULES.poison.dpsPct) / 100) * a.effect.poison,
      until: t + AILMENT_RULES.poison.durationS * 1000,
    });
  }
  if (lightning > 0 && rng.chance(chance('shock', lightning / threshold))) {
    m.shock = {
      pct: AILMENT_RULES.shock.effectPct * a.effect.shock,
      until: t + AILMENT_RULES.shock.durationS * 1000,
    };
  }
  if (cold > 0) {
    const r = AILMENT_RULES.chill;
    const pct = Math.min(r.maxSlowPct, ((r.slowPerThreshold * cold) / threshold) * a.effect.chill);
    if (!m.chill || m.chill.until <= t || pct >= m.chill.pct)
      m.chill = { pct, until: t + r.durationS * 1000 };
    m.freezeBuildup += (cold / threshold) * a.effect.freeze;
    if (m.freezeBuildup >= 1) {
      m.freezeBuildup = 0;
      m.frozenUntil = t + AILMENT_RULES.freeze.durationS * 1000;
      if (m.nextAt < m.frozenUntil) m.nextAt = m.frozenUntil;
    }
  }
}

function killMonster(state: GameState, rng: Rng, t: number, emit: Emit, content: Content) {
  const c = state.combat!;
  const stats = monsterStats(
    c.monster.defId,
    c.monster.level,
    c.monster.rarity,
    c.monster.mods,
    content,
  );
  const levelBefore = characterLevel(state.charXp);
  state.charXp += stats.xp;
  state.stats.kills++;
  c.kills++;
  // Gems in use (skill bar, their supports, active spirit gems) earn the same XP.
  const cap = gemXpForLevel(MAX_GEM_LEVEL);
  for (const g of xpEarningGems(state)) {
    const before = gemLevel(g.xp);
    g.xp = Math.min(cap, g.xp + stats.xp);
    const after = gemLevel(g.xp);
    if (after > before) {
      state.gearVersion++;
      emit({ type: 'gemLevelUp', gemId: g.gemId, level: after, time: t });
    }
  }
  collectDrops(state, c.bag, rollDrops(state, rng, stats, content), content);
  for (const slot of FLASK_SLOTS) {
    const fs = c.flasks[slot];
    const item = state.equipment[slot];
    const f = item ? flaskFor(item, content) : null;
    if (fs && f) fs.charges = Math.min(f.maxCharges, fs.charges + CHARGES_PER_KILL);
  }
  emit({ type: 'combatKill', monsterId: c.monster.defId, rarity: c.monster.rarity, time: t });
  const levelAfter = characterLevel(state.charXp);
  if (levelAfter > levelBefore) emit({ type: 'characterLevelUp', level: levelAfter, time: t });
  c.monster = spawnMonster(state, rng, t, content);
}

// ---------------------------------------------------------------- Minions

/** Keep persistent minions summoned (Spirit permitting); drop minions whose gem left the bar. */
function maintainMinions(state: GameState, ctx: CombatContext, t: number) {
  const c = state.combat!;
  const valid = new Set<number>();
  for (const sc of ctx.skills) {
    if (!sc?.minion) continue;
    if (sc.minion.persistent && !sc.reserved) continue;
    valid.add(sc.gemUid);
    if (!sc.minion.persistent) continue;
    const have = c.minions.filter((mi) => mi.gemUid === sc.gemUid).length;
    for (let i = have; i < sc.minion.count; i++) {
      c.minions.push({
        id: c.nextMinionId++,
        gemUid: sc.gemUid,
        life: sc.minion.life,
        maxLife: sc.minion.life,
        nextAt: t + sc.minion.intervalMs,
      });
    }
  }
  c.minions = c.minions.filter(
    (mi) => valid.has(mi.gemUid) && (mi.until === undefined || mi.until > t),
  );
  for (const mi of c.minions) {
    if (mi.reviveAt !== undefined && mi.reviveAt <= t) {
      const sc = ctx.skills.find((s) => s?.gemUid === mi.gemUid);
      mi.maxLife = sc?.minion?.life ?? mi.maxLife;
      mi.life = mi.maxLife;
      mi.reviveAt = undefined;
      mi.nextAt = t + (sc?.minion?.intervalMs ?? 1000);
    }
  }
}

function minionAction(
  state: GameState,
  mi: MinionInstance,
  rng: Rng,
  t: number,
  emit: Emit,
  content: Content,
) {
  const c = state.combat!;
  const ctx = ctxFor(state, t, content);
  const sc = ctx.skills.find((s) => s?.gemUid === mi.gemUid)?.minion;
  if (!sc) {
    mi.nextAt = t + 1000;
    return;
  }
  mi.nextAt = t + sc.intervalMs;
  const dmg = sc.damage * (0.8 + rng.float() * 0.4);
  const total = mitigateOnMonster(ctx, c.monster, sc.damageType, dmg, null, 0, t);
  c.monster.life -= total;
  emit({ type: 'minionHit', damage: total, time: t });
  if (c.monster.life <= 0) killMonster(state, rng, t, emit, content);
}

// ---------------------------------------------------------------- Monster

function monsterAction(state: GameState, rng: Rng, t: number, emit: Emit, content: Content) {
  const c = state.combat!;
  const m = c.monster;
  const ctx = ctxFor(state, t, content);
  const d = activeDebuffs(m, t);
  const chill = m.chill && m.chill.until > t ? m.chill.pct : 0;
  const slow = 1 / Math.max(0.25, 1 - (chill + d.slow) / 100);
  m.nextAt = t + Math.round(ctx.monster.attackIntervalMs * slow);

  // Target: the player or a living minion, weighted by threat.
  const living = c.minions.filter((mi) => mi.reviveAt === undefined && mi.life > 0);
  if (living.length > 0) {
    const options = [
      { weight: ctx.playerThreat, value: null as MinionInstance | null },
      ...living.map((mi) => ({
        weight: ctx.skills.find((s) => s?.gemUid === mi.gemUid)?.minion?.threat ?? 50,
        value: mi as MinionInstance | null,
      })),
    ];
    const target = rng.weighted(options);
    if (target) {
      const avg = Object.values(ctx.monster.hitByType).reduce((s, v) => s + (v ?? 0), 0);
      target.life -= avg * (0.75 + rng.float() * 0.5);
      if (target.life <= 0) {
        if (target.until === undefined) target.reviveAt = t + MINION_REVIVE_MS;
        else c.minions = c.minions.filter((x) => x !== target);
        emit({ type: 'minionDied', time: t });
      }
      return;
    }
  }

  const [hit, e] = rollEntropy(m.entropy, ctx.monsterHitChance);
  m.entropy = e;
  if (!hit) {
    emit({ type: 'combatEvade', time: t });
    return;
  }
  if (rng.chance(ctx.block)) {
    emit({ type: 'combatBlock', time: t });
    return;
  }
  const roll = 0.75 + rng.float() * 0.5;
  let taken = 0;
  for (const [type, avg] of Object.entries(ctx.monster.hitByType) as [DamageType, number][]) {
    const dmg = avg * roll;
    const after = type === 'physical' ? dmg * (1 - armourReduction(ctx.armour, dmg)) : dmg;
    taken += Math.max(0, after * ctx.takenMult[type]);
  }
  if (c.guard && c.guard.until > t) {
    const absorbed = Math.min(c.guard.absorb, taken);
    c.guard.absorb -= absorbed;
    taken -= absorbed;
    if (c.guard.absorb <= 0) c.guard = undefined;
  }
  const toEs = Math.min(c.es, taken);
  c.es -= toEs;
  c.life -= taken - toEs;
  c.lastHitAt = t;
  if (ctx.monster.leech > 0) m.life = Math.min(m.maxLife, m.life + taken * ctx.monster.leech);
  for (const slot of FLASK_SLOTS) {
    const fs = c.flasks[slot];
    const item = state.equipment[slot];
    const f = item ? flaskFor(item, content) : null;
    if (fs && f) fs.charges = Math.min(f.maxCharges, fs.charges + CHARGES_PER_HIT_TAKEN);
  }
  emit({ type: 'combatTaken', damage: taken, time: t });
  if (c.life <= 0) {
    die(state, t, emit, m.defId);
    return;
  }
  fireTriggers(state, rng, 'hit', t, emit, content);
}

function die(state: GameState, t: number, emit: Emit, killer: string) {
  const level = characterLevel(state.charXp);
  const c = state.combat!;
  state.stats.deaths++;
  state.stats.itemsLost +=
    Object.values(c.bag.items).reduce((a, b) => a + b, 0) + c.bag.gear.length;
  state.combat = null;
  emit({ type: 'death', killer, time: t });
  switch (state.character.mode) {
    case 'standard':
      state.charXp = xpAfterDeath(state.charXp);
      break;
    case 'hardcore':
      state.character.mode = 'standard';
      state.character.fellInHardcore = true;
      break;
    case 'mortal':
      state.dead = { at: t, cause: killer, level };
      break;
  }
}

// ---------------------------------------------------------------- Tick

function drinkFlask(state: GameState, slot: FlaskSlot, t: number, emit: Emit, content: Content) {
  const c = state.combat!;
  const fs = c.flasks[slot]!;
  const f = flaskFor(state.equipment[slot]!, content)!;
  fs.charges -= f.chargesPerUse;
  if (f.kind === 'life' || f.kind === 'mana')
    fs.recovery = { perMs: f.amount / f.durationMs, until: t + f.durationMs };
  else fs.activeUntil = t + f.durationMs;
  emit({ type: 'flaskUsed', slot, kind: f.kind, time: t });
}

function tick(state: GameState, t: number, emit: Emit, content: Content) {
  const c = state.combat!;
  const dt = COMBAT_TICK_MS;
  const ctx = ctxFor(state, t, content);
  const sec = dt / 1000;

  // Expiries.
  if (c.combo.points > 0 && t - c.combo.lastHitAt >= COMBO_DECAY_MS) c.combo.points = 0;
  c.buffs = c.buffs.filter((b) => b.until > t);
  if (c.guard && c.guard.until <= t) c.guard = undefined;
  c.monster.debuffs = c.monster.debuffs.filter((d) => d.until > t);
  maintainMinions(state, ctx, t);

  // Recovery.
  c.life = Math.min(ctx.maxLife, c.life + ctx.lifeRegenPerSec * sec);
  c.mana = Math.min(ctx.maxMana, c.mana + ctx.manaRegenPerSec * sec);
  if (t - c.lastHitAt >= ctx.esDelayMs)
    c.es = Math.min(ctx.maxEs, c.es + ctx.esRechargePerSec * sec);
  const leech = Math.min(c.leechPool, ctx.leechCapPerSec * sec);
  c.life = Math.min(ctx.maxLife, c.life + leech);
  c.leechPool -= leech;
  for (const slot of FLASK_SLOTS) {
    const fs = c.flasks[slot];
    if (!fs?.recovery) continue;
    const item = state.equipment[slot];
    const f = item ? flaskFor(item, content) : null;
    const amount = fs.recovery.perMs * dt;
    if (f?.kind === 'life') c.life = Math.min(ctx.maxLife, c.life + amount);
    if (f?.kind === 'mana') c.mana = Math.min(ctx.maxMana, c.mana + amount);
    if (fs.recovery.until <= t + dt) delete fs.recovery;
  }

  // Damage over time on the monster.
  const m = c.monster;
  const live = (d?: { until: number }) => !!d && d.until > t;
  m.poison = m.poison.filter((p) => p.until > t);
  const ign = live(m.ignite) ? m.ignite!.dps : 0;
  const bleed = live(m.bleed) ? m.bleed!.dps : 0;
  const poison = m.poison.reduce((s, p) => s + p.dps, 0);
  if (ign + bleed + poison > 0) {
    const dot =
      mitigateOnMonster(ctx, m, 'fire', ign * sec, null, 0, t) +
      // Bleed ignores armour (damage over time).
      bleed * sec * activeDebuffs(m, t).damageTaken * (live(m.shock) ? 1 + m.shock!.pct / 100 : 1) +
      mitigateOnMonster(ctx, m, 'chaos', poison * sec, null, 0, t);
    m.life -= dot;
    if (m.life <= 0) killMonster(state, rngFor(state, STREAM), t, emit, content);
  }

  // Flask auto-use.
  if (state.combat) {
    for (const slot of FLASK_SLOTS) {
      const fs = c.flasks[slot];
      const item = state.equipment[slot];
      const rule = state.combatSettings.flaskRules[slot];
      if (!fs || !item || !rule || rule.mode === 'off') continue;
      const f = flaskFor(item, content);
      if (!f || fs.charges < f.chargesPerUse) continue;
      const recovering = !!fs.recovery;
      const active = !!fs.activeUntil && fs.activeUntil > t;
      const want =
        (rule.mode === 'lifeBelow' &&
          !recovering &&
          (c.life / ctx.maxLife) * 100 < rule.threshold) ||
        (rule.mode === 'manaBelow' &&
          !recovering &&
          ctx.maxMana > 0 &&
          (c.mana / ctx.maxMana) * 100 < rule.threshold) ||
        (rule.mode === 'whenInactive' && !active && f.kind !== 'life' && f.kind !== 'mana');
      if (want) drinkFlask(state, slot, t, emit, content);
    }
  }

  // Waystone auto-bank.
  const minutes = buildingValue(state, 'building.waystone', content);
  if (state.combat && minutes > 0 && t - c.lastBankAt >= minutes * 60_000) {
    bankBag(state, c.bag, content);
    c.lastBankAt = t;
    emit({ type: 'autoBanked', time: t });
  }

  if (state.combat) c.tickAt = t + dt;
}

/**
 * Combat runs on four clocks: the player's actions, the monster's attacks, each
 * minion's attacks, and a 500ms tick for regeneration, damage over time, expiries,
 * flasks and auto-banking. Order at equal times: tick, player, minions, monster.
 */
export const combatSystem: System = {
  id: 'combat',

  nextEventTime(state) {
    const c = state.combat;
    if (!c) return Infinity;
    let t = Math.min(c.tickAt, c.playerNextAt, c.monster.nextAt);
    for (const mi of c.minions) if (mi.reviveAt === undefined && mi.nextAt < t) t = mi.nextAt;
    return t;
  },

  processEvent(state, sctx: SimContext) {
    const t = state.time;
    const content = sctx.content;
    const rng = rngFor(state, STREAM);
    if (state.combat && state.combat.tickAt === t) tick(state, t, sctx.emit, content);
    if (state.combat && state.combat.playerNextAt === t)
      playerAction(state, rng, t, sctx.emit, content);
    if (state.combat) {
      for (const mi of [...state.combat.minions]) {
        if (!state.combat) break;
        if (mi.reviveAt === undefined && mi.nextAt <= t && state.combat.minions.includes(mi))
          minionAction(state, mi, rng, t, sctx.emit, content);
      }
    }
    if (state.combat && state.combat.monster.nextAt <= t)
      monsterAction(state, rng, t, sctx.emit, content);
  },
};
