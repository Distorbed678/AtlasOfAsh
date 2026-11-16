import { storage } from './storage';

const SEEN_KEY = 'aoa.lastSeenVersion';

/** True if this browser played an older version, so the new notes should pop up once. */
export function shouldAutoShowWhatsNew(): boolean {
  const seen = storage.get(SEEN_KEY);
  storage.set(SEEN_KEY, __APP_VERSION__);
  return seen !== null && seen !== __APP_VERSION__;
}
