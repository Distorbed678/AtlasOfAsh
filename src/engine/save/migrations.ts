import { SAVE_VERSION } from '../state';
import { RETIRED_IDS } from '../content/retiredIds';

/**
 * Save migrations. `MIGRATIONS[n]` upgrades a raw save from version n to n+1.
 * Never edit a shipped migration; add a new one and bump SAVE_VERSION.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawSave = Record<string, any>;
export type Migration = (save: RawSave) => RawSave;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // v1 (Phase 0 demo, single slot) → v2 (characters, skills, workers, town).
  1: (s) => {
    const bankItems: Record<string, number> = {};
    for (const [id, qty] of Object.entries((s.bank ?? {}) as Record<string, number>)) {
      if (!RETIRED_IDS.has(id)) bankItems[id] = qty;
    }
    return {
      version: 2,
      seed: s.seed,
      createdAt: s.createdAt,
      lastRealTime: s.lastRealTime,
      time: s.time,
      character: { id: 'default', name: 'Wanderer', classId: 'class.ironclad', mode: 'standard' },
      rng: {},
      bank: { items: bankItems },
      gold: s.gold ?? 0,
      action: null,
      workers: [],
      town: {},
      stats: { actionsCompleted: s.stats?.actionsCompleted ?? 0 },
    };
  },
  // v2 → v3 (Phase 3): stash, equipment and item ids. Defaults are filled by normalizeState.
  2: (s) => ({ ...s, version: 3 }),
};

export function migrate(
  raw: RawSave,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  target = SAVE_VERSION,
): RawSave {
  let save = raw;
  if (typeof save.version !== 'number') throw new Error('Save has no version');
  if (save.version > target)
    throw new Error(`Save is from a newer game version (v${save.version} > v${target})`);
  while (save.version < target) {
    const step = migrations[save.version];
    if (!step) throw new Error(`No migration from save v${save.version}`);
    const from = save.version;
    save = step(save);
    if (save.version !== from + 1) throw new Error(`Migration from v${from} did not bump version`);
  }
  return save;
}
