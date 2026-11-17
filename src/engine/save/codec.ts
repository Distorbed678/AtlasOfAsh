import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { createInitialState, emptySkill, type GameState } from '../state';
import { migrate, type RawSave } from './migrations';

/** Export strings look like `AOA1.<base64 deflated JSON>`. */
const PREFIX = 'AOA1.';

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

/** Parse + migrate + normalise a raw JSON save into a valid GameState. */
export function deserializeState(json: string): GameState {
  let raw: RawSave;
  try {
    raw = JSON.parse(json) as RawSave;
  } catch {
    throw new Error('Save data is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('Save data is not an object');
  const migrated = migrate(raw);
  return normalizeState(migrated);
}

/**
 * Fill in anything a valid-but-older save may lack (new skills, new stats,
 * new bank fields) using the defaults of a fresh character.
 */
function normalizeState(raw: RawSave): GameState {
  for (const key of ['seed', 'createdAt', 'lastRealTime', 'time', 'gold'] as const) {
    if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key]))
      throw new Error(`Save field "${key}" is missing or invalid`);
  }
  if (typeof raw.character?.id !== 'string') throw new Error('Save has no character');
  const fresh = createInitialState(raw.seed, raw.createdAt, raw.character);
  raw.rng ??= {};
  raw.bank = { ...fresh.bank, ...raw.bank };
  raw.skills = { ...fresh.skills, ...raw.skills };
  for (const id of Object.keys(fresh.skills))
    raw.skills[id] = { ...emptySkill(), ...raw.skills[id] };
  raw.stats = { ...fresh.stats, ...raw.stats };
  raw.action ??= null;
  raw.workers ??= [];
  raw.town ??= {};
  raw.stash ??= fresh.stash;
  raw.equipment ??= {};
  raw.nextItemUid ??= 1;
  raw.charXp ??= 0;
  raw.combat ??= null;
  raw.combatSettings ??= fresh.combatSettings;
  raw.lootFilter ??= fresh.lootFilter;
  raw.gearVersion ??= 0;
  return raw as GameState;
}

export function encodeSave(state: GameState): string {
  return PREFIX + bytesToBase64(deflateSync(strToU8(serializeState(state)), { level: 9 }));
}

export function decodeSave(encoded: string): GameState {
  const trimmed = encoded.trim();
  if (!trimmed.startsWith(PREFIX)) throw new Error('Not an Atlas of Ash save string');
  let json: string;
  try {
    json = strFromU8(inflateSync(base64ToBytes(trimmed.slice(PREFIX.length))));
  } catch {
    throw new Error('Save string is corrupted');
  }
  return deserializeState(json);
}
