/**
 * Feature flags: unfinished systems can be merged to main but stay hidden on the
 * public Pages build. Override with `?flags=devTools,-showUpcoming` (persisted to
 * localStorage) or by toggling in Settings.
 */
export const FLAG_DEFS = {
  devTools: { description: 'Show the dev tools panel', dev: true, prod: false },
  showUpcoming: { description: 'List upcoming systems in the sidebar', dev: true, prod: true },
} as const satisfies Record<string, { description: string; dev: boolean; prod: boolean }>;

export type FlagName = keyof typeof FLAG_DEFS;
export type Flags = Record<FlagName, boolean>;
export type FlagOverrides = Partial<Flags>;

export function isFlagName(name: string): name is FlagName {
  return Object.hasOwn(FLAG_DEFS, name);
}

/** Parse "a,-b,c" into overrides; unknown names are ignored. */
export function parseFlagList(list: string): FlagOverrides {
  const out: FlagOverrides = {};
  for (const raw of list.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const on = !part.startsWith('-');
    const name = on ? part : part.slice(1);
    if (isFlagName(name)) out[name] = on;
  }
  return out;
}

export function resolveFlags(isDev: boolean, ...overrides: FlagOverrides[]): Flags {
  const flags = {} as Flags;
  for (const name of Object.keys(FLAG_DEFS) as FlagName[]) {
    flags[name] = isDev ? FLAG_DEFS[name].dev : FLAG_DEFS[name].prod;
  }
  for (const o of overrides) Object.assign(flags, o);
  return flags;
}
