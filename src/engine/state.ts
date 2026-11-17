import { SKILL_IDS } from './content';
import type { SkillId } from './content/types';
import { deriveSeed, Rng, seedRng, type RngState } from './core/rng';
import type { BaseClass, ChargeType, EquipSlot, FlaskSlot, ItemCategory } from './content/types';
import type { MonsterRarity } from './combat/monsterStats';
import type { Rarity } from './items/types';
import type { Mod } from './stats/types';
import type { ItemInstance } from './items/types';

/** Bump when the save shape changes, and add a migration in save/migrations.ts. */
export const SAVE_VERSION = 5;

export type CharacterMode = 'standard' | 'hardcore' | 'mortal';
export const CHARACTER_MODES: readonly CharacterMode[] = ['standard', 'hardcore', 'mortal'];

export interface CharacterInfo {
  id: string;
  name: string;
  classId: string;
  mode: CharacterMode;
  /** Set when a Hardcore character died and moved to Standard. */
  fellInHardcore?: boolean;
}

// ---------------------------------------------------------------- Combat state

export interface Dot {
  dps: number;
  until: number;
}

export interface MonsterInstance {
  defId: string;
  rarity: MonsterRarity;
  mods: string[];
  level: number;
  maxLife: number;
  life: number;
  nextAt: number;
  /** Deterministic hit resolution for the monster's attacks. */
  entropy: number;
  ignite?: Dot;
  bleed?: Dot;
  poison: Dot[];
  shock?: { pct: number; until: number };
  chill?: { pct: number; until: number };
  frozenUntil?: number;
  freezeBuildup: number;
  debuffs: MonsterDebuff[];
}

// ---------------------------------------------------------------- Gems

export interface GemInstance {
  uid: number;
  gemId: string;
  /** Gem XP (level derives from it, capped at 20). */
  xp: number;
  quality: number;
  /** Skill gems: number of support slots (2–5). */
  sockets: number;
  /** Skill gems: support gem uids per slot. */
  supports: (number | null)[];
}

export type SkillRule =
  | { kind: 'always' }
  | { kind: 'lifeBelow'; value: number }
  | { kind: 'manaAbove'; value: number }
  | { kind: 'targetLacksDebuff' }
  | { kind: 'buffNotActive' }
  | { kind: 'chargesAtLeast'; charge: ChargeType; value: number }
  | { kind: 'comboAtLeast'; value: number };

export interface SkillSlot {
  gemUid: number | null;
  rule: SkillRule;
}

export interface MinionInstance {
  id: number;
  gemUid: number;
  life: number;
  maxLife: number;
  nextAt: number;
  /** Summoned minions expire. */
  until?: number;
  /** Persistent minions revive at this time after dying. */
  reviveAt?: number;
}

export interface MonsterDebuff {
  gemUid: number;
  until: number;
  curse: boolean;
  resistDown: number;
  damageTaken: number;
  slow: number;
  armourBreak: number;
}

export interface FlaskState {
  charges: number;
  /** Utility flask effect active until. */
  activeUntil?: number;
  /** Life/mana flask recovery in progress. */
  recovery?: { perMs: number; until: number };
}

export interface TripBag {
  gold: number;
  items: Record<string, number>;
  gear: ItemInstance[];
}

export const TRIP_BAG_STACKS = 100;

export interface CombatState {
  zoneId: string;
  startedAt: number;
  monster: MonsterInstance;
  life: number;
  mana: number;
  es: number;
  /** When the player's next attack/spell lands. */
  playerNextAt: number;
  playerEntropy: number;
  lastHitAt: number;
  leechPool: number;
  retreatReadyAt: number;
  flasks: Partial<Record<FlaskSlot, FlaskState>>;
  tickAt: number;
  bag: TripBag;
  lastBankAt: number;
  kills: number;
  charges: Record<ChargeType, { n: number; until: number }>;
  combo: { points: number; lastHitAt: number };
  /** Gem uid → time the skill (or its trigger) is ready again. */
  cooldowns: Record<number, number>;
  buffs: { gemUid: number; until: number; mods: Mod[] }[];
  guard?: { absorb: number; until: number };
  minions: MinionInstance[];
  nextMinionId: number;
  /** For the UI: the last skill used. */
  lastSkill?: string;
}

export type FlaskRuleMode = 'off' | 'lifeBelow' | 'manaBelow' | 'whenInactive';

export interface FlaskRule {
  mode: FlaskRuleMode;
  /** Threshold in % for lifeBelow / manaBelow. */
  threshold: number;
}

export interface CombatSettings {
  /** 'auto' casts Basic Spell when holding a spell weapon and attacks otherwise. */
  skill: 'auto' | 'attack' | 'spell';
  flaskRules: Partial<Record<FlaskSlot, FlaskRule>>;
}

export type FilterAction = 'keep' | 'sell' | 'disenchant' | 'ignore';

export interface FilterRule {
  id: number;
  enabled: boolean;
  /** 'gear' matches equipment, 'material' matches stackable items. */
  target: 'gear' | 'material';
  rarities?: Rarity[];
  classes?: BaseClass[];
  categories?: ItemCategory[];
  minTier?: number;
  maxTier?: number;
  minIlvl?: number;
  /** Affix group the gear must have (e.g. 'life'). */
  hasAffix?: string;
  action: FilterAction;
}

export interface LootFilter {
  rules: FilterRule[];
  nextId: number;
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
  kills: number;
  deaths: number;
  itemsLost: number;
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
  /** Combat XP (character level derives from it). */
  charXp: number;
  combat: CombatState | null;
  combatSettings: CombatSettings;
  lootFilter: LootFilter;
  /** Bumped whenever equipment or gems change, so cached combat stats are rebuilt. */
  gearVersion: number;
  /** Cut gems (skill, support and spirit). */
  gems: GemInstance[];
  /** The 5-slot priority list. */
  skillBar: SkillSlot[];
  /** Active spirit gem uids (reserve Spirit). */
  activeSpirit: number[];
  /** Set when a Mortal character dies (the host then deletes the save). */
  dead?: { at: number; cause: string; level: number };
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
    charXp: 0,
    combat: null,
    combatSettings: {
      skill: 'auto',
      flaskRules: {
        flask1: { mode: 'lifeBelow', threshold: 50 },
        flask2: { mode: 'manaBelow', threshold: 30 },
        flask3: { mode: 'whenInactive', threshold: 0 },
        flask4: { mode: 'whenInactive', threshold: 0 },
        flask5: { mode: 'whenInactive', threshold: 0 },
      },
    },
    lootFilter: { rules: [], nextId: 1 },
    gearVersion: 0,
    gems: [],
    skillBar: Array.from({ length: 5 }, () => ({ gemUid: null, rule: { kind: 'always' } })),
    activeSpirit: [],
    stats: {
      actionsCompleted: 0,
      workerActions: 0,
      thievingFails: 0,
      itemsDiscarded: 0,
      wagesPaid: 0,
      goldEarned: 0,
      itemsCrafted: 0,
      kills: 0,
      deaths: 0,
      itemsLost: 0,
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
