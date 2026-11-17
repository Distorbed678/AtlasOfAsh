import { describe, expect, it } from 'vitest';
import { applyCommand, CommandError } from '../commands';
import { CONTENT } from '../content';
import { Rng, seedRng } from '../core/rng';
import { addItem } from '../economy/bank';
import { advance } from '../sim';
import { action, HOUR, newState, setLevel } from '../testUtils';
import { applyEnchant, dustYield } from './enchanting';
import { equipProblem, sheetFor } from './equipment';
import { eligibleAffixes, newItem, newUnique } from './generate';
import { computeItem, itemLines } from './itemStats';
import { stashFree } from './stash';
import { characterXpForLevel } from '../combat/progression';
import { AFFIX_LIMITS, type ItemInstance } from './types';

const rng = () => new Rng(seedRng(5));

function give(s: ReturnType<typeof newState>, items: Record<string, number>) {
  for (const [id, q] of Object.entries(items)) addItem(s, id, q);
}

function stashItem(s: ReturnType<typeof newState>, item: ItemInstance) {
  s.stash.tabs[0]!.items.push(item);
  return item;
}

describe('content', () => {
  it('every base has a crafting recipe, every recipe input exists', () => {
    const outputs = new Set(
      CONTENT.actions
        .all()
        .flatMap((a) => (a.type === 'craft' && a.output.kind === 'gear' ? [a.output.baseId] : [])),
    );
    for (const b of CONTENT.bases.all()) expect(outputs.has(b.id), b.id).toBe(true);
    for (const a of CONTENT.actions.all())
      if (a.type === 'craft')
        for (const id of Object.keys(a.inputs))
          expect(CONTENT.items.has(id), `${a.id} ${id}`).toBe(true);
  });

  it('every base can roll affixes; affix tiers are ordered by item level', () => {
    for (const b of CONTENT.bases.all())
      expect(eligibleAffixes(b).length, b.id).toBeGreaterThan(b.class === 'flask' ? 1 : 3);
    for (const a of CONTENT.affixes.all()) {
      for (let i = 1; i < a.tiers.length; i++)
        expect(a.tiers[i]!.ilvl).toBeGreaterThan(a.tiers[i - 1]!.ilvl);
    }
    expect(CONTENT.affixes.all().filter((a) => a.kind !== 'ashen').length).toBeGreaterThanOrEqual(
      40,
    );
  });
});

describe('item generation', () => {
  it('rare items have 4-6 mods within limits, unique groups, and tiers allowed by item level', () => {
    const r = rng();
    for (let i = 0; i < 200; i++) {
      const item = newItem(i, 'base.body_ar_t5', 40, 'rare', r);
      const n = item.prefixes.length + item.suffixes.length;
      expect(n).toBeGreaterThanOrEqual(4);
      expect(item.prefixes.length).toBeLessThanOrEqual(AFFIX_LIMITS.rare);
      expect(item.suffixes.length).toBeLessThanOrEqual(AFFIX_LIMITS.rare);
      const groups = [...item.prefixes, ...item.suffixes].map(
        (m) => CONTENT.affixes.get(m.affixId).group,
      );
      expect(new Set(groups).size).toBe(groups.length);
      for (const m of [...item.prefixes, ...item.suffixes])
        expect(CONTENT.affixes.get(m.affixId).tiers[m.tierIndex]!.ilvl).toBeLessThanOrEqual(40);
      expect(item.name).toHaveLength(2);
    }
  });

  it('local mods change the weapon itself; others become global', () => {
    const item: ItemInstance = {
      uid: 1,
      baseId: 'base.mace_t1', // 6–12 phys, 1.2 aps, 5% crit
      rarity: 'magic',
      ilvl: 10,
      prefixes: [{ affixId: 'affix.pct_phys_local', tierIndex: 0, values: [50] }],
      suffixes: [{ affixId: 'affix.attack_speed_local', tierIndex: 0, values: [10] }],
    };
    const c = computeItem(item, 'Test mace');
    expect(c.weapon!.physRange).toEqual([9, 18]); // × 1.5
    expect(c.weapon!.attacksPerSecond).toBeCloseTo(1.32);
    expect(c.globalMods).toHaveLength(0);
    expect(c.modified.has('phys')).toBe(true);
  });

  it('armour pieces turn local defences into global flat mods', () => {
    const item: ItemInstance = {
      uid: 2,
      baseId: 'base.body_ar_t1', // 30 armour
      rarity: 'magic',
      ilvl: 10,
      prefixes: [{ affixId: 'affix.flat_armour', tierIndex: 0, values: [10] }],
      suffixes: [{ affixId: 'affix.fire_res', tierIndex: 0, values: [8] }],
    };
    const c = computeItem(item, 'Plate');
    expect(c.armour).toBe(40);
    expect(c.globalMods.find((m) => m.stat === 'armour')!.value).toBe(40);
    expect(c.globalMods.find((m) => m.stat === 'resist.fire')!.value).toBe(8);
  });

  it('uniques roll their fixed lines', () => {
    const u = newUnique(9, 'unique.wanderers_wraps', rng());
    expect(u.rarity).toBe('unique');
    expect(itemLines(u).filter((l) => l.origin === 'unique')).toHaveLength(5);
  });
});

describe('crafting', () => {
  it('smelting consumes ore and makes bars (with mastery doubling)', () => {
    const s = newState();
    give(s, { 'item.copper_ore': 100 });
    applyCommand(s, { type: 'startAction', actionId: 'action.smelt_copper_bar' });
    advance(s, HOUR);
    // 50 bars max from 100 ore; the action stops when ore runs out.
    expect(s.bank.items['item.copper_ore'] ?? 0).toBeLessThan(2);
    expect(s.bank.items['item.copper_bar']).toBeGreaterThanOrEqual(50);
    expect(s.action).toBeNull();
  });

  it('cannot start without materials', () => {
    const s = newState();
    expect(() =>
      applyCommand(s, { type: 'startAction', actionId: 'action.smelt_copper_bar' }),
    ).toThrow(CommandError);
  });

  it('crafting gear puts items in the stash with item level capped by skill level', () => {
    const s = newState();
    give(s, { 'item.copper_bar': 30 });
    applyCommand(s, { type: 'startAction', actionId: 'action.craft_mace_t1' });
    advance(s, 2 * 60_000);
    const items = s.stash.tabs[0]!.items;
    expect(items.length).toBeGreaterThan(5);
    expect(items[0]!.baseId).toBe('base.mace_t1');
    expect(items[0]!.ilvl).toBeLessThanOrEqual(10);
    expect(s.stats.itemsCrafted).toBe(items.length);
  });

  it('stops when the stash is full', () => {
    const s = newState();
    give(s, { 'item.copper_bar': 1000 });
    for (let i = 0; i < 39; i++)
      stashItem(s, newItem(1000 + i, 'base.mace_t1', 1, 'normal', rng()));
    applyCommand(s, { type: 'startAction', actionId: 'action.craft_mace_t1' });
    advance(s, HOUR);
    expect(stashFree(s)).toBe(0);
    expect(s.action).toBeNull();
  });

  it('workers craft too and pause when materials run out', () => {
    const s = newState();
    s.town['building.guild_hall'] = 1;
    s.gold = 10_000;
    give(s, { 'item.copper_ore': 10 });
    applyCommand(s, { type: 'assignWorker', slot: 0, actionId: 'action.smelt_copper_bar' });
    advance(s, HOUR);
    expect(s.bank.items['item.copper_bar']).toBe(5);
    expect(s.workers[0]!.paused).toBe(true);
    give(s, { 'item.copper_ore': 4 });
    advance(s, 2 * HOUR);
    expect(s.bank.items['item.copper_bar']).toBe(7);
  });

  it('Herbalism yields fibre and pickpocketing yields pelts', () => {
    const s = newState();
    applyCommand(s, { type: 'startAction', actionId: 'action.gather_sage' });
    advance(s, HOUR);
    expect(s.bank.items['item.flax']).toBeGreaterThan(0);
    const t = newState();
    applyCommand(t, { type: 'startAction', actionId: 'action.pickpocket_farmhand' });
    advance(t, HOUR);
    expect(t.bank.items['item.rough_pelt']).toBeGreaterThan(0);
  });
});

describe('stash and equipment', () => {
  it('buys stash tabs for rising gold', () => {
    const s = newState();
    expect(() => applyCommand(s, { type: 'buyStashTab' })).toThrow(/gold/);
    s.gold = 6000;
    applyCommand(s, { type: 'buyStashTab' });
    applyCommand(s, { type: 'buyStashTab' });
    expect(s.stash.tabs).toHaveLength(3);
    expect(s.gold).toBe(0);
  });

  it('equips gear, checks attribute requirements, and swaps back to the stash', () => {
    const s = newState();
    s.charXp = characterXpForLevel(20); // level requirement of tier-3 gear
    const plate = stashItem(s, newItem(1, 'base.body_ar_t1', 10, 'normal', rng()));
    const heavy = stashItem(s, newItem(2, 'base.body_ar_t3', 30, 'normal', rng())); // needs 32 Str
    applyCommand(s, { type: 'equip', uid: plate.uid, slot: 'body' });
    expect(s.equipment.body?.uid).toBe(1);
    expect(sheetFor(s).armour.total).toBe(30);
    expect(equipProblem(s, heavy, 'body')).toMatch(/Requires 32 STR/);
    expect(() => applyCommand(s, { type: 'equip', uid: heavy.uid, slot: 'helmet' })).toThrow(/fit/);
    applyCommand(s, { type: 'unequip', slot: 'body' });
    expect(s.stash.tabs[0]!.items.map((i) => i.uid)).toContain(1);
  });

  it('two-handed weapons clear the off hand; bows keep quivers', () => {
    const s = newState();
    s.equipment.offHand = newItem(1, 'base.shield_t1', 10, 'normal', rng());
    const staff = stashItem(s, newItem(2, 'base.staff_t1', 10, 'normal', rng()));
    applyCommand(s, { type: 'equip', uid: staff.uid, slot: 'mainHand' });
    expect(s.equipment.offHand).toBeUndefined();
    const quiver = stashItem(s, newItem(3, 'base.quiver_t1', 10, 'normal', rng()));
    expect(equipProblem(s, quiver, 'offHand')).toMatch(/two-handed/);
  });

  it('sells and disenchants gear', () => {
    const s = newState();
    const a = stashItem(s, newItem(1, 'base.mace_t1', 10, 'rare', rng()));
    const b = stashItem(s, newItem(2, 'base.mace_t1', 10, 'normal', rng()));
    applyCommand(s, { type: 'disenchant', uids: [a.uid] });
    expect(s.bank.items['item.arcane_dust']).toBe(dustYield(a));
    expect(s.skills['skill.enchanting'].xp).toBe(4);
    applyCommand(s, { type: 'sellGear', uids: [b.uid] });
    expect(s.gold).toBeGreaterThan(0);
    expect(s.stash.tabs[0]!.items).toHaveLength(0);
  });
});

describe('enchanting', () => {
  it('transmute → augment → upgrade → reroll', () => {
    const r = rng();
    const item = newItem(1, 'base.ring_t5', 50, 'normal', r);
    applyEnchant(r, item, 'transmute');
    expect(item.rarity).toBe('magic');
    while (item.prefixes.length + item.suffixes.length < 2) applyEnchant(r, item, 'augment');
    expect(() => applyEnchant(r, item, 'augment')).toThrow(/open/);
    applyEnchant(r, item, 'upgrade');
    expect(item.rarity).toBe('rare');
    expect(item.prefixes.length + item.suffixes.length).toBe(3);
    applyEnchant(r, item, 'reroll');
    expect(item.prefixes.length + item.suffixes.length).toBeGreaterThanOrEqual(4);
  });

  it('locking keeps prefixes during a reroll', () => {
    const r = rng();
    const item = newItem(1, 'base.body_ar_t9', 90, 'rare', r);
    const prefixes = JSON.stringify(item.prefixes);
    applyEnchant(r, item, 'rerollKeepPrefixes');
    expect(JSON.stringify(item.prefixes)).toBe(prefixes);
    expect(item.suffixes.length).toBeGreaterThan(0);
  });

  it('infusion guarantees the chosen affix', () => {
    const r = rng();
    for (let i = 0; i < 20; i++) {
      const item = newItem(i, 'base.helmet_ar_t9', 90, 'normal', r);
      applyEnchant(r, item, 'infuse', 'item.infusion_vitality');
      expect(item.rarity).toBe('rare');
      expect(item.prefixes.some((m) => m.affixId === 'affix.life')).toBe(true);
    }
    expect(() =>
      applyEnchant(r, newItem(99, 'base.ring_t1', 10, 'normal', r), 'infuse', 'item.infusion_fury'),
    ).toThrow(/cannot appear/);
  });

  it('Ashen Brand outcomes are ~25% each and always final', () => {
    const r = rng();
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const item = newItem(i, 'base.amulet_t5', 50, 'rare', r);
      const out = applyEnchant(r, item, 'brand')!;
      counts[out] = (counts[out] ?? 0) + 1;
      expect(item.ashen).toBe(true);
      expect(() => applyEnchant(r, item, 'rerollValues')).toThrow(/Ashen/);
    }
    for (const k of ['nothing', 'implicit', 'reroll', 'brick']) {
      expect(counts[k]! / 2000).toBeGreaterThan(0.21);
      expect(counts[k]! / 2000).toBeLessThan(0.29);
    }
  });

  it('the enchant command checks level and reagents, and grants XP', () => {
    const s = newState();
    const item = stashItem(s, newItem(1, 'base.mace_t1', 10, 'normal', rng()));
    expect(() => applyCommand(s, { type: 'enchant', uid: item.uid, op: 'transmute' })).toThrow(
      /reagents/,
    );
    give(s, { 'item.spark_of_change': 1, 'item.kindled_heart': 1 });
    expect(() => applyCommand(s, { type: 'enchant', uid: item.uid, op: 'upgrade' })).toThrow(
      /level 15/,
    );
    applyCommand(s, { type: 'enchant', uid: item.uid, op: 'transmute' });
    expect(s.stash.tabs[0]!.items[0]!.rarity).toBe('magic');
    expect(s.bank.items['item.spark_of_change']).toBeUndefined();
    expect(s.skills['skill.enchanting'].xp).toBe(4);
    setLevel(s, 'skill.enchanting', 15);
    applyCommand(s, { type: 'enchant', uid: item.uid, op: 'upgrade' });
    expect(s.stash.tabs[0]!.items[0]!.rarity).toBe('rare');
  });

  it('enchanting reagents are crafted from dust and herbs', () => {
    const s = newState();
    give(s, { 'item.arcane_dust': 50, 'item.sage': 10 });
    applyCommand(s, { type: 'startAction', actionId: 'action.make_spark_of_change' });
    advance(s, HOUR);
    expect(s.bank.items['item.spark_of_change']).toBeGreaterThanOrEqual(10);
    expect(action('action.make_spark_of_change').skillId).toBe('skill.enchanting');
  });
});
