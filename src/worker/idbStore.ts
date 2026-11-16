import { createStore, del, get, keys, set, type UseStore } from 'idb-keyval';
import type { SaveStore } from '../engine/save/store';

/** IndexedDB-backed save storage (works inside the Web Worker). */
export class IdbStore implements SaveStore {
  private readonly db: UseStore;

  constructor(dbName = 'atlas-of-ash', storeName = 'saves') {
    this.db = createStore(dbName, storeName);
  }

  get(key: string) {
    return get<string>(key, this.db);
  }
  set(key: string, value: string) {
    return set(key, value, this.db);
  }
  del(key: string) {
    return del(key, this.db);
  }
  async keys() {
    return (await keys(this.db)).map(String);
  }
}
