import type { GameState } from './state';

/** Lightweight before/after snapshot used for the "while you were away" report. */
export interface ProgressSnapshot {
  time: number;
  gold: number;
  bank: Record<string, number>;
  actionsCompleted: number;
}

export interface ProgressSummary {
  durationMs: number;
  goldDelta: number;
  items: { itemId: string; delta: number }[];
  actionsCompleted: number;
}

export function takeSnapshot(state: GameState): ProgressSnapshot {
  return {
    time: state.time,
    gold: state.gold,
    bank: { ...state.bank },
    actionsCompleted: state.stats.actionsCompleted,
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
  return {
    durationMs: after.time - before.time,
    goldDelta: after.gold - before.gold,
    items,
    actionsCompleted: after.actionsCompleted - before.actionsCompleted,
  };
}
