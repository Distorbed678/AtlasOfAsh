import { CONTENT, type Content } from '../content';
import type { ActionDef, WeightedItem } from '../content/types';
import type { Rng } from '../core/rng';
import { addGold, addItem, hasItems, removeItem } from '../economy/bank';
import { newItem, newUnique } from '../items/generate';
import { addToStash, allocateUid, stashFree } from '../items/stash';
import { wageMultiplier, workerEfficiency, workerXpShare } from '../economy/town';
import type { SimEvent } from '../sim';
import { rngFor, type GameState, type Runner } from '../state';
import {
  masteryXpPerAction,
  playerModifiers,
  poolCap,
  POOL_SHARE,
  thievingSuccessChance,
  workerModifiers,
  type ActionModifiers,
} from './mastery';
import { levelForXp } from './xp';

export const THIEVING_STUN_MS = 3000;

/** Who is running an action: the player, or worker slot N. */
export type RunnerRef = { kind: 'player' } | { kind: 'worker'; slot: number };

export function skillLevel(state: GameState, skillId: ActionDef['skillId']): number {
  return levelForXp(state.skills[skillId].xp);
}

export function canPerform(state: GameState, def: ActionDef): boolean {
  return skillLevel(state, def.skillId) >= def.level;
}

/** Why a cycle can't start right now (crafting needs materials / stash space), or null. */
export function cycleBlocker(state: GameState, def: ActionDef): 'materials' | 'stash' | null {
  if (def.type !== 'craft') return null;
  if (!hasItems(state, def.inputs)) return 'materials';
  if (def.output.kind !== 'item' && stashFree(state) < 1) return 'stash';
  return null;
}

/** Crafted gear rarity chances (player mastery raises them; workers use the base). */
export function craftRarityChances(masteryLvl: number): { magic: number; rare: number } {
  return { magic: 0.05 + 0.0005 * masteryLvl, rare: 0.01 + 0.0002 * masteryLvl };
}

function modifiersFor(
  state: GameState,
  def: ActionDef,
  ref: RunnerRef,
  content: Content,
): ActionModifiers {
  const lvl = skillLevel(state, def.skillId);
  return ref.kind === 'player' ? playerModifiers(state, def, lvl, content) : workerModifiers(lvl);
}

/** Effective cycle length in ms for this runner (mastery for the player, efficiency for workers). */
export function cycleDuration(
  state: GameState,
  def: ActionDef,
  ref: RunnerRef,
  content: Content = CONTENT,
): number {
  if (ref.kind === 'player') {
    return Math.max(
      100,
      Math.round(def.durationMs * modifiersFor(state, def, ref, content).durationMult),
    );
  }
  return Math.round(def.durationMs / workerEfficiency(state, content));
}

export function maxRockHp(
  state: GameState,
  def: ActionDef,
  ref: RunnerRef,
  content: Content = CONTENT,
): number {
  if (def.type !== 'rock') return 0;
  return def.rockHp + modifiersFor(state, def, ref, content).rockHpBonus;
}

export function successChance(
  state: GameState,
  def: ActionDef,
  ref: RunnerRef,
  content: Content = CONTENT,
): number {
  if (def.type !== 'thieve') return 1;
  return thievingSuccessChance(modifiersFor(state, def, ref, content).stealth, def.perception);
}

export function startRunner(
  state: GameState,
  def: ActionDef,
  ref: RunnerRef,
  at: number,
  content: Content = CONTENT,
): Runner {
  const runner: Runner = {
    actionId: def.id,
    startedAt: at,
    nextAt: at + cycleDuration(state, def, ref, content),
  };
  if (def.type === 'rock') runner.rockHp = maxRockHp(state, def, ref, content);
  return runner;
}

function rollWeighted(rng: Rng, table: readonly WeightedItem[]): { itemId: string; qty: number } {
  const pick = rng.weighted(table.map((e) => ({ weight: e.weight, value: e })));
  return {
    itemId: pick.itemId,
    qty: pick.min === pick.max ? pick.min : rng.int(pick.min, pick.max),
  };
}

function streamFor(ref: RunnerRef): string {
  return ref.kind === 'player' ? 'player' : `worker:${ref.slot}`;
}

/**
 * Resolve the cycle that just finished at `runner.nextAt` and schedule the next.
 * Rewards, XP, mastery, rare finds, rock depletion and thieving stuns live here.
 */
export function completeCycle(
  state: GameState,
  runner: Runner,
  ref: RunnerRef,
  emit: (e: SimEvent) => void,
  content: Content = CONTENT,
): boolean {
  const def = content.actions.get(runner.actionId);
  // Crafting: materials may have been used up (or the stash filled) since the cycle began.
  if (cycleBlocker(state, def)) return false;
  const skill = state.skills[def.skillId];
  const mods = modifiersFor(state, def, ref, content);
  const rng = rngFor(state, streamFor(ref));
  const isPlayer = ref.kind === 'player';
  const now = runner.nextAt;
  const gained: { itemId: string; qty: number }[] = [];
  let succeeded = true;

  // --- Rewards ---
  switch (def.type) {
    case 'simple':
    case 'rock':
      gained.push({ itemId: def.itemId, qty: def.qty });
      break;
    case 'catch':
      gained.push(rollWeighted(rng, def.table));
      break;
    case 'bundle': {
      const picks = rng.int(def.picks[0], def.picks[1]);
      for (let i = 0; i < picks; i++) gained.push(rollWeighted(rng, def.table));
      break;
    }
    case 'thieve':
      succeeded = rng.chance(thievingSuccessChance(mods.stealth, def.perception));
      if (succeeded) {
        const gold = rng.int(def.gold[0], def.gold[1]);
        addGold(state, gold);
        for (const r of def.rares)
          if (rng.chance(r.chance)) gained.push({ itemId: r.itemId, qty: 1 });
      } else {
        state.stats.thievingFails++;
      }
      break;
    case 'craft': {
      for (const [id, qty] of Object.entries(def.inputs)) removeItem(state, id, qty);
      const out = def.output;
      if (out.kind === 'item') {
        gained.push({ itemId: out.itemId, qty: out.qty });
      } else {
        const uid = allocateUid(state);
        let item;
        if (out.kind === 'unique') item = newUnique(uid, out.uniqueId, rng, content);
        else {
          const base = content.bases.get(out.baseId);
          const ilvl = Math.max(1, Math.min(base.tier * 10, levelForXp(skill.xp)));
          const chances = craftRarityChances(isPlayer ? masteryLevelOf(state, def) : 0);
          const roll = rng.float();
          const rarity =
            roll < chances.rare ? 'rare' : roll < chances.rare + chances.magic ? 'magic' : 'normal';
          item = newItem(uid, base.id, ilvl, rarity, rng, content);
        }
        addToStash(state, item);
        state.stats.itemsCrafted++;
        emit({ type: 'gearCrafted', uid: item.uid, time: now });
      }
      break;
    }
  }

  const doubleable = def.type !== 'craft' || def.output.kind === 'item';
  if (succeeded && doubleable && mods.doubleChance > 0 && rng.chance(mods.doubleChance)) {
    for (const g of [...gained]) gained.push({ ...g });
  }
  if (succeeded) {
    for (const r of content.skills.get(def.skillId).rareFinds) {
      if (rng.chance(r.chance)) gained.push({ itemId: r.itemId, qty: 1 });
    }
  }
  for (const g of gained) {
    const added = addItem(state, g.itemId, g.qty, content);
    if (added > 0) emit({ type: 'itemGained', itemId: g.itemId, qty: added, time: now });
  }

  // --- XP & mastery (a failed pickpocket still teaches a little) ---
  const xpBase = succeeded ? def.xp : Math.floor(def.xp / 4);
  const levelBefore = levelForXp(skill.xp);
  if (isPlayer) {
    skill.xp += xpBase * mods.skillXpMult;
    if (succeeded) {
      const mxp = masteryXpPerAction(def) * mods.masteryXpMult;
      skill.mastery[def.id] = (skill.mastery[def.id] ?? 0) + mxp;
      skill.pool = Math.min(poolCap(def.skillId, content), skill.pool + mxp * POOL_SHARE);
    }
    state.stats.actionsCompleted++;
  } else {
    skill.xp += xpBase * workerXpShare(state, content);
    state.stats.workerActions++;
  }
  const levelAfter = levelForXp(skill.xp);
  if (levelAfter > levelBefore)
    emit({ type: 'levelUp', skillId: def.skillId, level: levelAfter, time: now });
  emit({ type: 'actionComplete', actionId: def.id, time: now });

  // --- Schedule the next cycle (absolute times) ---
  const duration = cycleDuration(state, def, ref, content);
  runner.rockRespawnAt = undefined;
  runner.stunnedUntil = undefined;
  let nextStart = now;
  if (def.type === 'rock') {
    runner.rockHp = (runner.rockHp ?? maxRockHp(state, def, ref, content)) - 1;
    if (runner.rockHp <= 0) {
      nextStart = now + def.respawnMs;
      runner.rockRespawnAt = nextStart;
      runner.rockHp = maxRockHp(state, def, ref, content);
    }
  } else if (def.type === 'thieve' && !succeeded) {
    nextStart = now + THIEVING_STUN_MS;
    runner.stunnedUntil = nextStart;
  }
  runner.startedAt = nextStart;
  runner.nextAt = nextStart + duration;
  // Stop if the next craft can't happen.
  return cycleBlocker(state, def) === null;
}

function masteryLevelOf(state: GameState, def: ActionDef): number {
  return levelForXp(state.skills[def.skillId].mastery[def.id] ?? 0, 99);
}

/** Average vendor value of one cycle's output (used for worker wages). */
export function expectedCycleValue(def: ActionDef, content: Content = CONTENT): number {
  const price = (id: string) => content.items.get(id).sellPrice;
  const tableAvg = (table: readonly WeightedItem[]) => {
    const total = table.reduce((s, e) => s + e.weight, 0);
    return table.reduce(
      (s, e) => s + (e.weight / total) * price(e.itemId) * ((e.min + e.max) / 2),
      0,
    );
  };
  switch (def.type) {
    case 'simple':
    case 'rock':
      return price(def.itemId) * def.qty;
    case 'catch':
      return tableAvg(def.table);
    case 'bundle':
      return ((def.picks[0] + def.picks[1]) / 2) * tableAvg(def.table);
    case 'thieve':
      return 0.7 * ((def.gold[0] + def.gold[1]) / 2);
    case 'craft': {
      const out = def.output;
      if (out.kind === 'item') return price(out.itemId) * out.qty;
      const baseId = out.kind === 'gear' ? out.baseId : content.uniques.get(out.uniqueId).baseId;
      return content.bases.get(baseId).sellPrice;
    }
  }
}

/** Gold a worker is paid per cycle of this action. */
export function wagePerCycle(state: GameState, def: ActionDef, content: Content = CONTENT): number {
  return Math.max(1, Math.round(expectedCycleValue(def, content) * wageMultiplier(state)));
}

export function wagePerHour(state: GameState, def: ActionDef, content: Content = CONTENT): number {
  const cycles = 3_600_000 / cycleDuration(state, def, { kind: 'worker', slot: 0 }, content);
  return wagePerCycle(state, def, content) * cycles;
}
