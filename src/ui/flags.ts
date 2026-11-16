import { create } from 'zustand';
import {
  isFlagName,
  parseFlagList,
  resolveFlags,
  type FlagName,
  type FlagOverrides,
  type Flags,
} from '../shared/flags';
import { storage } from './storage';

const STORAGE_KEY = 'aoa.flags';

function loadOverrides(): FlagOverrides {
  const out: FlagOverrides = {};
  try {
    const parsed = JSON.parse(storage.get(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    for (const [k, v] of Object.entries(parsed))
      if (isFlagName(k) && typeof v === 'boolean') out[k] = v;
  } catch {
    // ignore corrupt storage
  }
  // `?flags=devTools,-showUpcoming` overrides and is remembered.
  const fromUrl = new URLSearchParams(window.location.search).get('flags');
  if (fromUrl) Object.assign(out, parseFlagList(fromUrl));
  return out;
}

interface FlagStore {
  overrides: FlagOverrides;
  flags: Flags;
  setFlag(name: FlagName, value: boolean | undefined): void;
}

const initial = loadOverrides();
storage.set(STORAGE_KEY, JSON.stringify(initial));

export const useFlags = create<FlagStore>((set, get) => ({
  overrides: initial,
  flags: resolveFlags(import.meta.env.DEV, initial),
  setFlag(name, value) {
    const overrides = { ...get().overrides };
    if (value === undefined) delete overrides[name];
    else overrides[name] = value;
    storage.set(STORAGE_KEY, JSON.stringify(overrides));
    set({ overrides, flags: resolveFlags(import.meta.env.DEV, overrides) });
  },
}));

export const useFlag = (name: FlagName) => useFlags((s) => s.flags[name]);
