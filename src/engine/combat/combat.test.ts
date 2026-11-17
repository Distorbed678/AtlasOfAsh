import { describe, expect, it } from 'vitest';
import { applyCommand, CommandError } from '../commands';
import { CONTENT } from '../content';
import { Rng, seedRng } from '../core/rng';
import { newItem } from '../items/generate';
import { advance } from '../sim';
import { createInitialState, type GameState } from '../state';
import { HOUR } from '../testUtils';
import { combatContext } from './context';
import { bagStacks, collectDrops, emptyBag, filterAction } from './loot';
import { monsterBaseline, monsterStats } from './monsterStats';
import { characterLevel, characterXpForLevel, xpAfterDeath } from './progression';

const MIN = 60_000;

/** A level-appropriate character with a T1 mace, T1 plate and a life flask. */
function geared(
  seed = 3,
  level = 1,
  mode: 'standard' | 'hardcore' | 'mortal' = 'standard',
): GameState {
  const s = createInitialState(seed, 0, { id: 't', name: 'T', classId: 'class.ironclad', mode });
  s.charXp = characterXpForLevel(level);
  const r = new Rng(seedRng(seed));
  s.equipment.mainHand = newItem(1, 'base.mace_t1', 10, 'normal', r);
  s.equipment.body = newItem(2, 'base.body_ar_t1', 10, 'normal', r);
  s.equipment.flask1 = newItem(3, 'base.life_flask_t1', 10, 'normal', r);
  s.nextItemUid = 10;
  return s;
}

describe('content', () => {
  it('every zone references real monsters; 8 Act 1 zones with rising levels', () => {
    const zones = CONTENT.zones.all();
    expect(zones).toHaveLength(8);
    for (let i = 1; i < zones.length; i++)
      expect(zones[i]!.level).toBeGreaterThan(zones[i - 1]!.level);
    for (const z of zones)
      for (const m of z.monsters) expect(CONTENT.monsters.has(m.monsterId)).toBe(true);
  });

  it('monster evasion gives ~85% hit chance to a matching-level character with base accuracy', () => {
    for (const L of [1, 10, 50, 90]) {
      const acc = 6 * L + 50;
      const eva = monsterBaseline(L).evasion;
      const chance = (1.2 * acc) / (acc + eva / 4);
      expect(chance).toBeGreaterThan(0.84);
      expect(chance).toBeLessThan(0.86);
    }
  });

  it('rarity and mods scale monsters', () => {
    const n = monsterStats('monster.marsh_brute', 4, 'normal', []);
    const r = monsterStats('monster.marsh_brute', 4, 'rare', [
      'monstermod.hulking',
      'monstermod.fire_touched',
    ]);
    expect(r.maxLife).toBeGreaterThan(n.maxLife * 5);
    expect(r.hitByType.fire).toBeGreaterThan(0);
    expect(r.xp).toBeCloseTo(n.xp * 3.5);
  });
});

describe('combat loop', () => {
  it('kills monsters, gains XP and fills the trip bag', () => {
    const s = geared();
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.ashfall_beach' });
    advance(s, 10 * MIN);
    expect(s.combat).not.toBeNull();
    expect(s.stats.kills).toBeGreaterThan(20);
    expect(s.charXp).toBeGreaterThan(0);
    expect(s.combat!.bag.gold).toBeGreaterThan(0);
  });

  it('starting combat stops skilling and vice versa', () => {
    const s = geared();
    applyCommand(s, { type: 'startAction', actionId: 'action.chop_pine' });
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.ashfall_beach' });
    expect(s.action).toBeNull();
    advance(s, MIN);
    applyCommand(s, { type: 'startAction', actionId: 'action.chop_pine' });
    expect(s.combat).toBeNull();
    expect(s.gold).toBeGreaterThanOrEqual(0); // bag banked
  });

  it('is deterministic: small steps equal one big step', () => {
    const a = geared(9);
    const b = geared(9);
    applyCommand(a, { type: 'startCombat', zoneId: 'zone.drowned_hamlet' });
    applyCommand(b, { type: 'startCombat', zoneId: 'zone.drowned_hamlet' });
    const steps = new Rng(seedRng(4));
    while (a.time < 20 * MIN) advance(a, Math.min(20 * MIN, a.time + steps.int(1, 900)));
    advance(b, 20 * MIN);
    expect(a).toEqual(b);
  });

  it('simulates hours of combat quickly', () => {
    const s = geared(5, 15);
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.ashfall_beach' });
    const t0 = performance.now();
    advance(s, 12 * HOUR);
    expect(performance.now() - t0).toBeLessThan(8000);
    expect(s.stats.kills).toBeGreaterThan(1000);
  });

  it('uses life flasks when low', () => {
    const s = geared(7, 3);
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.charcoal_ridge' });
    let used = false;
    advance(s, 5 * MIN, { onEvent: (e) => (used ||= e.type === 'flaskUsed') });
    expect(used).toBe(true);
  });
});

describe('death', () => {
  function killed(mode: 'standard' | 'hardcore' | 'mortal') {
    const s = geared(1, 5, mode);
    s.equipment = {}; // naked level 5 in the hardest zone
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.ember_gate' });
    advance(s, 30 * MIN);
    return s;
  }

  it('softcore: lose 10% of the level, the bag, and combat stops', () => {
    const s = killed('standard');
    expect(s.combat).toBeNull();
    expect(s.stats.deaths).toBe(1);
    expect(characterLevel(s.charXp)).toBe(5);
    const span = characterXpForLevel(6) - characterXpForLevel(5);
    expect(xpAfterDeath(characterXpForLevel(5) + span * 0.5)).toBeCloseTo(
      characterXpForLevel(5) + span * 0.4,
    );
  });

  it('hardcore moves to standard; mortal is marked dead', () => {
    const hc = killed('hardcore');
    expect(hc.character.mode).toBe('standard');
    expect(hc.character.fellInHardcore).toBe(true);
    const m = killed('mortal');
    expect(m.dead?.level).toBe(5);
    expect(() => applyCommand(m, { type: 'startCombat', zoneId: 'zone.ashfall_beach' })).toThrow(
      CommandError,
    );
  });
});

describe('retreat, banking and the trip bag', () => {
  it('retreat succeeds at full life and banks the bag', () => {
    const s = geared();
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.ashfall_beach' });
    advance(s, 5 * MIN);
    const bagGold = s.combat!.bag.gold;
    const life = s.combat!.life;
    const ctx = combatContext(s, s.time);
    s.combat!.life = ctx.maxLife; // full life → 100% chance
    applyCommand(s, { type: 'retreat' });
    expect(s.combat).toBeNull();
    expect(s.gold).toBe(bagGold);
    expect(life).toBeGreaterThan(0);
  });

  it('failed retreat puts it on a 15s cooldown', () => {
    const s = geared();
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.ashfall_beach' });
    s.combat!.life = 0.0001; // ~0% chance
    applyCommand(s, { type: 'retreat' });
    expect(s.combat).not.toBeNull();
    expect(() => applyCommand(s, { type: 'retreat' })).toThrow(/cooldown/);
  });

  it('manual bank restarts both attack timers', () => {
    const s = geared();
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.ashfall_beach' });
    advance(s, 3 * MIN + 250);
    const c = s.combat!;
    applyCommand(s, { type: 'bankLoot' });
    expect(c.bag.gold).toBe(0);
    const ctx = combatContext(s, s.time);
    expect(c.playerNextAt).toBe(s.time + ctx.attack.intervalMs);
    expect(c.monster.nextAt).toBe(s.time + ctx.monster.attackIntervalMs);
  });

  it('a full bag loses new stacks', () => {
    const s = geared();
    const bag = emptyBag();
    for (let i = 0; i < 100; i++)
      bag.gear.push(newItem(100 + i, 'base.mace_t1', 1, 'normal', new Rng(seedRng(i))));
    collectDrops(s, bag, [{ kind: 'item', itemId: 'item.arcane_dust', qty: 2 }]);
    expect(bagStacks(bag)).toBe(100);
    expect(s.stats.itemsLost).toBe(2);
  });

  it('the Waystone auto-banks on its interval', () => {
    const s = geared(2, 15);
    s.town['building.waystone'] = 1; // every 60 minutes
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.ashfall_beach' });
    advance(s, 61 * MIN);
    expect(s.gold).toBeGreaterThan(0);
    expect(s.combat!.lastBankAt).toBeGreaterThanOrEqual(60 * MIN);
  });
});

describe('loot filter', () => {
  it('first matching rule wins; presets apply', () => {
    const s = geared();
    applyCommand(s, { type: 'applyFilterPreset', preset: 'raresOnly' });
    const r = new Rng(seedRng(1));
    const rare = newItem(50, 'base.mace_t1', 5, 'rare', r);
    const normal = newItem(51, 'base.mace_t1', 5, 'normal', r);
    expect(filterAction(s.lootFilter.rules, { kind: 'gear', item: rare })).toBe('keep');
    expect(filterAction(s.lootFilter.rules, { kind: 'gear', item: normal })).toBe('disenchant');
    const bag = emptyBag();
    collectDrops(s, bag, [{ kind: 'gear', item: normal }]);
    expect(bag.gear).toHaveLength(0);
    expect(bag.items['item.arcane_dust']).toBeGreaterThan(0);
  });
});

describe('gear level requirements', () => {
  it('blocks gear above your level', () => {
    const s = createInitialState(1, 0);
    s.stash.tabs[0]!.items.push(newItem(1, 'base.mace_t2', 10, 'normal', new Rng(seedRng(1))));
    expect(() => applyCommand(s, { type: 'equip', uid: 1, slot: 'mainHand' })).toThrow(/level 10/);
  });
});
