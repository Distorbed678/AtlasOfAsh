import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { Rng, seedRng } from './core/rng';
import { advance, type System } from './sim';
import { createInitialState } from './state';
import { summarize, takeSnapshot } from './summary';

const HOUR = 3_600_000;

function freshRunning(seed = 42) {
  const s = createInitialState(seed, 0);
  applyCommand(s, { type: 'startAction', actionId: 'action.demo_kindle' });
  return s;
}

describe('advance', () => {
  it('completes the expected number of action cycles', () => {
    const s = freshRunning();
    advance(s, HOUR);
    expect(s.stats.actionsCompleted).toBe(HOUR / 3000);
    expect(s.time).toBe(HOUR);
  });

  it('does nothing when idle', () => {
    const s = createInitialState(1, 0);
    const r = advance(s, HOUR);
    expect(r.eventsProcessed).toBe(0);
    expect(s.bank).toEqual({});
  });

  it('refuses to go backwards', () => {
    const s = freshRunning();
    advance(s, 1000);
    expect(() => advance(s, 500)).toThrow(/backwards/);
  });

  it('detects a system that never moves forward', () => {
    const stuck: System = { id: 'stuck', nextEventTime: () => 10, processEvent: () => {} };
    const s = createInitialState(1, 0);
    expect(() => advance(s, 100, { systems: [stuck] })).toThrow(/did not move/);
  });
});

describe('determinism: online stepping == offline batch', () => {
  it('1h of small random steps equals a single 1h advance', () => {
    const online = freshRunning(1234);
    const offline = freshRunning(1234);

    // Online: irregular frame-like steps (from a separate RNG so steps vary).
    const stepRng = new Rng(seedRng(999));
    while (online.time < HOUR) {
      const step = Math.min(HOUR - online.time, stepRng.int(1, 400));
      advance(online, online.time + step);
    }
    advance(offline, HOUR);

    expect(online).toEqual(offline);
  });

  it('holds across a mid-run command at the same sim time', () => {
    const a = freshRunning(77);
    const b = freshRunning(77);
    for (let t = 0; t < 10 * 60_000; t += 137) advance(a, t);
    advance(a, 10 * 60_000);
    advance(b, 10 * 60_000);
    applyCommand(a, { type: 'startAction', actionId: 'action.demo_sift' });
    applyCommand(b, { type: 'startAction', actionId: 'action.demo_sift' });
    for (let t = a.time; t < HOUR; t += 991) advance(a, t);
    advance(a, HOUR);
    advance(b, HOUR);
    expect(a).toEqual(b);
  });
});

describe('long offline performance', () => {
  it('simulates 7 days of a 3s action quickly', () => {
    const s = freshRunning();
    const start = performance.now();
    advance(s, 7 * 24 * HOUR);
    const ms = performance.now() - start;
    expect(s.stats.actionsCompleted).toBe((7 * 24 * HOUR) / 3000);
    expect(ms).toBeLessThan(2000);
  });
});

describe('summary', () => {
  it('reports gains between snapshots', () => {
    const s = freshRunning();
    const before = takeSnapshot(s);
    advance(s, HOUR);
    const sum = summarize(before, takeSnapshot(s));
    expect(sum.durationMs).toBe(HOUR);
    expect(sum.actionsCompleted).toBe(1200);
    expect(sum.items.find((i) => i.itemId === 'item.demo_ember')!.delta).toBeGreaterThanOrEqual(1200);
  });
});

describe('commands', () => {
  it('sells items for gold and clamps to owned quantity', () => {
    const s = createInitialState(1, 0);
    s.bank['item.demo_ash'] = 5;
    applyCommand(s, { type: 'sellItem', itemId: 'item.demo_ash', qty: 99 });
    expect(s.bank['item.demo_ash']).toBeUndefined();
    expect(s.gold).toBe(5);
  });
});
