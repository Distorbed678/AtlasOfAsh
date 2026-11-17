import type { Command } from '../engine/commands';
import type { CharacterSummary } from '../engine/save/characters';
import type { BackupInfo } from '../engine/save/saveManager';
import type { CharacterMode, GameState } from '../engine/state';
import type { ProgressSummary } from '../engine/summary';
import type { SimEvent } from '../engine/sim';

export interface NewCharacter {
  name: string;
  classId: string;
  mode: CharacterMode;
}

/** Requests expect a `response` message with the same reqId. */
export type WorkerRequest =
  | { type: 'listCharacters' }
  | { type: 'createCharacter'; character: NewCharacter }
  | { type: 'selectCharacter'; id: string }
  | { type: 'closeCharacter' }
  | { type: 'deleteCharacter'; id: string }
  | { type: 'command'; cmd: Command }
  | { type: 'exportSave' }
  | { type: 'importSave'; data: string }
  | { type: 'listBackups' }
  | { type: 'restoreBackup'; key: string }
  | { type: 'debugBundle' }
  | { type: 'saveNow' };

export type ToWorker =
  | { type: 'request'; reqId: number; req: WorkerRequest }
  | { type: 'devSkip'; ms: number }
  | { type: 'devSpeed'; speed: number }
  | { type: 'devGive'; itemId?: string; qty?: number; gold?: number; levels?: number };

export type FromWorker =
  | { type: 'ready'; characters: CharacterSummary[] }
  | { type: 'snapshot'; state: GameState | null; log?: SimEvent[] }
  | { type: 'characterDied'; name: string; cause: string }
  | { type: 'characters'; characters: CharacterSummary[] }
  | { type: 'catchUpProgress'; done: number; total: number }
  | { type: 'catchUpDone' }
  | { type: 'awaySummary'; summary: ProgressSummary; reason: 'offline' | 'devSkip' }
  | { type: 'response'; reqId: number; ok: true; data: unknown }
  | { type: 'response'; reqId: number; ok: false; error: string }
  | { type: 'error'; message: string };

export interface DebugBundle {
  game: 'atlas-of-ash';
  appVersion: string;
  buildSha: string;
  buildTime: string;
  createdAt: string;
  saveVersion: number;
  seed: number;
  save: string;
}

export type { BackupInfo, CharacterSummary };
