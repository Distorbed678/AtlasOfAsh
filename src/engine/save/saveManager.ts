import type { GameState } from '../state';
import { decodeSave, encodeSave } from './codec';
import type { SaveStore } from './store';

export const MAX_BACKUPS = 5;

export interface BackupInfo {
  key: string;
  savedAt: number;
}

/**
 * Persists one save slot (one character, from Phase 1 on) plus rolling backups.
 * Keys: `slot:<id>:main` and `slot:<id>:backup:<savedAt>`.
 */
export class SaveManager {
  constructor(
    private readonly store: SaveStore,
    readonly slotId: string,
  ) {}

  private get mainKey() {
    return `slot:${this.slotId}:main`;
  }
  private get backupPrefix() {
    return `slot:${this.slotId}:backup:`;
  }

  async save(state: GameState): Promise<void> {
    await this.store.set(this.mainKey, encodeSave(state));
  }

  async load(): Promise<GameState | undefined> {
    const raw = await this.store.get(this.mainKey);
    return raw === undefined ? undefined : decodeSave(raw);
  }

  /** Write a timestamped backup and prune to the newest MAX_BACKUPS. */
  async backup(state: GameState, savedAt: number): Promise<void> {
    await this.store.set(`${this.backupPrefix}${savedAt}`, encodeSave(state));
    const backups = await this.listBackups();
    for (const old of backups.slice(MAX_BACKUPS)) await this.store.del(old.key);
  }

  /** Newest first. */
  async listBackups(): Promise<BackupInfo[]> {
    const keys = (await this.store.keys()).filter((k) => k.startsWith(this.backupPrefix));
    return keys
      .map((key) => ({ key, savedAt: Number(key.slice(this.backupPrefix.length)) }))
      .filter((b) => Number.isFinite(b.savedAt))
      .sort((a, b) => b.savedAt - a.savedAt);
  }

  async loadBackup(key: string): Promise<GameState> {
    if (!key.startsWith(this.backupPrefix)) throw new Error('Backup belongs to another slot');
    const raw = await this.store.get(key);
    if (raw === undefined) throw new Error('Backup not found');
    return decodeSave(raw);
  }

  async deleteAll(): Promise<void> {
    const prefix = `slot:${this.slotId}:`;
    for (const k of await this.store.keys()) if (k.startsWith(prefix)) await this.store.del(k);
  }
}
