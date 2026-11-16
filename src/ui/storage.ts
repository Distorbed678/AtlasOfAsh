/**
 * localStorage for small per-browser UI conveniences only (flags, last-seen
 * version). Game progress lives in IndexedDB via the worker. Every access is
 * guarded because storage can be unavailable (private mode, blocked cookies).
 */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
};
