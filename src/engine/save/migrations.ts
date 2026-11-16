import { SAVE_VERSION } from '../state';

/**
 * Save migrations. `MIGRATIONS[n]` upgrades a raw save from version n to n+1.
 * Never edit a shipped migration; add a new one and bump SAVE_VERSION.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawSave = Record<string, any>;
export type Migration = (save: RawSave) => RawSave;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // 1: (s) => ({ ...s, version: 2, newField: defaultValue }),
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
