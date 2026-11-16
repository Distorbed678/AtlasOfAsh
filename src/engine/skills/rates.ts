import { CONTENT, type Content } from '../content';
import type { ActionDef, WeightedItem } from '../content/types';
import { workerXpShare } from '../economy/town';
import type { GameState } from '../state';
import { cycleDuration, maxRockHp, skillLevel, THIEVING_STUN_MS, type RunnerRef } from './actions';
import { playerModifiers, thievingSuccessChance, workerModifiers } from './mastery';

const HOUR = 3_600_000;

export interface ActionRates {
  /** Completed attempts per hour (including failed pickpockets). */
  actionsPerHour: number;
  xpPerHour: number;
  goldPerHour: number;
  /** Expected items per hour by item id (includes doubling and rare finds). */
  itemsPerHour: Record<string, number>;
  /** Average wall time per attempt including respawn/stun downtime. */
  msPerAction: number;
  successChance: number;
}

function addTable(out: Record<string, number>, table: readonly WeightedItem[], scale: number) {
  const total = table.reduce((s, e) => s + e.weight, 0);
  for (const e of table) {
    out[e.itemId] = (out[e.itemId] ?? 0) + (scale * e.weight * (e.min + e.max)) / 2 / total;
  }
}

/**
 * Expected steady-state rates for an action at the runner's current mastery and
 * Town bonuses. Mirrors `completeCycle` exactly, so the UI and balance reports
 * agree with what the simulation actually produces.
 */
export function actionRates(
  state: GameState,
  def: ActionDef,
  ref: RunnerRef = { kind: 'player' },
  content: Content = CONTENT,
): ActionRates {
  const isPlayer = ref.kind === 'player';
  const lvl = skillLevel(state, def.skillId);
  const mods = isPlayer ? playerModifiers(state, def, lvl, content) : workerModifiers(lvl);
  const duration = cycleDuration(state, def, ref, content);
  const p = def.type === 'thieve' ? thievingSuccessChance(mods.stealth, def.perception) : 1;

  let msPerAction = duration;
  if (def.type === 'rock') msPerAction += def.respawnMs / maxRockHp(state, def, ref, content);
  if (def.type === 'thieve') msPerAction += (1 - p) * THIEVING_STUN_MS;

  // Per-attempt expectations.
  const items: Record<string, number> = {};
  const doubled = 1 + mods.doubleChance;
  switch (def.type) {
    case 'simple':
    case 'rock':
      items[def.itemId] = def.qty * doubled;
      break;
    case 'catch':
      addTable(items, def.table, doubled);
      break;
    case 'bundle':
      addTable(items, def.table, ((def.picks[0] + def.picks[1]) / 2) * doubled);
      break;
    case 'thieve':
      for (const r of def.rares) items[r.itemId] = (items[r.itemId] ?? 0) + p * r.chance;
      break;
  }
  for (const r of content.skills.get(def.skillId).rareFinds) {
    items[r.itemId] = (items[r.itemId] ?? 0) + p * r.chance;
  }
  const gold = def.type === 'thieve' ? (p * (def.gold[0] + def.gold[1])) / 2 : 0;
  const xpBase = p * def.xp + (1 - p) * Math.floor(def.xp / 4);
  const xpMult = isPlayer ? mods.skillXpMult : workerXpShare(state, content);

  const perHour = HOUR / msPerAction;
  const itemsPerHour: Record<string, number> = {};
  for (const [id, n] of Object.entries(items)) itemsPerHour[id] = n * perHour;
  return {
    actionsPerHour: perHour,
    xpPerHour: xpBase * xpMult * perHour,
    goldPerHour: gold * perHour,
    itemsPerHour,
    msPerAction,
    successChance: p,
  };
}
