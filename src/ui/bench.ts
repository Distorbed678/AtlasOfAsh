import { create } from 'zustand';
import type { DamageType, Mod, ModKind, StatId } from '../engine/stats/types';
import { storage } from './storage';

/**
 * Dev test bench state: arbitrary modifiers, a test skill/weapon and a target
 * dummy. Lives in this browser only (never in the save).
 */
export interface BenchMod {
  id: number;
  stat: StatId;
  kind: ModKind;
  value: number;
  tags: string;
}

export interface BenchState {
  mods: BenchMod[];
  skillId: string;
  weaponId: string;
  target: {
    life: number;
    armour: number;
    evasion: number;
    fire: number;
    cold: number;
    lightning: number;
    chaos: number;
  };
  incoming: { type: DamageType; amount: number; accuracy: number };
}

const KEY = 'aoa.bench';
const DEFAULT: BenchState = {
  mods: [],
  skillId: 'bench.heavy_strike',
  weaponId: 'bench.mace',
  target: { life: 1000, armour: 200, evasion: 300, fire: 20, cold: 20, lightning: 20, chaos: 0 },
  incoming: { type: 'physical', amount: 100, accuracy: 500 },
};

function load(): BenchState {
  try {
    const raw = storage.get(KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<BenchState>) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

interface BenchStore extends BenchState {
  update(patch: Partial<BenchState>): void;
  addMod(m: Omit<BenchMod, 'id'>): void;
  updateMod(id: number, patch: Partial<BenchMod>): void;
  removeMod(id: number): void;
}

export const useBench = create<BenchStore>((set, get) => {
  const persist = () => {
    const { mods, skillId, weaponId, target, incoming } = get();
    storage.set(KEY, JSON.stringify({ mods, skillId, weaponId, target, incoming }));
  };
  const nextId = () => Math.max(0, ...get().mods.map((m) => m.id)) + 1;
  return {
    ...load(),
    update(patch) {
      set(patch);
      persist();
    },
    addMod(m) {
      set({ mods: [...get().mods, { ...m, id: nextId() }] });
      persist();
    },
    updateMod(id, patch) {
      set({ mods: get().mods.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
      persist();
    },
    removeMod(id) {
      set({ mods: get().mods.filter((m) => m.id !== id) });
      persist();
    },
  };
});

export function benchModsToMods(mods: readonly BenchMod[]): Mod[] {
  return mods
    .filter((m) => Number.isFinite(m.value))
    .map((m) => {
      const tags = m.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      return {
        stat: m.stat,
        kind: m.kind,
        value: m.value,
        tags: tags.length ? tags : undefined,
        source: { kind: 'debug', id: `bench.${m.id}`, label: `Test bench #${m.id}` },
      };
    });
}
