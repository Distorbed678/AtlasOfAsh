import { describe, expect, it } from 'vitest';
import type { Command } from '../engine/commands';
import { decodeSave, encodeSave } from '../engine/save/codec';
import { SaveManager } from '../engine/save/saveManager';
import { MemoryStore } from '../engine/save/store';
import { AUTOSAVE_MS, GameHost } from './host';
import type { FromWorker, WorkerRequest } from './protocol';

const HOUR = 3_600_000;

function makeHost(store = new MemoryStore(), startAt = 1_000_000) {
  let clock = startAt;
  let seed = 1;
  const messages: FromWorker[] = [];
  const host = new GameHost({
    store,
    now: () => clock,
    post: (m) => messages.push(m),
    yieldToEventLoop: async () => {},
    newSeed: () => seed++,
    build: { appVersion: 't', buildSha: 't', buildTime: 't' },
  });
  let reqId = 0;
  const request = async (req: WorkerRequest) => {
    const id = ++reqId;
    await host.handle({ type: 'request', reqId: id, req });
    const res = messages.find((m) => m.type === 'response' && m.reqId === id);
    if (!res || res.type !== 'response') throw new Error('no response');
    return res;
  };
  const ok = async (req: WorkerRequest) => {
    const res = await request(req);
    if (!res.ok) throw new Error(res.error);
    return res.data;
  };
  const cmd = (c: Command) => ok({ type: 'command', cmd: c });
  return { host, store, messages, request, ok, cmd, advanceClock: (ms: number) => (clock += ms) };
}

async function withCharacter(h: ReturnType<typeof makeHost>, name = 'Tester') {
  await h.host.init();
  const id = (await h.ok({
    type: 'createCharacter',
    character: { name, classId: 'class.arcanist', mode: 'standard' },
  })) as string;
  await h.ok({ type: 'selectCharacter', id });
  return id;
}

describe('GameHost characters', () => {
  it('starts with no character and lists created ones', async () => {
    const h = makeHost();
    await h.host.init();
    expect(h.host.state).toBeNull();
    await h.ok({
      type: 'createCharacter',
      character: { name: 'A', classId: 'class.zealot', mode: 'hardcore' },
    });
    const list = (await h.ok({ type: 'listCharacters' })) as { name: string; mode: string }[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'A', mode: 'hardcore' });
  });

  it('validates new characters', async () => {
    const h = makeHost();
    await h.host.init();
    const blank = await h.request({
      type: 'createCharacter',
      character: { name: '  ', classId: 'class.zealot', mode: 'standard' },
    });
    expect(blank.ok).toBe(false);
    const badClass = await h.request({
      type: 'createCharacter',
      character: { name: 'x', classId: 'class.nope', mode: 'standard' },
    });
    expect(badClass.ok).toBe(false);
  });

  it('keeps characters fully separate', async () => {
    const h = makeHost();
    const a = await withCharacter(h, 'A');
    await h.cmd({ type: 'startAction', actionId: 'action.chop_pine' });
    await h.ok({ type: 'closeCharacter' });
    const b = await withCharacter(h, 'B');
    expect(h.host.state!.action).toBeNull();
    expect(h.host.state!.character.id).toBe(b);
    await h.ok({ type: 'selectCharacter', id: a });
    expect(h.host.state!.action?.actionId).toBe('action.chop_pine');
  });

  it('deletes a character and its saves', async () => {
    const h = makeHost();
    const id = await withCharacter(h);
    await h.ok({ type: 'deleteCharacter', id });
    expect(h.host.state).toBeNull();
    expect(await h.ok({ type: 'listCharacters' })).toEqual([]);
    expect(await new SaveManager(h.store, id).load()).toBeUndefined();
  });

  it('adopts a Phase 0 save from the legacy default slot', async () => {
    const store = new MemoryStore();
    const v1 = {
      version: 1,
      seed: 3,
      createdAt: 0,
      lastRealTime: 0,
      time: 0,
      gold: 5,
      rng: {},
      bank: {},
      action: null,
      stats: { actionsCompleted: 0 },
    };
    await store.set('slot:default:main', encodeSave(v1 as never));
    const h = makeHost(store);
    await h.host.init();
    const list = (await h.ok({ type: 'listCharacters' })) as { id: string }[];
    expect(list.map((c) => c.id)).toEqual(['default']);
    await h.ok({ type: 'selectCharacter', id: 'default' });
    expect(h.host.state!.gold).toBe(5);
  });
});

describe('GameHost simulation', () => {
  it('advances in real time on tick', async () => {
    const h = makeHost();
    await withCharacter(h);
    await h.cmd({ type: 'startAction', actionId: 'action.chop_pine' });
    for (let i = 0; i < 110; i++) {
      h.advanceClock(100);
      await h.host.tick();
    }
    expect(h.host.state!.time).toBe(11_000);
    expect(h.host.state!.stats.actionsCompleted).toBe(2);
  });

  it('commands report errors back to the caller', async () => {
    const h = makeHost();
    await withCharacter(h);
    const res = await h.request({
      type: 'command',
      cmd: { type: 'startAction', actionId: 'action.chop_oak' },
    });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toMatch(/Level too low/);
  });

  it('saves immediately after a player command', async () => {
    const h = makeHost();
    const id = await withCharacter(h);
    await h.cmd({ type: 'startAction', actionId: 'action.chop_pine' });
    expect((await new SaveManager(h.store, id).load())!.action?.actionId).toBe('action.chop_pine');
  });

  it('simulates offline time when a character is selected and reports it', async () => {
    const store = new MemoryStore();
    const first = makeHost(store, 0);
    const id = await withCharacter(first);
    await first.cmd({ type: 'startAction', actionId: 'action.chop_pine' });

    const second = makeHost(store, 8 * HOUR);
    await second.host.init();
    await second.ok({ type: 'selectCharacter', id });
    expect(second.host.state!.stats.actionsCompleted).toBeGreaterThanOrEqual((8 * HOUR) / 5000);
    const away = second.messages.find((m) => m.type === 'awaySummary');
    expect(away && away.type === 'awaySummary' && away.summary.durationMs).toBe(8 * HOUR);
  });

  it('offline catch-up equals continuous online play (end-to-end determinism)', async () => {
    const a = makeHost(new MemoryStore(), 0);
    const idA = await withCharacter(a);
    await a.cmd({ type: 'startAction', actionId: 'action.pickpocket_farmhand' });
    for (let i = 0; i < 36_000; i++) {
      a.advanceClock(100);
      await a.host.tick();
    }

    // Same character (same seed) from the same starting point, caught up offline instead.
    const storeB = new MemoryStore();
    const b0 = makeHost(storeB, 0);
    const idB = await withCharacter(b0);
    expect(idB).toBe(idA);
    await b0.cmd({ type: 'startAction', actionId: 'action.pickpocket_farmhand' });
    const b = makeHost(storeB, HOUR);
    await b.host.init();
    await b.ok({ type: 'selectCharacter', id: idB });

    const strip = (s: typeof a.host.state) => ({ ...s!, lastRealTime: 0 });
    expect(strip(b.host.state)).toEqual(strip(a.host.state));
  });

  it('autosaves periodically', async () => {
    const h = makeHost();
    const id = await withCharacter(h);
    await h.cmd({ type: 'startAction', actionId: 'action.chop_pine' });
    for (let t = 0; t <= AUTOSAVE_MS; t += 100) {
      h.advanceClock(100);
      await h.host.tick();
    }
    const saved = await new SaveManager(h.store, id).load();
    expect(saved!.stats.actionsCompleted).toBeGreaterThan(0);
  });

  it('exports, and imports as a new character', async () => {
    const h = makeHost();
    await withCharacter(h, 'Orig');
    h.host.state!.gold = 123;
    const exported = (await h.ok({ type: 'exportSave' })) as string;
    expect(decodeSave(exported).gold).toBe(123);
    const newId = (await h.ok({ type: 'importSave', data: exported })) as string;
    const list = (await h.ok({ type: 'listCharacters' })) as { id: string }[];
    expect(list.map((c) => c.id)).toContain(newId);
    expect(list).toHaveLength(2);
  });

  it('rejects a bad import without side effects', async () => {
    const h = makeHost();
    await withCharacter(h);
    const res = await h.request({ type: 'importSave', data: 'garbage' });
    expect(res.ok).toBe(false);
    expect(await h.ok({ type: 'listCharacters' })).toHaveLength(1);
  });

  it('dev skip simulates time and emits a summary', async () => {
    const h = makeHost();
    await withCharacter(h);
    await h.cmd({ type: 'startAction', actionId: 'action.chop_pine' });
    await h.host.handle({ type: 'devSkip', ms: HOUR });
    expect(h.host.state!.stats.actionsCompleted).toBeGreaterThanOrEqual(720);
    expect(h.messages.some((m) => m.type === 'awaySummary' && m.reason === 'devSkip')).toBe(true);
  });

  it('debug bundle contains a decodable save', async () => {
    const h = makeHost();
    await withCharacter(h);
    const bundle = (await h.ok({ type: 'debugBundle' })) as { save: string; seed: number };
    expect(decodeSave(bundle.save).seed).toBe(bundle.seed);
  });
});
