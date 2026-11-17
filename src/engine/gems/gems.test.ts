import { describe, expect, it } from 'vitest';
import { applyCommand, CommandError } from '../commands';
import { CONTENT } from '../content';
import { ALL_GEMS, SKILL_GEMS, SPIRIT_GEMS, SUPPORT_GEMS } from '../content/gems';
import { Rng, seedRng } from '../core/rng';
import { addItem } from '../economy/bank';
import { newItem } from '../items/generate';
import { advance, type SimEvent } from '../sim';
import { createInitialState, type GameState } from '../state';
import { combatContext } from '../combat/context';
import { characterXpForLevel } from '../combat/progression';
import { effectiveDps } from '../combat/predict';
import { gemLevel, gemXpForLevel, MAX_GEM_LEVEL, supportFits } from './gems';
import { CUT_XP, spiritUsage } from './gemcutting';

const MIN = 60_000;

function char(level = 1, seed = 5, weapon = 'base.mace_t1'): GameState {
  const s = createInitialState(seed, 0, {
    id: 't',
    name: 'T',
    classId: 'class.ironclad',
    mode: 'standard',
  });
  s.charXp = characterXpForLevel(level);
  const r = new Rng(seedRng(seed));
  s.equipment.mainHand = newItem(1, weapon, 10, 'normal', r);
  s.equipment.body = newItem(2, 'base.body_ar_t1', 10, 'normal', r);
  s.equipment.flask1 = newItem(3, 'base.life_flask_t1', 10, 'normal', r);
  s.nextItemUid = 10;
  return s;
}

/** Cut a gem from a freshly added uncut stone and return its uid. */
function cut(s: GameState, gemId: string): number {
  const def = CONTENT.gems.get(gemId);
  const itemId = `item.uncut_${def.kind}_gem_t${def.tier}`;
  addItem(s, itemId, 1);
  s.skills['skill.gemcutting'].xp = Math.max(s.skills['skill.gemcutting'].xp, 10_000_000);
  applyCommand(s, { type: 'cutGem', itemId, gemId });
  return s.gems[s.gems.length - 1]!.uid;
}

describe('gem content', () => {
  it('has the agreed counts and unique ids', () => {
    expect(SKILL_GEMS).toHaveLength(60);
    expect(SUPPORT_GEMS).toHaveLength(45);
    expect(SPIRIT_GEMS).toHaveLength(12);
    expect(new Set(ALL_GEMS.map((g) => g.id)).size).toBe(ALL_GEMS.length);
  });

  it('every support fits at least one skill gem', () => {
    for (const sup of SUPPORT_GEMS)
      expect(
        SKILL_GEMS.some((sk) => supportFits(sk, sup)),
        sup.id,
      ).toBe(true);
  });

  it('every tier 1 weapon class has a tier 1 attack', () => {
    const t1 = SKILL_GEMS.filter((g) => g.tier === 1 && g.skillKind === 'attack');
    for (const w of [
      'mace',
      'axe',
      'sword',
      'dagger',
      'claw',
      'flail',
      'sceptre',
      'bow',
      'crossbow',
      'staff',
      'quarterstaff',
      'wand',
    ])
      expect(
        t1.some((g) => (g.weapons as readonly string[] | undefined)?.includes(w)),
        w,
      ).toBe(true);
  });

  it('gem XP curve reaches level 20 and caps there', () => {
    expect(gemLevel(0)).toBe(1);
    expect(gemLevel(gemXpForLevel(5))).toBe(5);
    expect(gemLevel(gemXpForLevel(MAX_GEM_LEVEL) * 10)).toBe(MAX_GEM_LEVEL);
  });
});

describe('gemcutting', () => {
  it('cuts any gem of the stone’s kind and tier, granting XP', () => {
    const s = char();
    addItem(s, 'item.uncut_skill_gem_t1', 2);
    applyCommand(s, {
      type: 'cutGem',
      itemId: 'item.uncut_skill_gem_t1',
      gemId: 'gem.crushing_blow',
    });
    expect(s.gems).toHaveLength(1);
    expect(s.gems[0]).toMatchObject({
      gemId: 'gem.crushing_blow',
      sockets: 2,
      supports: [null, null],
      quality: 0,
    });
    expect(s.skills['skill.gemcutting'].xp).toBe(CUT_XP(1));
    expect(() =>
      applyCommand(s, {
        type: 'cutGem',
        itemId: 'item.uncut_skill_gem_t1',
        gemId: 'gem.tremor_slam',
      }),
    ).toThrow(CommandError); // tier 2
    expect(() =>
      applyCommand(s, {
        type: 'cutGem',
        itemId: 'item.uncut_skill_gem_t1',
        gemId: 'gem.brutal_force',
      }),
    ).toThrow(CommandError); // support
  });

  it('a stone can be cut into a lower-tier gem', () => {
    const s = char();
    addItem(s, 'item.uncut_skill_gem_t2', 1);
    applyCommand(s, { type: 'cutGem', itemId: 'item.uncut_skill_gem_t2', gemId: 'gem.hew' });
    expect(s.gems[0]!.gemId).toBe('gem.hew');
  });

  it('higher tiers need Gemcutting level', () => {
    const s = char();
    addItem(s, 'item.uncut_skill_gem_t2', 1);
    expect(() =>
      applyCommand(s, {
        type: 'cutGem',
        itemId: 'item.uncut_skill_gem_t2',
        gemId: 'gem.tremor_slam',
      }),
    ).toThrow(/Gemcutting level 20/);
  });

  it('polishes quality up to 20 and opens sockets up to 5', () => {
    const s = char();
    const uid = cut(s, 'gem.crushing_blow');
    addItem(s, 'item.gem_fragment', 500);
    addItem(s, 'item.arcane_dust', 10_000);
    addItem(s, 'item.cut_gem', 100);
    for (let i = 0; i < 20; i++) applyCommand(s, { type: 'polishGem', uid });
    expect(() => applyCommand(s, { type: 'polishGem', uid })).toThrow(CommandError);
    for (let i = 0; i < 3; i++) applyCommand(s, { type: 'openGemSocket', uid });
    expect(() => applyCommand(s, { type: 'openGemSocket', uid })).toThrow(CommandError);
    const g = s.gems.find((x) => x.uid === uid)!;
    expect(g.quality).toBe(20);
    expect(g.sockets).toBe(5);
    expect(g.supports).toHaveLength(5);
  });

  it('sockets fitting supports, moves them, and rejects duplicates and misfits', () => {
    const s = char();
    const a = cut(s, 'gem.crushing_blow');
    const b = cut(s, 'gem.hew');
    const sup = cut(s, 'gem.brutal_force');
    const sup2 = cut(s, 'gem.brutal_force');
    const minionSup = cut(s, 'gem.minion_might');
    applyCommand(s, { type: 'socketSupport', skillUid: a, index: 0, supportUid: sup });
    expect(() =>
      applyCommand(s, { type: 'socketSupport', skillUid: a, index: 1, supportUid: sup2 }),
    ).toThrow(/already used/);
    expect(() =>
      applyCommand(s, { type: 'socketSupport', skillUid: a, index: 1, supportUid: minionSup }),
    ).toThrow(/cannot support/);
    // Once per character: the same support can't go into another skill either.
    expect(() =>
      applyCommand(s, { type: 'socketSupport', skillUid: b, index: 0, supportUid: sup2 }),
    ).toThrow(/already used/);
    // Moving a support takes it out of its old socket.
    applyCommand(s, { type: 'socketSupport', skillUid: b, index: 0, supportUid: sup });
    expect(s.gems.find((g) => g.uid === a)!.supports[0]).toBeNull();
    expect(s.gems.find((g) => g.uid === b)!.supports[0]).toBe(sup);
  });

  it('skill slots unlock by character level', () => {
    const s = char(1);
    const a = cut(s, 'gem.crushing_blow');
    applyCommand(s, { type: 'setSkillSlot', slot: 0, gemUid: a });
    expect(() => applyCommand(s, { type: 'setSkillSlot', slot: 1, gemUid: a })).toThrow(/level 4/);
    s.charXp = characterXpForLevel(4);
    applyCommand(s, { type: 'setSkillSlot', slot: 1, gemUid: a });
    expect(s.skillBar[0]!.gemUid).toBeNull();
    expect(s.skillBar[1]!.gemUid).toBe(a);
  });

  it('spirit gems reserve Spirit and refuse to overfill it', () => {
    const s = char(10);
    const iron = cut(s, 'gem.iron_bulwark');
    const veil = cut(s, 'gem.shadow_veil');
    const total = spiritUsage(s).total;
    expect(total).toBeGreaterThanOrEqual(30);
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.ashfall_beach' });
    const before = combatContext(s, s.time).armour;
    applyCommand(s, { type: 'toggleSpirit', uid: iron, active: true });
    expect(spiritUsage(s).used).toBe(30);
    if (total < 60)
      expect(() => applyCommand(s, { type: 'toggleSpirit', uid: veil, active: true })).toThrow(
        /Spirit/,
      );
    expect(combatContext(s, s.time).armour).toBeGreaterThan(before);
  });

  it('destroying a gem clears it from sockets and slots', () => {
    const s = char();
    const a = cut(s, 'gem.crushing_blow');
    const sup = cut(s, 'gem.brutal_force');
    applyCommand(s, { type: 'socketSupport', skillUid: a, index: 0, supportUid: sup });
    applyCommand(s, { type: 'setSkillSlot', slot: 0, gemUid: a });
    applyCommand(s, { type: 'destroyGem', uid: sup });
    applyCommand(s, { type: 'destroyGem', uid: a });
    expect(s.gems).toHaveLength(0);
    expect(s.skillBar[0]!.gemUid).toBeNull();
  });
});

describe('skills in combat', () => {
  function fight(s: GameState, ms: number) {
    const events: SimEvent[] = [];
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.ashfall_beach' });
    advance(s, s.time + ms, { onEvent: (e) => events.push(e) });
    return events;
  }

  it('uses the skill bar and levels gems from kills', () => {
    const s = char(3);
    const a = cut(s, 'gem.crushing_blow');
    const sup = cut(s, 'gem.brutal_force');
    applyCommand(s, { type: 'socketSupport', skillUid: a, index: 0, supportUid: sup });
    applyCommand(s, { type: 'setSkillSlot', slot: 0, gemUid: a });
    const events = fight(s, 10 * MIN);
    expect(
      events.filter((e) => e.type === 'skillUsed' && e.gemId === 'gem.crushing_blow').length,
    ).toBeGreaterThan(10);
    expect(s.gems.find((g) => g.uid === a)!.xp).toBeGreaterThan(0);
    expect(s.gems.find((g) => g.uid === sup)!.xp).toBe(s.gems.find((g) => g.uid === a)!.xp);
  });

  it('a skill that costs more mana than you have falls back to the basic attack', () => {
    const s = char(1);
    const a = cut(s, 'gem.crushing_blow');
    applyCommand(s, { type: 'setSkillSlot', slot: 0, gemUid: a });
    const events = fight(s, 30 * MIN);
    expect(events.some((e) => e.type === 'combatHit' && e.skill === 'basic_attack')).toBe(true);
  });

  it('weapon-restricted skills are unusable with the wrong weapon', () => {
    const s = char(3, 5, 'base.bow_t1');
    const a = cut(s, 'gem.crushing_blow');
    applyCommand(s, { type: 'setSkillSlot', slot: 0, gemUid: a });
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.ashfall_beach' });
    const sc = combatContext(s, s.time).skills[0]!;
    expect(sc.usable).toBe(false);
  });

  it('curses are applied and kept up; rules gate skills', () => {
    const s = char(4);
    const curse = cut(s, 'gem.fragile_mark');
    const atk = cut(s, 'gem.crushing_blow');
    applyCommand(s, { type: 'setSkillSlot', slot: 0, gemUid: curse });
    applyCommand(s, { type: 'setSkillSlot', slot: 1, gemUid: atk });
    applyCommand(s, { type: 'setSkillRule', slot: 0, rule: { kind: 'targetLacksDebuff' } });
    const events = fight(s, 10 * MIN);
    const curses = events.filter(
      (e) => e.type === 'skillUsed' && e.gemId === 'gem.fragile_mark',
    ).length;
    const kills = events.filter((e) => e.type === 'combatKill').length;
    expect(curses).toBeGreaterThan(0);
    // About one curse per monster (the curse outlasts most fights).
    expect(curses).toBeLessThanOrEqual(kills + 2);
  });

  it('combo builders gain points and finishers spend them', () => {
    const s = char(4, 5, 'base.claw_t1');
    const builder = cut(s, 'gem.rake');
    const finisher = cut(s, 'gem.talon_finisher');
    applyCommand(s, { type: 'setSkillSlot', slot: 0, gemUid: finisher });
    applyCommand(s, { type: 'setSkillRule', slot: 0, rule: { kind: 'comboAtLeast', value: 3 } });
    applyCommand(s, { type: 'setSkillSlot', slot: 1, gemUid: builder });
    const events = fight(s, 10 * MIN);
    expect(events.some((e) => e.type === 'skillUsed' && e.gemId === 'gem.talon_finisher')).toBe(
      true,
    );
    expect(events.some((e) => e.type === 'skillUsed' && e.gemId === 'gem.rake')).toBe(true);
  });

  it('warcries grant charges', () => {
    const s = char(4);
    const cry = cut(s, 'gem.rallying_cry');
    applyCommand(s, { type: 'setSkillSlot', slot: 0, gemUid: cry });
    applyCommand(s, { type: 'startCombat', zoneId: 'zone.ashfall_beach' });
    advance(s, s.time + 3000);
    expect(s.combat!.charges.endurance.n).toBe(3);
    expect(s.combat!.buffs.length).toBe(1);
  });

  it('persistent minions are summoned with Spirit, fight, and add predicted DPS', () => {
    const s = char(10);
    const sk = cut(s, 'gem.raise_skeletons');
    applyCommand(s, { type: 'setSkillSlot', slot: 0, gemUid: sk });
    const events = fight(s, 5 * MIN);
    expect(s.combat?.minions.length ?? 0).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'minionHit')).toBe(true);
    expect(effectiveDps(combatContext(s, s.time)).minionDps).toBeGreaterThan(0);
  });

  it('is deterministic with skills: small steps equal one big step', () => {
    const build = () => {
      const s = char(12, 9, 'base.claw_t1');
      const a = cut(s, 'gem.rake');
      const b = cut(s, 'gem.raise_skeletons');
      const c = cut(s, 'gem.fragile_mark');
      applyCommand(s, { type: 'setSkillSlot', slot: 0, gemUid: c });
      applyCommand(s, { type: 'setSkillSlot', slot: 1, gemUid: a });
      applyCommand(s, { type: 'setSkillSlot', slot: 2, gemUid: b });
      applyCommand(s, { type: 'startCombat', zoneId: 'zone.ashfall_beach' });
      return s;
    };
    const one = build();
    advance(one, 20 * MIN);
    const many = build();
    const r = new Rng(seedRng(1));
    while (many.time < 20 * MIN) advance(many, Math.min(20 * MIN, many.time + r.int(1, 7000)));
    expect(JSON.stringify(many)).toBe(JSON.stringify(one));
  });
});
