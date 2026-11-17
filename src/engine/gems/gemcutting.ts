import { CONTENT, type Content } from '../content';
import { characterLevel } from '../combat/progression';
import { playerSpirit } from '../combat/context';
import { hasItems, removeItem } from '../economy/bank';
import { skillLevel } from '../skills/actions';
import type { GameState, GemInstance, SkillRule } from '../state';
import {
  CUT_LEVEL,
  findGem,
  gemDef,
  isSkill,
  isSpirit,
  isSupport,
  MAX_QUALITY,
  MAX_SOCKETS,
  polishCost,
  SKILL_SLOT_LEVELS,
  SOCKET_COSTS,
  SOCKET_XP,
  spiritReservations,
  supportFits,
  uncutKind,
  uncutTier,
} from './gems';

export class GemError extends Error {}

const GEMCUTTING = 'skill.gemcutting' as const;
export const CUT_XP = (tier: number) => 60 * tier;
export const POLISH_XP = (quality: number) => 20 * (1 + Math.floor(quality / 5));
export const STARTING_SOCKETS = 2;

function gemOrThrow(state: GameState, uid: number): GemInstance {
  const g = findGem(state, uid);
  if (!g) throw new GemError('Gem not found');
  return g;
}

function pay(state: GameState, cost: Record<string, number>) {
  if (!hasItems(state, cost)) throw new GemError('Missing materials');
  for (const [id, qty] of Object.entries(cost)) removeItem(state, id, qty);
}

/** Cut an uncut gem into any gem of the same kind and tier. Returns the new gem's uid. */
export function cutGem(
  state: GameState,
  itemId: string,
  gemId: string,
  content: Content = CONTENT,
): number {
  const kind = uncutKind(itemId);
  if (!kind) throw new GemError('Not an uncut gem');
  const tier = uncutTier(itemId);
  const def = content.gems.get(gemId);
  if (def.kind !== kind || def.tier !== tier)
    throw new GemError('That gem cannot be cut from this stone');
  const need = CUT_LEVEL[tier - 1] ?? 99;
  if (skillLevel(state, GEMCUTTING) < need) throw new GemError(`Requires Gemcutting level ${need}`);
  pay(state, { [itemId]: 1 });
  const uid = state.nextItemUid++;
  const skill = isSkill(def);
  state.gems.push({
    uid,
    gemId,
    xp: 0,
    quality: 0,
    sockets: skill ? STARTING_SOCKETS : 0,
    supports: skill ? Array.from({ length: STARTING_SOCKETS }, () => null) : [],
  });
  state.skills[GEMCUTTING].xp += CUT_XP(tier);
  return uid;
}

export function polishGem(state: GameState, uid: number): void {
  const g = gemOrThrow(state, uid);
  if (g.quality >= MAX_QUALITY) throw new GemError('Already at maximum quality');
  pay(state, polishCost(g.quality));
  state.skills[GEMCUTTING].xp += POLISH_XP(g.quality);
  g.quality++;
  state.gearVersion++;
}

export function openSocket(state: GameState, uid: number, content: Content = CONTENT): void {
  const g = gemOrThrow(state, uid);
  if (!isSkill(gemDef(g, content))) throw new GemError('Only skill gems have support sockets');
  if (g.sockets >= MAX_SOCKETS) throw new GemError('All sockets are open');
  const next = g.sockets + 1;
  pay(state, SOCKET_COSTS[next]!);
  g.sockets = next;
  g.supports.push(null);
  state.skills[GEMCUTTING].xp += SOCKET_XP[next]!;
  state.gearVersion++;
}

/** Put a support gem into a skill's socket (moving it from wherever it was), or clear the socket. */
export function socketSupport(
  state: GameState,
  skillUid: number,
  index: number,
  supportUid: number | null,
  content: Content = CONTENT,
): void {
  const g = gemOrThrow(state, skillUid);
  const def = gemDef(g, content);
  if (!isSkill(def)) throw new GemError('Not a skill gem');
  if (index < 0 || index >= g.sockets) throw new GemError('No such socket');
  if (supportUid !== null) {
    const sup = gemOrThrow(state, supportUid);
    const sdef = gemDef(sup, content);
    if (!isSupport(sdef)) throw new GemError('Not a support gem');
    if (!supportFits(def, sdef)) throw new GemError('That support cannot support this skill');
    const dup = g.supports.some(
      (s, i) =>
        i !== index && s !== null && s !== supportUid && findGem(state, s)?.gemId === sup.gemId,
    );
    if (dup) throw new GemError('This skill already has that support');
    for (const other of state.gems)
      other.supports = other.supports.map((s) => (s === supportUid ? null : s));
  }
  g.supports[index] = supportUid;
  state.gearVersion++;
}

/** Put a skill gem into a priority slot (moving it from another slot), or clear the slot. */
export function setSkillSlot(
  state: GameState,
  slot: number,
  gemUid: number | null,
  content: Content = CONTENT,
): void {
  const s = state.skillBar[slot];
  if (!s) throw new GemError('No such slot');
  const need = SKILL_SLOT_LEVELS[slot]!;
  if (characterLevel(state.charXp) < need) throw new GemError(`Unlocks at character level ${need}`);
  if (gemUid !== null) {
    const g = gemOrThrow(state, gemUid);
    if (!isSkill(gemDef(g, content))) throw new GemError('Only skill gems go in the skill bar');
    for (const other of state.skillBar) if (other.gemUid === gemUid) other.gemUid = null;
  }
  s.gemUid = gemUid;
  state.gearVersion++;
}

export function swapSkillSlots(state: GameState, a: number, b: number): void {
  const sa = state.skillBar[a];
  const sb = state.skillBar[b];
  if (!sa || !sb) throw new GemError('No such slot');
  const lvl = characterLevel(state.charXp);
  if (lvl < SKILL_SLOT_LEVELS[a]! || lvl < SKILL_SLOT_LEVELS[b]!)
    throw new GemError('Slot is locked');
  state.skillBar[a] = sb;
  state.skillBar[b] = sa;
  state.gearVersion++;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

export function sanitizeRule(rule: SkillRule): SkillRule {
  switch (rule.kind) {
    case 'lifeBelow':
    case 'manaAbove':
      return { kind: rule.kind, value: clamp(rule.value, 1, 99) };
    case 'chargesAtLeast':
      if (!['endurance', 'frenzy', 'power'].includes(rule.charge))
        throw new GemError('Unknown charge');
      return { kind: rule.kind, charge: rule.charge, value: clamp(rule.value, 1, 3) };
    case 'comboAtLeast':
      return { kind: rule.kind, value: clamp(rule.value, 1, 8) };
    case 'always':
    case 'targetLacksDebuff':
    case 'buffNotActive':
      return { kind: rule.kind };
    default:
      throw new GemError('Unknown rule');
  }
}

export function setSkillRule(state: GameState, slot: number, rule: SkillRule): void {
  const s = state.skillBar[slot];
  if (!s) throw new GemError('No such slot');
  s.rule = sanitizeRule(rule);
}

/** Spirit currently reserved and available. */
export function spiritUsage(
  state: GameState,
  content: Content = CONTENT,
): { used: number; total: number } {
  const total = playerSpirit(state, content);
  let used = 0;
  for (const r of spiritReservations(state, content)) if (used + r.cost <= total) used += r.cost;
  return { used, total };
}

export function toggleSpirit(
  state: GameState,
  uid: number,
  active: boolean,
  content: Content = CONTENT,
): void {
  const g = gemOrThrow(state, uid);
  const def = gemDef(g, content);
  if (!isSpirit(def)) throw new GemError('Not a spirit gem');
  const on = state.activeSpirit.includes(uid);
  if (active === on) return;
  if (active) {
    const { used, total } = spiritUsage(state, content);
    if (used + def.spirit > total)
      throw new GemError(`Needs ${def.spirit} Spirit (${total - used} free)`);
    state.activeSpirit.push(uid);
  } else {
    state.activeSpirit = state.activeSpirit.filter((u) => u !== uid);
  }
  state.gearVersion++;
}

/** Destroy a gem for good, removing it from every slot and socket. */
export function destroyGem(state: GameState, uid: number): void {
  gemOrThrow(state, uid);
  state.gems = state.gems.filter((g) => g.uid !== uid);
  for (const g of state.gems) g.supports = g.supports.map((s) => (s === uid ? null : s));
  for (const s of state.skillBar) if (s.gemUid === uid) s.gemUid = null;
  state.activeSpirit = state.activeSpirit.filter((u) => u !== uid);
  state.gearVersion++;
}
