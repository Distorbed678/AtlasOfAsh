import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { advance } from '../sim';
import { createInitialState } from '../state';
import { decodeSave, deserializeState, encodeSave, serializeState } from './codec';
import { migrate, type Migration } from './migrations';
import { MAX_BACKUPS, SaveManager } from './saveManager';
import { MemoryStore } from './store';

function playedState() {
  const s = createInitialState(42, 1_000);
  applyCommand(s, { type: 'startAction', actionId: 'action.demo_kindle' });
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

  it('fills in a missing RNG stream deterministically', () => {
    const s = playedState();
    const raw = JSON.parse(serializeState(s));
    delete raw.rng.action;
    const a = deserializeState(JSON.stringify(raw));
    const b = deserializeState(JSON.stringify(raw));
    expect(a.rng.action).toEqual(b.rng.action);
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
