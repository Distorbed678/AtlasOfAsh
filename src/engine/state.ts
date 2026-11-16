import { SKILL_IDS } from './content';
import type { SkillId } from './content/types';
import { deriveSeed, Rng, seedRng, type RngState } from './core/rng';
import type { EquipSlot } from './content/types';
import type { ItemInstance } from './items/types';

/** Bump when the save shape changes, and add a migration in save/migrations.ts. */
export const SAVE_VERSION = 3;

export type CharacterMode = 'standard' | 'hardcore' | 'mortal';
export const CHARACTER_MODES: readonly CharacterMode[] = ['standard', 'hardcore', 'mortal'];

export interface CharacterInfo {
  id: string;
  name: string;
  classId: string;
  mode: CharacterMode;
}

export interface SkillState {
  xp: number;
  /** Mastery pool XP (spendable). */
  pool: number;
  /** Mastery XP per action id. */
  mastery: Record<string, number>;
}

/** One executor of a repeating skill action: the player or a worker. */
export interface Runner {
  actionId: string;
  /** Sim time the current cycle started (after any respawn/stun wait). */
  startedAt: number;
  /** Sim time the current cycle completes. Absolute, so step size never matters. */
  nextAt: number;
  /** Mining: ore left in the current rock. */
  rockHp?: number;
  /** Mining: set while waiting for the rock to respawn. */
  rockRespawnAt?: number;
  /** Thieving: set while stunned after a failed attempt. */
  stunnedUntil?: number;
  /** Worker: gold paid for the current cycle (refunded pro-rata if reassigned). */
  paid?: number;
}

export interface WorkerSlot {
  actionId: string | null;
  runner: Runner | null;
  /** True when the worker is assigned but couldn't start (no gold, materials or stash space). */
  paused: boolean;
}

export const STASH_TAB_SIZE = 40;

export interface StashTab {
  id: number;
  name: string;
  items: ItemInstance[];
}

export interface StashState {
  tabs: StashTab[];
  nextTabId: number;
}

export interface BankTab {
  id: number;
  name: string;
}

export interface BankState {
  items: Record<string, number>;
  locked: string[];
  tabs: BankTab[];
  /** Item id → tab id (missing = main tab 0). */
  tabOf: Record<string, number>;
  nextTabId: number;
}

export interface GameStats {
  actionsCompleted: number;
  workerActions: number;
  thievingFails: number;
  itemsDiscarded: number;
  wagesPaid: number;
  goldEarned: number;
  itemsCrafted: number;
}

export interface GameState {
  version: number;
  /** Master seed; RNG stream seeds derive from it. */
  seed: number;
  /** Wall-clock ms when the character was created. */
  createdAt: number;
  /** Wall-clock ms the simulation was last advanced to (drives offline catch-up). */
  lastRealTime: number;
  /** Simulation time in ms since creation. Only ever moves forward. */
  time: number;
  character: CharacterInfo;
  /** Named RNG streams, created on first use from the master seed. */
  rng: Record<string, RngState>;
  bank: BankState;
  gold: number;
  skills: Record<SkillId, SkillState>;
  /** The player's single active action. */
  action: Runner | null;
  workers: WorkerSlot[];
  /** Building id → built tier (missing = 0). */
  town: Record<string, number>;
  /** Gear storage, bought with gold. */
  stash: StashState;
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
  /** Next item instance id (deterministic). */
  nextItemUid: number;
  /** The most recent Enchanting result (for UI feedback). */
  lastEnchant?: { uid: number; op: string; outcome: string | null };
  stats: GameStats;
}

export const MAIN_TAB: BankTab = { id: 0, name: 'Main' };

export function emptySkill(): SkillState {
  return { xp: 0, pool: 0, mastery: {} };
}

export function createInitialState(
  seed: number,
  now: number,
  character: CharacterInfo = {
    id: 'test',
    name: 'Wanderer',
    classId: 'class.ironclad',
    mode: 'standard',
  },
): GameState {
  const skills = {} as Record<SkillId, SkillState>;
  for (const id of SKILL_IDS) skills[id] = emptySkill();
  return {
    version: SAVE_VERSION,
    seed,
    createdAt: now,
    lastRealTime: now,
    time: 0,
    character,
    rng: {},
    bank: { items: {}, locked: [], tabs: [{ ...MAIN_TAB }], tabOf: {}, nextTabId: 1 },
    gold: 0,
    skills,
    action: null,
    workers: [],
    town: {},
    stash: { tabs: [{ id: 0, name: 'Stash', items: [] }], nextTabId: 1 },
    equipment: {},
    nextItemUid: 1,
    stats: {
      actionsCompleted: 0,
      workerActions: 0,
      thievingFails: 0,
      itemsDiscarded: 0,
      wagesPaid: 0,
      goldEarned: 0,
      itemsCrafted: 0,
    },
  };
}

/** Get (creating deterministically if needed) a named RNG stream. */
export function rngFor(state: GameState, stream: string): Rng {
  let s = state.rng[stream];
  if (!s) {
    s = seedRng(deriveSeed(state.seed, stream));
    state.rng[stream] = s;
  }
  return new Rng(s);
}
