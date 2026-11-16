import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { advance } from '../sim';
import { createInitialState, SAVE_VERSION } from '../state';
import { decodeSave, deserializeState, encodeSave, serializeState } from './codec';
import { migrate, type Migration } from './migrations';
import { MAX_BACKUPS, SaveManager } from './saveManager';
import { MemoryStore } from './store';

function playedState() {
  const s = createInitialState(42, 1_000);
  s.town['building.guild_hall'] = 1;
  s.gold = 1000;
  applyCommand(s, { type: 'startAction', actionId: 'action.pickpocket_farmhand' });
  applyCommand(s, { type: 'assignWorker', slot: 0, actionId: 'action.chop_pine' });
  advance(s, 600_000);
  return s;
}

describe('codec', () => {
  it('round-trips through JSON', () => {
    const s = playedState();
    expect(deserializeState(serializeState(s))).toEqual(s);
  });

  it('round-trips through the compressed export string', () => {
    const s = playedState();
    const enc = encodeSave(s);
    expect(enc.startsWith('AOA1.')).toBe(true);
    expect(decodeSave(enc)).toEqual(s);
  });

  it('a restored save continues identically (RNG state persisted)', () => {
    const s = playedState();
    const restored = decodeSave(encodeSave(s));
    advance(s, 3_600_000);
    advance(restored, 3_600_000);
    expect(restored).toEqual(s);
  });

  it('rejects garbage with readable errors', () => {
    expect(() => decodeSave('hello')).toThrow(/Not an Atlas of Ash save/);
    expect(() => decodeSave('AOA1.!!!notbase64')).toThrow(/corrupted/);
    expect(() => deserializeState('{')).toThrow(/not valid JSON/);
    expect(() => deserializeState('{"version":1}')).toThrow(/missing or invalid/);
  });

  it('refuses saves from a newer version', () => {
    const s = { ...playedState(), version: 999 };
    expect(() => deserializeState(JSON.stringify(s))).toThrow(/newer game version/);
  });

  it('fills in fields missing from an older-but-valid save', () => {
    const s = playedState();
    const raw = JSON.parse(serializeState(s));
    delete raw.skills['skill.fishing'];
    delete raw.stats.wagesPaid;
    delete raw.bank.tabs;
    const loaded = deserializeState(JSON.stringify(raw));
    expect(loaded.skills['skill.fishing']).toEqual({ xp: 0, pool: 0, mastery: {} });
    expect(loaded.stats.wagesPaid).toBe(0);
    expect(loaded.bank.tabs).toEqual([{ id: 0, name: 'Main' }]);
  });

  it('migrates a Phase 0 (v1) demo save', () => {
    const v1 = {
      version: 1,
      seed: 9,
      createdAt: 5,
      lastRealTime: 10,
      time: 1000,
      rng: { action: [1, 2, 3, 4] },
      bank: { 'item.demo_ember': 50 },
      gold: 77,
      action: { actionId: 'action.demo_kindle', startedAt: 0, nextAt: 3000 },
      stats: { actionsCompleted: 12 },
    };
    const s = deserializeState(JSON.stringify(v1));
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.character.id).toBe('default');
    expect(s.gold).toBe(77);
    expect(s.bank.items).toEqual({});
    expect(s.action).toBeNull();
    expect(s.stats.actionsCompleted).toBe(12);
    advance(s, 2000); // loads into a working state
  });
});

describe('migrate', () => {
  it('applies a chain of migrations in order', () => {
    const migrations: Record<number, Migration> = {
      1: (s) => ({ ...s, version: 2, a: 1 }),
      2: (s) => ({ ...s, version: 3, b: s.a + 1 }),
    };
    expect(migrate({ version: 1 }, migrations, 3)).toEqual({ version: 3, a: 1, b: 2 });
  });

  it('fails if a step is missing or does not bump the version', () => {
    expect(() => migrate({ version: 1 }, {}, 2)).toThrow(/No migration/);
    expect(() => migrate({ version: 1 }, { 1: (s) => s }, 2)).toThrow(/did not bump/);
  });
});

describe('SaveManager', () => {
  it('saves and loads a slot', async () => {
    const mgr = new SaveManager(new MemoryStore(), 'a');
    expect(await mgr.load()).toBeUndefined();
    const s = playedState();
    await mgr.save(s);
    expect(await mgr.load()).toEqual(s);
  });

  it('keeps only the newest backups', async () => {
    const store = new MemoryStore();
    const mgr = new SaveManager(store, 'a');
    const s = playedState();
    for (let i = 1; i <= MAX_BACKUPS + 3; i++) await mgr.backup(s, i * 1000);
    const list = await mgr.listBackups();
    expect(list).toHaveLength(MAX_BACKUPS);
    expect(list[0]!.savedAt).toBe((MAX_BACKUPS + 3) * 1000);
    expect(await mgr.loadBackup(list[0]!.key)).toEqual(s);
  });

  it('isolates slots', async () => {
    const store = new MemoryStore();
    const a = new SaveManager(store, 'a');
    const b = new SaveManager(store, 'b');
    await a.backup(playedState(), 1);
    expect(await b.listBackups()).toHaveLength(0);
    await a.deleteAll();
    expect(await store.keys()).toHaveLength(0);
  });
});
