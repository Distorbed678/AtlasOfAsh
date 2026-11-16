import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { CONTENT } from '../content';
import { advance } from '../sim';
import { action, HOUR, newState, setLevel } from '../testUtils';
import { poolCap } from './mastery';
import { actionRates } from './rates';
import { xpForLevel } from './xp';

/** Max mastery + full pool so rates don't drift during the simulation. */
function maxed(actionId: string, level: number) {
  const s = newState(7);
  const def = action(actionId);
  setLevel(s, def.skillId, level);
  s.skills[def.skillId].mastery[def.id] = xpForLevel(99);
  s.skills[def.skillId].pool = poolCap(def.skillId);
  return { s, def };
}

describe('actionRates matches the simulation', () => {
  it.each([
    ['action.chop_yew', 45],
    ['action.mine_iron', 25],
    ['action.gather_thistle', 35],
    ['action.fish_lake', 35],
    ['action.pickpocket_merchant', 30],
  ])('%s', (actionId, level) => {
    const { s, def } = maxed(actionId, level);
    const rates = actionRates(s, def);
    const xp0 = s.skills[def.skillId].xp;
    applyCommand(s, { type: 'startAction', actionId });
    advance(s, 40 * HOUR);
    const simXp = (s.skills[def.skillId].xp - xp0) / 40;
    expect(simXp / rates.xpPerHour).toBeGreaterThan(0.96);
    expect(simXp / rates.xpPerHour).toBeLessThan(1.04);
    if (def.type === 'thieve') {
      expect(s.gold / 40 / rates.goldPerHour).toBeGreaterThan(0.95);
      expect(s.gold / 40 / rates.goldPerHour).toBeLessThan(1.05);
    } else {
      const [mainId, expected] = Object.entries(rates.itemsPerHour).sort((a, b) => b[1] - a[1])[0]!;
      const got = (s.bank.items[mainId] ?? 0) / 40;
      expect(got / expected).toBeGreaterThan(0.95);
      expect(got / expected).toBeLessThan(1.05);
    }
  });

  it('worker rates use efficiency and XP share', () => {
    const s = newState();
    const def = action('action.chop_pine');
    const r = actionRates(s, def, { kind: 'worker', slot: 0 });
    expect(r.actionsPerHour).toBeCloseTo(HOUR / Math.round(5000 / 0.3));
    expect(r.xpPerHour).toBeCloseTo(r.actionsPerHour * 10 * 0.1);
  });

  it('fishing tables include junk and pearls', () => {
    const def = CONTENT.actions.get('action.fish_marsh');
    if (def.type !== 'catch') throw new Error();
    const ids = def.table.map((e) => e.itemId);
    expect(ids).toContain('item.old_boot');
    expect(ids).toContain('item.river_pearl');
    expect(def.table.reduce((s, e) => s + e.weight, 0)).toBe(100);
  });
});
