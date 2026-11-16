/** Minimal async key-value storage. IndexedDB in the browser, memory in tests. */
export interface SaveStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export class MemoryStore implements SaveStore {
  readonly data = new Map<string, string>();
  async get(key: string) {
    return this.data.get(key);
  }
  async set(key: string, value: string) {
    this.data.set(key, value);
  }
  async del(key: string) {
    this.data.delete(key);
  }
  async keys() {
    return [...this.data.keys()];
  }
}
