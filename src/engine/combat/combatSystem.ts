import { CONTENT, type Content } from '../content';
import { FLASK_SLOTS, type FlaskSlot } from '../content/types';
import type { Rng } from '../core/rng';
import { buildingValue } from '../economy/town';
import type { SimContext, SimEvent, System } from '../sim';
import { AILMENT_RULES } from '../stats/ailments';
import { armourReduction, rollEntropy } from '../stats/formulas';
import { DAMAGE_TYPES, type DamageType } from '../stats/types';
import { rngFor, type CombatState, type GameState, type MonsterInstance } from '../state';
import { combatContext, type CombatContext, type OffenceContext } from './context';
import { CHARGES_PER_HIT_TAKEN, CHARGES_PER_KILL, flaskFor } from './flasks';
import { bankBag, collectDrops, emptyBag, pickZoneMonster, rollDrops } from './loot';
import { monsterStats, RARITY_CHANCE, type MonsterRarity } from './monsterStats';
import { characterLevel, xpAfterDeath } from './progression';

export const COMBAT_TICK_MS = 500;
export const RETREAT_COOLDOWN_MS = 15_000;
const STREAM = 'combat';

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
  };
}

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
  };
  state.combat.monster = spawnMonster(state, rng, t, content);
  const ctx = combatContext(state, t, content);
  state.combat.life = ctx.maxLife;
  state.combat.mana = ctx.maxMana;
  state.combat.es = ctx.maxEs;
  state.combat.playerNextAt = t + chooseSkill(state, ctx).intervalMs;
}

/** Stop combat, banking the trip bag. */
export function stopCombat(state: GameState, content: Content = CONTENT): void {
  if (!state.combat) return;
  bankBag(state, state.combat.bag, content);
  // Gear that didn't fit in the stash is lost when leaving combat.
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
  c.playerNextAt = state.time + chooseSkill(state, ctx).intervalMs;
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

function chooseSkill(state: GameState, ctx: CombatContext): OffenceContext {
  const c = state.combat!;
  if (ctx.spell && c.mana >= ctx.spell.manaCost) return ctx.spell;
  return ctx.attack;
}

// ---------------------------------------------------------------- Events

function emitLog(emit: (e: SimEvent) => void, e: SimEvent) {
  emit(e);
}

function playerAction(
  state: GameState,
  rng: Rng,
  t: number,
  emit: (e: SimEvent) => void,
  content: Content,
) {
  const c = state.combat!;
  const ctx = combatContext(state, t, content);
  const off = chooseSkill(state, ctx);
  c.mana -= off.manaCost;
  c.playerNextAt = t + off.intervalMs;
  const m = c.monster;

  if (off.isAttack) {
    const [hit, e] = rollEntropy(c.playerEntropy, off.hitChance);
    c.playerEntropy = e;
    if (!hit) {
      emitLog(emit, { type: 'combatMiss', time: t });
      return;
    }
  }
  const crit = rng.chance(off.critChance);
  const shock = m.shock && m.shock.until > t ? 1 + m.shock.pct / 100 : 1;
  let total = 0;
  const raw: Partial<Record<DamageType, number>> = {};
  for (const type of DAMAGE_TYPES) {
    const r = off.ranges[type];
    if (!r) continue;
    let dmg = r[0] + rng.float() * (r[1] - r[0]);
    if (crit) dmg *= 1 + off.critBonus;
    raw[type] = dmg;
    const after =
      type === 'physical'
        ? dmg * (1 - armourReduction(ctx.monster.armour, dmg))
        : dmg * (1 - (ctx.monster.resists[type] - off.penetration[type]) / 100);
    total += Math.max(0, after) * shock;
  }
  m.life -= total;
  c.leechPool += (total * off.leechPct) / 100;
  emitLog(emit, { type: 'combatHit', damage: total, crit, skill: off.skillId, time: t });
  applyAilments(m, off, raw, ctx.monster.ailmentThreshold, rng, t);
  if (m.life <= 0) killMonster(state, rng, t, emit, content);
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

function killMonster(
  state: GameState,
  rng: Rng,
  t: number,
  emit: (e: SimEvent) => void,
  content: Content,
) {
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

function monsterAction(
  state: GameState,
  rng: Rng,
  t: number,
  emit: (e: SimEvent) => void,
  content: Content,
) {
  const c = state.combat!;
  const m = c.monster;
  const ctx = combatContext(state, t, content);
  const slow = m.chill && m.chill.until > t ? 1 / (1 - m.chill.pct / 100) : 1;
  m.nextAt = t + Math.round(ctx.monster.attackIntervalMs * slow);
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
  if (c.life <= 0) die(state, t, emit, content, m.defId);
}

function die(
  state: GameState,
  t: number,
  emit: (e: SimEvent) => void,
  content: Content,
  killer: string,
) {
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
  void content;
}

function drinkFlask(
  state: GameState,
  slot: FlaskSlot,
  t: number,
  emit: (e: SimEvent) => void,
  content: Content,
) {
  const c = state.combat!;
  const fs = c.flasks[slot]!;
  const f = flaskFor(state.equipment[slot]!, content)!;
  fs.charges -= f.chargesPerUse;
  if (f.kind === 'life' || f.kind === 'mana')
    fs.recovery = { perMs: f.amount / f.durationMs, until: t + f.durationMs };
  else fs.activeUntil = t + f.durationMs;
  if (f.kind === 'cleansing') {
    // No monster ailments on the player yet (Phase 4); the effect is reserved for later.
  }
  emit({ type: 'flaskUsed', slot, kind: f.kind, time: t });
}

function tick(state: GameState, t: number, emit: (e: SimEvent) => void, content: Content) {
  const c = state.combat!;
  const dt = COMBAT_TICK_MS;
  const ctx = combatContext(state, t, content);
  const sec = dt / 1000;

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
  const dotDps =
    (live(m.ignite) ? m.ignite!.dps : 0) +
    (live(m.bleed) ? m.bleed!.dps : 0) +
    m.poison.reduce((s, p) => s + p.dps, 0);
  if (dotDps > 0) {
    const shock = live(m.shock) ? 1 + m.shock!.pct / 100 : 1;
    const resisted = (type: 'fire' | 'chaos') => 1 - ctx.monster.resists[type] / 100;
    const ign = live(m.ignite) ? m.ignite!.dps * resisted('fire') : 0;
    const bleed = live(m.bleed) ? m.bleed!.dps : 0;
    const poison = m.poison.reduce((s, p) => s + p.dps, 0) * resisted('chaos');
    m.life -= (ign + bleed + poison) * sec * shock;
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
 * Combat runs on three clocks: the player's actions, the monster's attacks and
 * a 500ms tick for regeneration, damage over time, flasks and auto-banking.
 * Order at equal times: tick, player, monster.
 */
export const combatSystem: System = {
  id: 'combat',

  nextEventTime(state) {
    const c = state.combat;
    if (!c) return Infinity;
    return Math.min(c.tickAt, c.playerNextAt, c.monster.nextAt);
  },

  processEvent(state, sctx: SimContext) {
    const t = state.time;
    const content = sctx.content;
    const rng = rngFor(state, STREAM);
    if (state.combat && state.combat.tickAt === t) tick(state, t, sctx.emit, content);
    if (state.combat && state.combat.playerNextAt === t)
      playerAction(state, rng, t, sctx.emit, content);
    if (state.combat && state.combat.monster.nextAt <= t)
      monsterAction(state, rng, t, sctx.emit, content);
  },
};
