import { describe, expect, it } from 'vitest';
import { applyCommand, CommandError } from '../commands';
import { CONTENT } from '../content';
import { advance } from '../sim';
import { cycleDuration, expectedCycleValue, wagePerCycle } from '../skills/actions';
import { action, HOUR, newState, setLevel } from '../testUtils';
import { addItem, bankCapacity } from './bank';
import { buildingValue } from './town';

describe('bank', () => {
  it('discards new item types when full but keeps growing stacks', () => {
    const s = newState();
    const items = CONTENT.items.all();
    for (let i = 0; i < bankCapacity(s); i++) addItem(s, items[i]!.id, 1);
    expect(addItem(s, items[bankCapacity(s)]!.id, 5)).toBe(0);
    expect(s.stats.itemsDiscarded).toBe(5);
    expect(addItem(s, items[0]!.id, 5)).toBe(5);
  });

  it('locked items cannot be sold', () => {
    const s = newState();
    addItem(s, 'item.pine_log', 10);
    applyCommand(s, { type: 'toggleLock', itemId: 'item.pine_log' });
    expect(() => applyCommand(s, { type: 'sellItem', itemId: 'item.pine_log', qty: 10 })).toThrow(
      CommandError,
    );
    applyCommand(s, { type: 'toggleLock', itemId: 'item.pine_log' });
    applyCommand(s, { type: 'sellItem', itemId: 'item.pine_log', qty: 4 });
    expect(s.bank.items['item.pine_log']).toBe(6);
    expect(s.gold).toBe(4);
  });

  it('tabs: create, move items, delete returns items to main', () => {
    const s = newState();
    addItem(s, 'item.pine_log', 1);
    applyCommand(s, { type: 'createTab', name: 'Logs' });
    const tabId = s.bank.tabs[1]!.id;
    applyCommand(s, { type: 'moveToTab', itemId: 'item.pine_log', tabId });
    expect(s.bank.tabOf['item.pine_log']).toBe(tabId);
    applyCommand(s, { type: 'deleteTab', tabId });
    expect(s.bank.tabOf['item.pine_log']).toBeUndefined();
    expect(() => applyCommand(s, { type: 'deleteTab', tabId: 0 })).toThrow(CommandError);
  });

  it('opens containers for gold and materials', () => {
    const s = newState();
    addItem(s, 'item.sunken_cache', 3);
    applyCommand(s, { type: 'openItem', itemId: 'item.sunken_cache', qty: 3 });
    expect(s.bank.items['item.sunken_cache']).toBeUndefined();
    expect(s.gold).toBeGreaterThanOrEqual(60);
    expect(Object.keys(s.bank.items).length).toBeGreaterThan(0);
  });
});

describe('town', () => {
  it('upgrades a building by paying gold and materials', () => {
    const s = newState();
    expect(() =>
      applyCommand(s, { type: 'upgradeBuilding', buildingId: 'building.vault' }),
    ).toThrow(CommandError);
    const cost = CONTENT.buildings.get('building.vault').tiers[0]!;
    s.gold = cost.gold;
    for (const [id, q] of Object.entries(cost.items)) addItem(s, id, q);
    applyCommand(s, { type: 'upgradeBuilding', buildingId: 'building.vault' });
    expect(s.town['building.vault']).toBe(1);
    expect(bankCapacity(s)).toBe(50);
    expect(s.gold).toBe(0);
  });

  it('guild hall creates worker slots', () => {
    const s = newState();
    s.town['building.guild_hall'] = 2;
    applyCommand(s, { type: 'assignWorker', slot: 1, actionId: null });
    expect(s.workers).toHaveLength(2);
    expect(buildingValue(s, 'building.workshop')).toBe(0.3);
  });
});

describe('workers', () => {
  function withWorker(gold: number, actionId = 'action.chop_pine') {
    const s = newState();
    s.town['building.guild_hall'] = 1;
    s.gold = gold;
    applyCommand(s, { type: 'assignWorker', slot: 0, actionId });
    return s;
  }

  it('work at 30% efficiency (3.3x slower) and pay a wage per cycle', () => {
    const s = withWorker(10_000);
    const def = action('action.chop_pine');
    expect(cycleDuration(s, def, { kind: 'worker', slot: 0 })).toBe(Math.round(5000 / 0.3));
    advance(s, HOUR);
    const cycles = s.stats.workerActions;
    expect(cycles).toBe(Math.floor(HOUR / Math.round(5000 / 0.3)));
    expect(s.stats.wagesPaid).toBe((cycles + 1) * wagePerCycle(s, def)); // +1: next cycle prepaid
    expect(s.bank.items['item.pine_log']).toBeGreaterThanOrEqual(cycles);
  });

  it('wages cost more than the output sells for at base', () => {
    const s = newState();
    for (const def of CONTENT.actions.all()) {
      expect(wagePerCycle(s, def)).toBeGreaterThanOrEqual(Math.round(expectedCycleValue(def)));
    }
  });

  it('grant 10% XP and no mastery', () => {
    const s = withWorker(10_000);
    advance(s, HOUR);
    const xp = s.skills['skill.woodcutting'].xp;
    expect(xp).toBeCloseTo(s.stats.workerActions * action('action.chop_pine').xp * 0.1);
    expect(s.skills['skill.woodcutting'].mastery).toEqual({});
  });

  it('pause when gold runs out and resume when gold arrives', () => {
    const def = action('action.chop_pine');
    const s = withWorker(0);
    expect(s.workers[0]!.paused).toBe(true);
    advance(s, HOUR);
    expect(s.stats.workerActions).toBe(0);
    s.gold = wagePerCycle(s, def) * 3;
    advance(s, 2 * HOUR);
    expect(s.stats.workerActions).toBe(3);
    expect(s.workers[0]!.paused).toBe(true);
  });

  it('a thieving player can fund a worker indefinitely', () => {
    const s = withWorker(0);
    setLevel(s, 'skill.thieving', 50);
    applyCommand(s, { type: 'startAction', actionId: 'action.pickpocket_smuggler' });
    advance(s, 4 * HOUR);
    expect(s.stats.workerActions).toBeGreaterThan(500);
  });

  it('refund the unworked part of a cycle when reassigned', () => {
    const s = withWorker(10_000);
    const paid = s.gold;
    applyCommand(s, { type: 'assignWorker', slot: 0, actionId: null });
    expect(s.gold).toBe(10_000);
    expect(paid).toBeLessThan(10_000);
  });

  it('require the skill level for the action', () => {
    const s = newState();
    s.town['building.guild_hall'] = 1;
    expect(() =>
      applyCommand(s, { type: 'assignWorker', slot: 0, actionId: 'action.chop_oak' }),
    ).toThrow(CommandError);
    setLevel(s, 'skill.woodcutting', 10);
    s.gold = 100;
    applyCommand(s, { type: 'assignWorker', slot: 0, actionId: 'action.chop_oak' });
    expect(s.workers[0]!.runner).not.toBeNull();
  });
});
