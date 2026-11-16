/**
 * Pacing report (not part of the normal test run).
 * Run with:  PACING=1 npx vitest run src/engine/balance
 *
 * Simulates levelling each skill 1→99 with the real engine, always doing the
 * unlocked action with the best XP/hour, and prints the hours needed to reach
 * each milestone level.
 */
import { describe, it } from 'vitest';
import { applyCommand } from '../commands';
import { actionsForSkill, SKILL_IDS } from '../content';
import type { SkillId } from '../content/types';
import { advance } from '../sim';
import { canPerform, skillLevel } from '../skills/actions';
import { actionRates } from '../skills/rates';
import { createInitialState, type GameState } from '../state';

const HOUR = 3_600_000;
const MILESTONES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99];
const RECHECK_MS = 15 * 60_000;

function bestAction(state: GameState, skillId: SkillId) {
  let best = actionsForSkill(skillId)[0]!;
  let bestXp = -1;
  for (const def of actionsForSkill(skillId)) {
    if (!canPerform(state, def)) continue;
    const xp = actionRates(state, def).xpPerHour;
    if (xp > bestXp) {
      bestXp = xp;
      best = def;
    }
  }
  return best;
}

function hoursToMilestones(skillId: SkillId): number[] {
  const s = createInitialState(123, 0);
  const result: number[] = [];
  let m = 0;
  while (m < MILESTONES.length) {
    const def = bestAction(s, skillId);
    if (s.action?.actionId !== def.id) applyCommand(s, { type: 'startAction', actionId: def.id });
    advance(s, s.time + RECHECK_MS);
    while (m < MILESTONES.length && skillLevel(s, skillId) >= MILESTONES[m]!) {
      result.push(s.time / HOUR);
      m++;
    }
  }
  return result;
}

describe.skipIf(!process.env.PACING)('pacing report', () => {
  it('hours of active play to reach each level', () => {
    const rows: string[] = [];
    const json: Record<string, number[]> = {};
    rows.push(['skill'.padEnd(12), ...MILESTONES.map((l) => `L${l}`.padStart(7))].join(''));
    for (const id of SKILL_IDS) {
      const hours = hoursToMilestones(id);
      json[id] = hours.map((h) => Math.round(h * 10) / 10);
      rows.push([id.slice(6).padEnd(12), ...hours.map((h) => h.toFixed(1).padStart(7))].join(''));
    }
    console.log('\nHours of active play to reach level:\n' + rows.join('\n'));
    console.log('PACING_JSON ' + JSON.stringify({ milestones: MILESTONES, hours: json }));
  }, 600_000);
});
