import type { Command } from '../engine/commands';
import type { BackupInfo } from '../engine/save/saveManager';
import type { GameState } from '../engine/state';
import type { ProgressSummary } from '../engine/summary';

/** Requests expect a `response` message with the same reqId. */
export type WorkerRequest =
  | { type: 'exportSave' }
  | { type: 'importSave'; data: string }
  | { type: 'listBackups' }
  | { type: 'restoreBackup'; key: string }
  | { type: 'debugBundle' }
  | { type: 'saveNow' }
  | { type: 'reset' };

export type ToWorker =
  | { type: 'command'; cmd: Command }
  | { type: 'request'; reqId: number; req: WorkerRequest }
  | { type: 'devSkip'; ms: number }
  | { type: 'devSpeed'; speed: number }
  | { type: 'devGive'; itemId?: string; qty?: number; gold?: number };

export type FromWorker =
  | { type: 'ready' }
  | { type: 'snapshot'; state: GameState }
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

export type { BackupInfo };
