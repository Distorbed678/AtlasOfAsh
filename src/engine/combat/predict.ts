import { CONTENT, type Content } from '../content';
import { FLASK_SLOTS } from '../content/types';
import { armourReduction } from '../stats/formulas';
import type { DamageType } from '../stats/types';
import type { GameState } from '../state';
import { combatContext, type CombatContext, type OffenceContext } from './context';
import { CHARGES_PER_HIT_TAKEN, CHARGES_PER_KILL, flaskFor } from './flasks';
import { DROP_CHANCES } from './loot';
import { RARITY_CHANCE, RARITY_SCALE } from './monsterStats';
import { startCombat } from './combatSystem';

export type Risk = 'safe' | 'risky' | 'deadly';

export interface MonsterPrediction {
  monsterId: string;
  weight: number;
  ttkSec: number;
  playerDps: number;
  takenDps: number;
  /** Largest single hit the monster can deal after mitigation. */
  maxHit: number;
}

export interface ZonePrediction {
  zoneId: string;
  killsPerHour: number;
  xpPerHour: number;
  goldPerHour: number;
  gearPerHour: number;
  /** Life lost per kill after regen, leech and flasks (negative = sustainable). */
  drainPerKill: number;
  killsToDeath: number;
  risk: Risk;
  monsters: MonsterPrediction[];
}

const AVG = {
  life:
    (1 - RARITY_CHANCE.magic - RARITY_CHANCE.rare) * 1 +
    RARITY_CHANCE.magic * RARITY_SCALE.magic.life +
    RARITY_CHANCE.rare * RARITY_SCALE.rare.life,
  rolls:
    (1 - RARITY_CHANCE.magic - RARITY_CHANCE.rare) * 1 +
    RARITY_CHANCE.magic * RARITY_SCALE.magic.lootRolls +
    RARITY_CHANCE.rare * RARITY_SCALE.rare.lootRolls,
};

/** The damaging skill the rotation leans on: the first usable, untriggered one in the bar. */
export function mainOffence(ctx: CombatContext): OffenceContext {
  const sc = ctx.skills.find((s) => s?.usable && s.offence && !s.trigger);
  return sc?.offence ?? ctx.spell ?? ctx.attack;
}

/**
 * Expected damage per second: the main skill (blended with the free fallback when
 * mana regeneration can't keep up) plus persistent minions.
 */
export function effectiveDps(ctx: CombatContext): {
  dps: number;
  skillDps: number;
  minionDps: number;
  leechDps: number;
} {
  const main = mainOffence(ctx);
  const fallback = ctx.spell ?? ctx.attack;
  let skillDps = main.dps;
  let leechDps = (main.dps * main.leechPct) / 100;
  if (main !== fallback && main.manaCost > 0) {
    const need = (main.manaCost * 1000) / main.intervalMs;
    const frac = Math.min(1, ctx.manaRegenPerSec / need);
    skillDps = frac * main.dps + (1 - frac) * fallback.dps;
    leechDps =
      (frac * main.dps * main.leechPct + (1 - frac) * fallback.dps * fallback.leechPct) / 100;
  }
  let minionDps = 0;
  for (const sc of ctx.skills) {
    const m = sc?.minion;
    if (!m || !sc.usable || (m.persistent && !sc.reserved)) continue;
    const uptime = m.persistent
      ? 1
      : Math.min(1, (m.durationMs ?? 5000) / Math.max(sc.cooldownMs, m.durationMs ?? 5000));
    minionDps += ((m.count * m.damage * 1000) / m.intervalMs) * uptime * 0.85;
  }
  return { dps: skillDps + minionDps, skillDps, minionDps, leechDps };
}

/**
 * Steady-state estimate of fighting in a zone with current gear, from the same
 * combat context the simulation uses (hit chance, crit, mitigation, regen).
 * Damage over time and monster mods are not included, so it is a guide.
 */
export function predictZone(
  state: GameState,
  zoneId: string,
  content: Content = CONTENT,
): ZonePrediction {
  const zone = content.zones.get(zoneId);
  const probe = structuredClone(state);
  probe.combat = null;
  startCombat(probe, zoneId, content);
  const monsters: MonsterPrediction[] = [];
  let pool = 0;
  let flaskPerKill = 0;
  let wTtk = 0;
  let wDrain = 0;
  let wXp = 0;
  let wMaxHit = 0;
  const totalWeight = zone.monsters.reduce((s, m) => s + m.weight, 0);

  for (const { monsterId, weight } of zone.monsters) {
    probe.combat!.monster = {
      ...probe.combat!.monster,
      defId: monsterId,
      rarity: 'normal',
      mods: [],
      level: zone.level,
    };
    const ctx = combatContext(probe, probe.time, content);
    const eff = effectiveDps(ctx);
    const ttk = (ctx.monster.maxLife * AVG.life) / Math.max(0.01, eff.dps);
    let perHit = 0;
    let maxHit = 0;
    for (const [type, avg] of Object.entries(ctx.monster.hitByType) as [DamageType, number][]) {
      const mit = (dmg: number) =>
        (type === 'physical' ? dmg * (1 - armourReduction(ctx.armour, dmg)) : dmg) *
        ctx.takenMult[type];
      perHit += mit(avg);
      maxHit += mit(avg * 1.25);
    }
    const hitsPerSec =
      (1000 / ctx.monster.attackIntervalMs) * ctx.monsterHitChance * (1 - ctx.block);
    const takenDps = perHit * hitsPerSec;
    pool = ctx.maxLife + ctx.maxEs;
    const sustain = ctx.lifeRegenPerSec + Math.min(ctx.leechCapPerSec, eff.leechDps);
    const share = weight / totalWeight;
    let flask = 0;
    for (const slot of FLASK_SLOTS) {
      const item = state.equipment[slot];
      const f = item ? flaskFor(item, content) : null;
      if (f?.kind === 'life' && state.combatSettings.flaskRules[slot]?.mode !== 'off')
        flask +=
          (f.amount * (CHARGES_PER_KILL + CHARGES_PER_HIT_TAKEN * hitsPerSec * ttk)) /
          f.chargesPerUse;
    }
    flaskPerKill += share * flask;
    wTtk += share * ttk;
    wDrain += share * (takenDps - sustain) * ttk;
    wXp += share * ctx.monster.xp;
    wMaxHit = Math.max(wMaxHit, maxHit);
    monsters.push({ monsterId, weight, ttkSec: ttk, playerDps: eff.dps, takenDps, maxHit });
  }

  const killsPerHour = 3600 / wTtk;
  const drainPerKill = wDrain - flaskPerKill;
  const killsToDeath = drainPerKill <= 0 ? Infinity : pool / drainPerKill;
  const risk: Risk =
    wMaxHit * 1.5 >= pool || killsToDeath < 15 ? 'deadly' : drainPerKill > 0 ? 'risky' : 'safe';
  return {
    zoneId,
    killsPerHour,
    xpPerHour: killsPerHour * wXp * AVG.life,
    goldPerHour: killsPerHour * AVG.rolls * DROP_CHANCES.gold * ((1 + 2 + zone.level) / 2),
    gearPerHour: killsPerHour * AVG.rolls * DROP_CHANCES.gear,
    drainPerKill,
    killsToDeath,
    risk,
    monsters,
  };
}
