import { CONTENT, type Content } from './content';
import type { SkillId } from './content/types';
import { addGold, addItem, hasItems, isLocked, removeItem } from './economy/bank';
import { buildingTier } from './economy/town';
import { refundWorker, syncWorkerSlots, tryStartWorkerCycle } from './economy/workers';
import { canPerform, startRunner } from './skills/actions';
import { masteryLevel, poolCostForNextMastery } from './skills/mastery';
import { rngFor, type GameState } from './state';

/** Player intents. Applied at the current sim time, between events. */
export type Command =
  | { type: 'startAction'; actionId: string }
  | { type: 'stopAction' }
  | { type: 'sellItem'; itemId: string; qty: number }
  | { type: 'openItem'; itemId: string; qty: number }
  | { type: 'toggleLock'; itemId: string }
  | { type: 'createTab'; name: string }
  | { type: 'renameTab'; tabId: number; name: string }
  | { type: 'deleteTab'; tabId: number }
  | { type: 'moveToTab'; itemId: string; tabId: number }
  | { type: 'upgradeBuilding'; buildingId: string }
  | { type: 'assignWorker'; slot: number; actionId: string | null }
  | { type: 'spendPool'; skillId: SkillId; actionId: string };

export class CommandError extends Error {}

const MAX_TABS = 10;
const MAX_OPEN_PER_COMMAND = 1000;

function cleanName(name: string): string {
  const n = name.trim().slice(0, 24);
  if (!n) throw new CommandError('Name cannot be empty');
  return n;
}

export function applyCommand(state: GameState, cmd: Command, content: Content = CONTENT): void {
  switch (cmd.type) {
    case 'startAction': {
      const def = content.actions.get(cmd.actionId);
      if (!canPerform(state, def)) throw new CommandError('Level too low');
      if (state.action?.actionId === def.id) return;
      state.action = startRunner(state, def, { kind: 'player' }, state.time, content);
      return;
    }
    case 'stopAction':
      state.action = null;
      return;

    case 'sellItem': {
      const item = content.items.get(cmd.itemId);
      if (isLocked(state, item.id)) throw new CommandError('Item is locked');
      const qty = Math.min(Math.max(0, Math.floor(cmd.qty)), state.bank.items[item.id] ?? 0);
      if (qty === 0) return;
      removeItem(state, item.id, qty);
      addGold(state, qty * item.sellPrice);
      return;
    }
    case 'openItem': {
      const item = content.items.get(cmd.itemId);
      if (!item.container) throw new CommandError('Item cannot be opened');
      const qty = Math.min(
        Math.max(0, Math.floor(cmd.qty)),
        state.bank.items[item.id] ?? 0,
        MAX_OPEN_PER_COMMAND,
      );
      const rng = rngFor(state, 'containers');
      for (let i = 0; i < qty; i++) {
        removeItem(state, item.id, 1);
        addGold(state, rng.int(item.container.gold[0], item.container.gold[1]));
        for (let r = 0; r < item.container.rolls; r++) {
          const e = rng.weighted(item.container.items.map((x) => ({ weight: x.weight, value: x })));
          addItem(state, e.itemId, rng.int(e.min, e.max), content);
        }
      }
      return;
    }
    case 'toggleLock': {
      const locked = state.bank.locked;
      const i = locked.indexOf(cmd.itemId);
      if (i >= 0) locked.splice(i, 1);
      else locked.push(content.items.get(cmd.itemId).id);
      return;
    }

    case 'createTab': {
      if (state.bank.tabs.length >= MAX_TABS) throw new CommandError('Too many tabs');
      state.bank.tabs.push({ id: state.bank.nextTabId++, name: cleanName(cmd.name) });
      return;
    }
    case 'renameTab': {
      const tab = state.bank.tabs.find((t) => t.id === cmd.tabId);
      if (!tab) throw new CommandError('No such tab');
      tab.name = cleanName(cmd.name);
      return;
    }
    case 'deleteTab': {
      if (cmd.tabId === 0) throw new CommandError('The main tab cannot be deleted');
      state.bank.tabs = state.bank.tabs.filter((t) => t.id !== cmd.tabId);
      for (const [id, tab] of Object.entries(state.bank.tabOf))
        if (tab === cmd.tabId) delete state.bank.tabOf[id];
      return;
    }
    case 'moveToTab': {
      if (!state.bank.tabs.some((t) => t.id === cmd.tabId)) throw new CommandError('No such tab');
      if (cmd.tabId === 0) delete state.bank.tabOf[cmd.itemId];
      else state.bank.tabOf[content.items.get(cmd.itemId).id] = cmd.tabId;
      return;
    }

    case 'upgradeBuilding': {
      const def = content.buildings.get(cmd.buildingId);
      const tier = buildingTier(state, def.id);
      const cost = def.tiers[tier];
      if (!cost) throw new CommandError('Already at max tier');
      if (state.gold < cost.gold || !hasItems(state, cost.items))
        throw new CommandError('Cannot afford upgrade');
      state.gold -= cost.gold;
      for (const [id, qty] of Object.entries(cost.items)) removeItem(state, id, qty);
      state.town[def.id] = tier + 1;
      syncWorkerSlots(state, content);
      return;
    }

    case 'assignWorker': {
      syncWorkerSlots(state, content);
      const w = state.workers[cmd.slot];
      if (!w) throw new CommandError('No such worker slot');
      if (cmd.actionId !== null) {
        const def = content.actions.get(cmd.actionId);
        if (!canPerform(state, def)) throw new CommandError('Level too low');
        if (w.actionId === def.id) return;
      }
      refundWorker(state, w);
      w.runner = null;
      w.paused = false;
      w.actionId = cmd.actionId;
      if (cmd.actionId !== null) tryStartWorkerCycle(state, cmd.slot, state.time, content);
      return;
    }

    case 'spendPool': {
      const def = content.actions.get(cmd.actionId);
      if (def.skillId !== cmd.skillId) throw new CommandError('Action is not part of that skill');
      const cost = poolCostForNextMastery(state, def);
      const skill = state.skills[def.skillId];
      if (cost === null) throw new CommandError('Mastery already maxed');
      if (skill.pool < cost) throw new CommandError('Not enough pool XP');
      const before = masteryLevel(state, def);
      skill.pool -= cost;
      skill.mastery[def.id] = (skill.mastery[def.id] ?? 0) + cost;
      if (masteryLevel(state, def) !== before + 1)
        throw new Error('Pool spend did not level mastery');
      return;
    }
  }
}
