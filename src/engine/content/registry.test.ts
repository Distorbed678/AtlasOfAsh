import { describe, expect, it } from 'vitest';
import { ContentRegistry } from './registry';
import { CONTENT, SKILL_IDS, actionsForSkill } from './index';

describe('ContentRegistry', () => {
  it('rejects duplicate ids', () => {
    const reg = new ContentRegistry('item', [{ id: 'item.a' }]);
    expect(() => reg.add({ id: 'item.a' })).toThrow(/Duplicate/);
  });

  it('rejects ids from the wrong category, bad format, or retired ids', () => {
    const reg = new ContentRegistry('item');
    expect(() => reg.add({ id: 'action.a' })).toThrow(/must start with/);
    expect(() => reg.add({ id: 'Item A' })).toThrow(/Invalid/);
    expect(() => reg.add({ id: 'item.demo_ember' })).toThrow(/retired/);
  });
});

describe('shipped content', () => {
  it('every action references existing items and skills', () => {
    for (const a of CONTENT.actions.all()) {
      expect(CONTENT.skills.has(a.skillId)).toBe(true);
      const ids: string[] = [];
      if (a.type === 'simple' || a.type === 'rock') ids.push(a.itemId);
      if (a.type === 'catch' || a.type === 'bundle') ids.push(...a.table.map((e) => e.itemId));
      if (a.type === 'thieve') ids.push(...a.rares.map((r) => r.itemId));
      for (const id of ids) expect(CONTENT.items.has(id), id).toBe(true);
    }
  });

  it('each skill has 10 tiers with increasing level and duration', () => {
    for (const skillId of SKILL_IDS) {
      const actions = actionsForSkill(skillId);
      expect(actions).toHaveLength(10);
      for (let i = 1; i < actions.length; i++) {
        expect(actions[i]!.level).toBeGreaterThan(actions[i - 1]!.level);
        expect(actions[i]!.durationMs).toBeGreaterThanOrEqual(actions[i - 1]!.durationMs);
      }
      expect(actions[0]!.durationMs).toBe(5000);
      expect(actions[9]!.durationMs).toBe(12000);
    }
  });

  it('rare finds, containers and building costs reference real items', () => {
    for (const s of CONTENT.skills.all())
      for (const r of s.rareFinds) expect(CONTENT.items.has(r.itemId)).toBe(true);
    for (const i of CONTENT.items.all())
      for (const e of i.container?.items ?? []) expect(CONTENT.items.has(e.itemId)).toBe(true);
    for (const b of CONTENT.buildings.all()) {
      expect(b.values).toHaveLength(b.tiers.length + 1);
      for (const t of b.tiers)
        for (const id of Object.keys(t.items)) expect(CONTENT.items.has(id), id).toBe(true);
    }
  });
});
