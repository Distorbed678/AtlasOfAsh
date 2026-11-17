import { SKILL_IDS } from './content';
import type { SkillId } from './content/types';
import { characterLevel } from './combat/progression';
import { levelForXp } from './skills/xp';
import type { GameState } from './state';

/** Lightweight before/after snapshot used for the "while you were away" report. */
export interface ProgressSnapshot {
  time: number;
  gold: number;
  bank: Record<string, number>;
  xp: Record<SkillId, number>;
  actionsCompleted: number;
  workerActions: number;
  itemsDiscarded: number;
  wagesPaid: number;
  thievingFails: number;
  charXp: number;
  kills: number;
  deaths: number;
  itemsLost: number;
  gearCount: number;
}

export interface SkillGain {
  skillId: SkillId;
  xp: number;
  levelBefore: number;
  levelAfter: number;
}

export interface ProgressSummary {
  durationMs: number;
  goldDelta: number;
  items: { itemId: string; delta: number }[];
  skills: SkillGain[];
  actionsCompleted: number;
  workerActions: number;
  itemsDiscarded: number;
  wagesPaid: number;
  thievingFails: number;
  charXp: number;
  levelBefore: number;
  levelAfter: number;
  kills: number;
  deaths: number;
  itemsLost: number;
  gearGained: number;
}

export function takeSnapshot(state: GameState): ProgressSnapshot {
  const xp = {} as Record<SkillId, number>;
  for (const id of SKILL_IDS) xp[id] = state.skills[id].xp;
  const s = state.stats;
  return {
    time: state.time,
    gold: state.gold,
    bank: { ...state.bank.items },
    xp,
    actionsCompleted: s.actionsCompleted,
    workerActions: s.workerActions,
    itemsDiscarded: s.itemsDiscarded,
    wagesPaid: s.wagesPaid,
    thievingFails: s.thievingFails,
    charXp: state.charXp,
    kills: s.kills,
    deaths: s.deaths,
    itemsLost: s.itemsLost,
    gearCount:
      state.stash.tabs.reduce((n, t) => n + t.items.length, 0) +
      (state.combat?.bag.gear.length ?? 0),
  };
}

export function summarize(before: ProgressSnapshot, after: ProgressSnapshot): ProgressSummary {
  const ids = new Set([...Object.keys(before.bank), ...Object.keys(after.bank)]);
  const items: ProgressSummary['items'] = [];
  for (const itemId of ids) {
    const delta = (after.bank[itemId] ?? 0) - (before.bank[itemId] ?? 0);
    if (delta !== 0) items.push({ itemId, delta });
  }
  items.sort((a, b) => b.delta - a.delta);

  const skills: SkillGain[] = [];
  for (const skillId of SKILL_IDS) {
    const xp = after.xp[skillId] - before.xp[skillId];
    if (xp > 0)
      skills.push({
        skillId,
        xp,
        levelBefore: levelForXp(before.xp[skillId]),
        levelAfter: levelForXp(after.xp[skillId]),
      });
  }

  return {
    durationMs: after.time - before.time,
    goldDelta: after.gold - before.gold,
    items,
    skills,
    actionsCompleted: after.actionsCompleted - before.actionsCompleted,
    workerActions: after.workerActions - before.workerActions,
    itemsDiscarded: after.itemsDiscarded - before.itemsDiscarded,
    wagesPaid: after.wagesPaid - before.wagesPaid,
    thievingFails: after.thievingFails - before.thievingFails,
    charXp: after.charXp - before.charXp,
    levelBefore: characterLevel(before.charXp),
    levelAfter: characterLevel(after.charXp),
    kills: after.kills - before.kills,
    deaths: after.deaths - before.deaths,
    itemsLost: after.itemsLost - before.itemsLost,
    gearGained: after.gearCount - before.gearCount,
  };
}
