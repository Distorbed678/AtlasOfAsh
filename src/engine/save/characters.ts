import { SKILL_IDS } from '../content';
import { levelForXp } from '../skills/xp';
import type { CharacterMode, GameState } from '../state';
import type { SaveStore } from './store';

/** What the character-select screen shows without loading each save. */
export interface CharacterSummary {
  id: string;
  name: string;
  classId: string;
  mode: CharacterMode;
  createdAt: number;
  lastPlayed: number;
  totalLevel: number;
}

const INDEX_KEY = 'characters:index';

export function summarizeCharacter(state: GameState, lastPlayed: number): CharacterSummary {
  return {
    ...state.character,
    createdAt: state.createdAt,
    lastPlayed,
    totalLevel: SKILL_IDS.reduce((sum, id) => sum + levelForXp(state.skills[id].xp), 0),
  };
}

/** The list of characters, stored as one small JSON record. */
export class CharacterIndex {
  constructor(private readonly store: SaveStore) {}

  async list(): Promise<CharacterSummary[]> {
    const raw = await this.store.get(INDEX_KEY);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw) as CharacterSummary[];
      return Array.isArray(list) ? list.sort((a, b) => b.lastPlayed - a.lastPlayed) : [];
    } catch {
      return [];
    }
  }

  async upsert(summary: CharacterSummary): Promise<void> {
    const list = (await this.list()).filter((c) => c.id !== summary.id);
    list.push(summary);
    await this.store.set(INDEX_KEY, JSON.stringify(list));
  }

  async remove(id: string): Promise<void> {
    const list = (await this.list()).filter((c) => c.id !== id);
    await this.store.set(INDEX_KEY, JSON.stringify(list));
  }
}
