import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { Rng, seedRng } from './core/rng';
import { advance, type System } from './sim';
import { summarize, takeSnapshot } from './summary';
import { HOUR, newState, setLevel } from './testUtils';
import { createInitialState } from './state';

function running(seed = 42, actionId = 'action.chop_pine') {
  const s = newState(seed);
  applyCommand(s, { type: 'startAction', actionId });
  return s;
}

/** A busy state: player mining + two workers (one thieving), with gold to pay wages. */
function busy(seed: number) {
  const s = newState(seed);
  setLevel(s, 'skill.thieving', 30);
  s.town['building.guild_hall'] = 2;
  s.gold = 50_000;
  applyCommand(s, { type: 'startAction', actionId: 'action.mine_copper' });
  applyCommand(s, { type: 'assignWorker', slot: 0, actionId: 'action.gather_sage' });
  applyCommand(s, { type: 'assignWorker', slot: 1, actionId: 'action.pickpocket_watchman' });
  return s;
}

describe('advance', () => {
  it('completes the expected number of simple action cycles', () => {
    const s = running();
    advance(s, HOUR);
    // 720 at base speed; mastery gained during the hour makes it slightly faster.
    expect(s.stats.actionsCompleted).toBeGreaterThanOrEqual(HOUR / 5000);
    expect(s.stats.actionsCompleted).toBeLessThan((HOUR / 5000) * 1.1);
    expect(s.bank.items['item.pine_log']).toBeGreaterThanOrEqual(s.stats.actionsCompleted);
    expect(s.time).toBe(HOUR);
  });

  it('does nothing when idle', () => {
    const s = newState();
    expect(advance(s, HOUR).eventsProcessed).toBe(0);
    expect(s.bank.items).toEqual({});
  });

  it('refuses to go backwards', () => {
    const s = running();
    advance(s, 1000);
    expect(() => advance(s, 500)).toThrow(/backwards/);
  });

  it('detects a system that never moves forward', () => {
    const stuck: System = { id: 'stuck', nextEventTime: () => 10, processEvent: () => {} };
    expect(() => advance(createInitialState(1, 0), 100, { systems: [stuck] })).toThrow(
      /did not move/,
    );
  });
});

describe('determinism: online stepping == offline batch', () => {
  it('player + workers: 2h of random small steps equals one 2h advance', () => {
    const online = busy(1234);
    const offline = busy(1234);
    const stepRng = new Rng(seedRng(999));
    while (online.time < 2 * HOUR) {
      advance(online, Math.min(2 * HOUR, online.time + stepRng.int(1, 700)));
    }
    advance(offline, 2 * HOUR);
    expect(online).toEqual(offline);
    expect(online.stats.workerActions).toBeGreaterThan(0);
  });

  it('holds across a mid-run command at the same sim time', () => {
    const a = running(77);
    const b = running(77);
    for (let t = 0; t < 10 * 60_000; t += 137) advance(a, t);
    advance(a, 10 * 60_000);
    advance(b, 10 * 60_000);
    applyCommand(a, { type: 'startAction', actionId: 'action.fish_shallows' });
    applyCommand(b, { type: 'startAction', actionId: 'action.fish_shallows' });
    for (let t = a.time; t < HOUR; t += 991) advance(a, t);
    advance(a, HOUR);
    advance(b, HOUR);
    expect(a).toEqual(b);
  });
});

describe('long offline performance', () => {
  it('simulates 7 days of player + 2 workers quickly', () => {
    const s = busy(5);
    s.gold = 1e9;
    const start = performance.now();
    advance(s, 7 * 24 * HOUR);
    const ms = performance.now() - start;
    expect(s.stats.actionsCompleted).toBeGreaterThan(50_000);
    expect(ms).toBeLessThan(5000);
  });
});

describe('summary', () => {
  it('reports items, xp and level gains', () => {
    const s = running();
    const before = takeSnapshot(s);
    advance(s, HOUR);
    const sum = summarize(before, takeSnapshot(s));
    expect(sum.durationMs).toBe(HOUR);
    expect(sum.actionsCompleted).toBe(s.stats.actionsCompleted);
    expect(sum.items.find((i) => i.itemId === 'item.pine_log')!.delta).toBeGreaterThanOrEqual(720);
    const wc = sum.skills.find((g) => g.skillId === 'skill.woodcutting')!;
    expect(wc.xp).toBeGreaterThan(7000);
    expect(wc.levelAfter).toBeGreaterThan(wc.levelBefore);
  });
});
