import { deriveSeed, seedRng, type RngState } from './core/rng';

/** Bump when the save shape changes, and add a migration in save/migrations.ts. */
export const SAVE_VERSION = 1;

/** Named RNG streams. Each system draws only from its own stream. */
export const RNG_STREAMS = ['action'] as const;
export type RngStream = (typeof RNG_STREAMS)[number];

export interface ActiveAction {
  readonly actionId: string;
  /** Sim time the current action cycle started. */
  startedAt: number;
  /** Sim time the current cycle completes (absolute, so step size never matters). */
  nextAt: number;
}

export interface GameState {
  version: number;
  /** Master seed; stream seeds derive from it. */
  seed: number;
  /** Wall-clock ms when the save was created. */
  createdAt: number;
  /** Wall-clock ms the simulation was last advanced to (drives offline catch-up). */
  lastRealTime: number;
  /** Simulation time in ms since creation. Only ever moves forward. */
  time: number;
  rng: Record<RngStream, RngState>;
  bank: Record<string, number>;
  gold: number;
  action: ActiveAction | null;
  stats: {
    actionsCompleted: number;
  };
}

export function createInitialState(seed: number, now: number): GameState {
  const rng = {} as Record<RngStream, RngState>;
  for (const stream of RNG_STREAMS) rng[stream] = seedRng(deriveSeed(seed, stream));
  return {
    version: SAVE_VERSION,
    seed,
    createdAt: now,
    lastRealTime: now,
    time: 0,
    rng,
    bank: {},
    gold: 0,
    action: null,
    stats: { actionsCompleted: 0 },
  };
}

export function addItem(state: GameState, itemId: string, qty: number): void {
  if (qty === 0) return;
  const next = (state.bank[itemId] ?? 0) + qty;
  if (next < 0) throw new Error(`Bank underflow for ${itemId}`);
  if (next === 0) delete state.bank[itemId];
  else state.bank[itemId] = next;
}
