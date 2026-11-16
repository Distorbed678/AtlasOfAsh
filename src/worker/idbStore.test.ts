import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IdbStore } from './idbStore';

describe('IdbStore', () => {
  it('implements get/set/del/keys over IndexedDB', async () => {
    const store = new IdbStore('test-db', 'test-store');
    await store.set('a', '1');
    await store.set('b', '2');
    expect(await store.get('a')).toBe('1');
    expect((await store.keys()).sort()).toEqual(['a', 'b']);
    await store.del('a');
    expect(await store.get('a')).toBeUndefined();
  });
});
