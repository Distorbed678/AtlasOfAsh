import { CONTENT, type Content } from '../content';
import { scaled, UNCUT_KIND } from '../content/gems';
import type { GemDef, SkillGemDef, SpiritGemDef, SupportGemDef } from '../content/types';
import { xpForLevel } from '../skills/xp';
import type { GameState, GemInstance } from '../state';

export const MAX_GEM_LEVEL = 20;
export const MAX_QUALITY = 20;
export const MAX_SOCKETS = 5;
export const SKILL_SLOT_LEVELS = [1, 4, 12, 24, 38];
/** Gemcutting level needed to cut each tier. */
export const CUT_LEVEL = [1, 20, 40, 60, 80];
export const SPIRIT_MILESTONES = [10, 30, 50];
export const SPIRIT_PER_MILESTONE = 30;

/** Gem XP to reach a level: the skill curve at 1 + 3 × (level − 1), so level 20 ≈ 224k XP. */
export function gemXpForLevel(level: number): number {
  return xpForLevel(1 + 3 * (Math.min(MAX_GEM_LEVEL, level) - 1));
}

export function gemLevel(xp: number): number {
  let lvl = 1;
  while (lvl < MAX_GEM_LEVEL && xp >= gemXpForLevel(lvl + 1)) lvl++;
  return lvl;
}

export function gemDef(gem: GemInstance, content: Content = CONTENT): GemDef {
  return content.gems.get(gem.gemId);
}

export function isSkill(def: GemDef): def is SkillGemDef {
  return def.kind === 'skill';
}
export function isSupport(def: GemDef): def is SupportGemDef {
  return def.kind === 'support';
}
export function isSpirit(def: GemDef): def is SpiritGemDef {
  return def.kind === 'spirit';
}

export function findGem(state: GameState, uid: number): GemInstance | undefined {
  return state.gems.find((g) => g.uid === uid);
}

/** Uids of supports socketed in any skill gem. */
export function socketedSupportUids(state: GameState): Set<number> {
  const out = new Set<number>();
  for (const g of state.gems) for (const s of g.supports) if (s !== null) out.add(s);
  return out;
}

/** Skill gems currently in the priority list. */
export function skillBarGems(state: GameState): GemInstance[] {
  return state.skillBar.flatMap((s) =>
    s.gemUid !== null ? [findGem(state, s.gemUid)].filter((g): g is GemInstance => !!g) : [],
  );
}

/** Gems that earn XP from kills: skill bar gems, their supports and active spirit gems. */
export function xpEarningGems(state: GameState): GemInstance[] {
  const out: GemInstance[] = [];
  for (const g of skillBarGems(state)) {
    out.push(g);
    for (const s of g.supports) {
      const sup = s !== null ? findGem(state, s) : undefined;
      if (sup) out.push(sup);
    }
  }
  for (const uid of state.activeSpirit) {
    const g = findGem(state, uid);
    if (g) out.push(g);
  }
  return out;
}

/** Supports usable in a skill: tags must overlap. */
export function supportFits(skill: SkillGemDef, support: SupportGemDef): boolean {
  const tags = new Set([...skill.tags, skill.skillKind]);
  return support.requiresAny.some((t) => tags.has(t));
}

/** Spirit reserved by active spirit gems and persistent minion skills (in that order). */
export function spiritReservations(
  state: GameState,
  content: Content = CONTENT,
): { uid: number; cost: number }[] {
  const out: { uid: number; cost: number }[] = [];
  for (const uid of state.activeSpirit) {
    const g = findGem(state, uid);
    const def = g && gemDef(g, content);
    if (def && isSpirit(def)) out.push({ uid, cost: def.spirit });
  }
  for (const g of skillBarGems(state)) {
    const def = gemDef(g, content);
    if (isSkill(def) && def.minion?.persistent)
      out.push({ uid: g.uid, cost: def.minion.spirit ?? 0 });
  }
  return out;
}

/** Which reservations fit in the available Spirit (first come, first served). */
export function activeReservations(
  state: GameState,
  spirit: number,
  content: Content = CONTENT,
): Set<number> {
  let used = 0;
  const ok = new Set<number>();
  for (const r of spiritReservations(state, content)) {
    if (used + r.cost <= spirit) {
      used += r.cost;
      ok.add(r.uid);
    }
  }
  return ok;
}

// ---------------------------------------------------------------- Gemcutting costs

export function polishCost(quality: number): Record<string, number> {
  const step = 1 + Math.floor(quality / 5);
  return { 'item.gem_fragment': step, 'item.arcane_dust': 5 * step };
}

export const SOCKET_COSTS: Record<number, Record<string, number>> = {
  3: { 'item.cut_gem': 5, 'item.arcane_dust': 200 },
  4: { 'item.cut_gem': 15, 'item.arcane_dust': 800 },
  5: { 'item.cut_gem': 40, 'item.arcane_dust': 3000 },
};
export const SOCKET_XP: Record<number, number> = { 3: 50, 4: 150, 5: 400 };

export function uncutKind(itemId: string): 'skill' | 'support' | 'spirit' | undefined {
  return UNCUT_KIND[itemId];
}

export function uncutTier(itemId: string): number {
  return Number(itemId.slice(itemId.lastIndexOf('_t') + 2));
}

export { scaled };
