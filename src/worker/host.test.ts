import { describe, expect, it } from 'vitest';
import { decodeSave, encodeSave } from '../engine/save/codec';
import { SaveManager } from '../engine/save/saveManager';
import { MemoryStore } from '../engine/save/store';
import { AUTOSAVE_MS, GameHost } from './host';
import type { FromWorker } from './protocol';

const HOUR = 3_600_000;

function makeHost(store = new MemoryStore(), startAt = 1_000_000) {
  let clock = startAt;
  const messages: FromWorker[] = [];
  const saves = new SaveManager(store, 'test');
  const host = new GameHost({
    saves,
    now: () => clock,
    post: (m) => messages.push(m),
    yieldToEventLoop: async () => {},
    newSeed: () => 42,
    build: { appVersion: 't', buildSha: 't', buildTime: 't' },
  });
  return {
    host,
    saves,
    store,
    messages,
    setClock: (t: number) => (clock = t),
    advanceClock: (ms: number) => (clock += ms),
  };
}

async function request(h: ReturnType<typeof makeHost>, req: Parameters<GameHost['handle']>[0]) {
  await h.host.handle(req);
  return h.messages.filter((m) => m.type === 'response').at(-1) as Extract<
    FromWorker,
    { type: 'response' }
  >;
}

describe('GameHost', () => {
  it('creates a new save on first launch', async () => {
    const h = makeHost();
    await h.host.init();
    expect(await h.saves.load()).toBeDefined();
    expect(h.messages.some((m) => m.type === 'ready')).toBe(true);
  });

  it('advances in real time on tick', async () => {
    const h = makeHost();
    await h.host.init();
    await h.host.handle({
      type: 'command',
      cmd: { type: 'startAction', actionId: 'action.demo_kindle' },
    });
    for (let i = 0; i < 100; i++) {
      h.advanceClock(100);
      await h.host.tick();
    }
    expect(h.host.state.time).toBe(10_000);
    expect(h.host.state.stats.actionsCompleted).toBe(3);
  });

  it('simulates offline time on load and reports it', async () => {
    const store = new MemoryStore();
    const first = makeHost(store, 0);
    await first.host.init();
    await first.host.handle({
      type: 'command',
      cmd: { type: 'startAction', actionId: 'action.demo_kindle' },
    });
    await request(first, { type: 'request', reqId: 1, req: { type: 'saveNow' } });

    // Come back 8 hours later.
    const second = makeHost(store, 8 * HOUR);
    await second.host.init();
    expect(second.host.state.stats.actionsCompleted).toBe((8 * HOUR) / 3000);
    const away = second.messages.find((m) => m.type === 'awaySummary');
    expect(away && away.type === 'awaySummary' && away.summary.durationMs).toBe(8 * HOUR);
  });

  it('offline catch-up equals continuous online play (determinism end-to-end)', async () => {
    const storeA = new MemoryStore();
    const a = makeHost(storeA, 0);
    await a.host.init();
    await a.host.handle({
      type: 'command',
      cmd: { type: 'startAction', actionId: 'action.demo_kindle' },
    });
    for (let i = 0; i < 36_000; i++) {
      a.advanceClock(100);
      await a.host.tick();
    }

    const storeB = new MemoryStore();
    const b0 = makeHost(storeB, 0);
    await b0.host.init();
    await b0.host.handle({
      type: 'command',
      cmd: { type: 'startAction', actionId: 'action.demo_kindle' },
    });
    await request(b0, { type: 'request', reqId: 1, req: { type: 'saveNow' } });
    const b = makeHost(storeB, HOUR);
    await b.host.init();

    const strip = (s: typeof a.host.state) => ({ ...s, lastRealTime: 0 });
    expect(strip(b.host.state)).toEqual(strip(a.host.state));
  });

  it('saves immediately after a player command', async () => {
    const h = makeHost();
    await h.host.init();
    await h.host.handle({
      type: 'command',
      cmd: { type: 'startAction', actionId: 'action.demo_kindle' },
    });
    expect((await h.saves.load())!.action?.actionId).toBe('action.demo_kindle');
  });

  it('autosaves periodically', async () => {
    const h = makeHost();
    await h.host.init();
    await h.host.handle({
      type: 'command',
      cmd: { type: 'startAction', actionId: 'action.demo_kindle' },
    });
    for (let t = 0; t <= AUTOSAVE_MS; t += 100) {
      h.advanceClock(100);
      await h.host.tick();
    }
    expect((await h.saves.load())!.stats.actionsCompleted).toBeGreaterThan(0);
  });

  it('exports and imports saves, backing up before import', async () => {
    const h = makeHost();
    await h.host.init();
    h.host.state.gold = 123;
    const exp = await request(h, { type: 'request', reqId: 1, req: { type: 'exportSave' } });
    expect(exp.ok).toBe(true);
    const exported = exp.ok ? (exp.data as string) : '';
    expect(decodeSave(exported).gold).toBe(123);

    const other = decodeSave(exported);
    other.gold = 999;
    const imp = await request(h, {
      type: 'request',
      reqId: 2,
      req: { type: 'importSave', data: encodeSave(other) },
    });
    expect(imp.ok).toBe(true);
    expect(h.host.state.gold).toBe(999);
    expect((await h.saves.listBackups()).length).toBeGreaterThan(0);
  });

  it('returns a readable error for a bad import and keeps the current state', async () => {
    const h = makeHost();
    await h.host.init();
    h.host.state.gold = 5;
    const res = await request(h, {
      type: 'request',
      reqId: 1,
      req: { type: 'importSave', data: 'garbage' },
    });
    expect(res.ok).toBe(false);
    expect(h.host.state.gold).toBe(5);
  });

  it('dev skip simulates time and emits a summary', async () => {
    const h = makeHost();
    await h.host.init();
    await h.host.handle({
      type: 'command',
      cmd: { type: 'startAction', actionId: 'action.demo_sift' },
    });
    await h.host.handle({ type: 'devSkip', ms: HOUR });
    expect(h.host.state.stats.actionsCompleted).toBe(HOUR / 5000);
    expect(h.messages.some((m) => m.type === 'awaySummary' && m.reason === 'devSkip')).toBe(true);
  });

  it('reset wipes the slot and starts fresh', async () => {
    const h = makeHost();
    await h.host.init();
    h.host.state.gold = 50;
    await request(h, { type: 'request', reqId: 1, req: { type: 'reset' } });
    expect(h.host.state.gold).toBe(0);
    expect(await h.saves.listBackups()).toHaveLength(0);
  });

  it('debug bundle contains a decodable save', async () => {
    const h = makeHost();
    await h.host.init();
    const res = await request(h, { type: 'request', reqId: 1, req: { type: 'debugBundle' } });
    const bundle = res.ok ? (res.data as { save: string; seed: number }) : null;
    expect(bundle?.seed).toBe(42);
    expect(decodeSave(bundle!.save).seed).toBe(42);
  });
});
