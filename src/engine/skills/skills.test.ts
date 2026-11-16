import { describe, expect, it } from 'vitest';
import { applyCommand, CommandError } from '../commands';
import { advance } from '../sim';
import { action, HOUR, newState, setLevel } from '../testUtils';
import { cycleDuration, successChance } from './actions';
import { masteryLevel, poolCap, poolCostForNextMastery, thievingSuccessChance } from './mastery';
import { xpForLevel } from './xp';

describe('starting actions', () => {
  it('requires the skill level', () => {
    const s = newState();
    expect(() => applyCommand(s, { type: 'startAction', actionId: 'action.chop_oak' })).toThrow(
      CommandError,
    );
    setLevel(s, 'skill.woodcutting', 10);
    applyCommand(s, { type: 'startAction', actionId: 'action.chop_oak' });
    expect(s.action?.actionId).toBe('action.chop_oak');
  });

  it('only one player action at a time', () => {
    const s = newState();
    applyCommand(s, { type: 'startAction', actionId: 'action.chop_pine' });
    applyCommand(s, { type: 'startAction', actionId: 'action.mine_copper' });
    expect(s.action?.actionId).toBe('action.mine_copper');
  });
});

describe('mining rocks', () => {
  it('depletes after rockHp ores, then waits for respawn', () => {
    const s = newState();
    applyCommand(s, { type: 'startAction', actionId: 'action.mine_copper' });
    const def = action('action.mine_copper');
    if (def.type !== 'rock') throw new Error();
    advance(s, def.rockHp * def.durationMs);
    expect(s.bank.items['item.copper_ore']).toBeGreaterThanOrEqual(def.rockHp);
    expect(s.action?.rockRespawnAt).toBe(def.rockHp * def.durationMs + def.respawnMs);
    const oresAtDepletion = s.stats.actionsCompleted;
    advance(s, def.rockHp * def.durationMs + def.respawnMs - 1);
    expect(s.stats.actionsCompleted).toBe(oresAtDepletion);
  });
});

describe('herbalism bundles & fishing tables', () => {
  it('herb gathers yield 1-3 herbs incl. the previous tier', () => {
    const s = newState();
    setLevel(s, 'skill.herbalism', 10);
    applyCommand(s, { type: 'startAction', actionId: 'action.gather_mint' });
    advance(s, HOUR);
    const n = s.stats.actionsCompleted;
    const herbs = (s.bank.items['item.mint'] ?? 0) + (s.bank.items['item.sage'] ?? 0);
    expect(herbs).toBeGreaterThanOrEqual(n);
    expect(herbs).toBeLessThanOrEqual(n * 3 * 1.2);
    expect(s.bank.items['item.sage']).toBeGreaterThan(0);
  });

  it('fishing catches from the spot table', () => {
    const s = newState();
    setLevel(s, 'skill.fishing', 10);
    applyCommand(s, { type: 'startAction', actionId: 'action.fish_stream' });
    advance(s, HOUR);
    expect(s.bank.items['item.trout']).toBeGreaterThan(s.bank.items['item.sardine'] ?? 0);
  });
});

describe('thieving', () => {
  it('success chance is 70% at the target level and capped at 95%', () => {
    expect(thievingSuccessChance(20, 20)).toBeCloseTo(0.7);
    expect(thievingSuccessChance(500, 20)).toBe(0.95);
    expect(thievingSuccessChance(-500, 20)).toBe(0.05);
    const s = newState();
    expect(successChance(s, action('action.pickpocket_farmhand'), { kind: 'player' })).toBeCloseTo(
      0.7,
    );
  });

  it('earns gold and gets stunned on failures', () => {
    const s = newState();
    applyCommand(s, { type: 'startAction', actionId: 'action.pickpocket_farmhand' });
    advance(s, HOUR);
    expect(s.gold).toBeGreaterThan(0);
    expect(s.stats.thievingFails).toBeGreaterThan(0);
    // Stuns make the action count lower than pure duration would allow.
    expect(s.stats.actionsCompleted).toBeLessThan(HOUR / 5000);
  });
});

describe('mastery', () => {
  it('grows per action and feeds the pool', () => {
    const s = newState();
    applyCommand(s, { type: 'startAction', actionId: 'action.chop_pine' });
    advance(s, 10 * HOUR);
    const def = action('action.chop_pine');
    expect(masteryLevel(s, def)).toBeGreaterThan(10);
    expect(s.skills['skill.woodcutting'].pool).toBeGreaterThan(0);
    expect(s.skills['skill.woodcutting'].pool).toBeLessThanOrEqual(poolCap('skill.woodcutting'));
  });

  it('mastery shortens the player cycle', () => {
    const s = newState();
    const def = action('action.chop_pine');
    const base = cycleDuration(s, def, { kind: 'player' });
    s.skills['skill.woodcutting'].mastery[def.id] = xpForLevel(50);
    expect(cycleDuration(s, def, { kind: 'player' })).toBeLessThan(base);
  });

  it('pool XP can be spent to level one action', () => {
    const s = newState();
    const def = action('action.chop_pine');
    const cost = poolCostForNextMastery(s, def)!;
    expect(() =>
      applyCommand(s, { type: 'spendPool', skillId: 'skill.woodcutting', actionId: def.id }),
    ).toThrow(/pool/);
    s.skills['skill.woodcutting'].pool = cost;
    applyCommand(s, { type: 'spendPool', skillId: 'skill.woodcutting', actionId: def.id });
    expect(masteryLevel(s, def)).toBe(2);
    expect(s.skills['skill.woodcutting'].pool).toBe(0);
  });
});
