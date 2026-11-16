import { describe, expect, it } from 'vitest';
import { ContentRegistry } from './registry';
import { CONTENT } from './index';

describe('ContentRegistry', () => {
  it('rejects duplicate ids', () => {
    const reg = new ContentRegistry('item', [{ id: 'item.a' }]);
    expect(() => reg.add({ id: 'item.a' })).toThrow(/Duplicate/);
  });

  it('rejects ids from the wrong category or with bad format', () => {
    const reg = new ContentRegistry('item');
    expect(() => reg.add({ id: 'action.a' })).toThrow(/must start with/);
    expect(() => reg.add({ id: 'Item A' })).toThrow(/Invalid/);
  });

  it('all shipped content loads and references valid ids', () => {
    for (const action of CONTENT.actions.all()) {
      for (const out of action.outputs) expect(CONTENT.items.has(out.itemId)).toBe(true);
    }
  });
});
