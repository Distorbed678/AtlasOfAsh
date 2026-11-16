import { GameHost, TICK_MS } from './host';
import { IdbStore } from './idbStore';
import type { FromWorker, ToWorker } from './protocol';

// Typed handle on the dedicated worker global (tsconfig uses the DOM lib).
const ctx = self as unknown as {
  postMessage(msg: FromWorker): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
};

const host = new GameHost({
  store: new IdbStore(),
  now: () => Date.now(),
  post: (msg) => ctx.postMessage(msg),
  yieldToEventLoop: () => new Promise((r) => setTimeout(r, 0)),
  newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0]!,
  build: { appVersion: __APP_VERSION__, buildSha: __BUILD_SHA__, buildTime: __BUILD_TIME__ },
});

ctx.onmessage = (e) => void host.handle(e.data);

host
  .init()
  .then(() => setInterval(() => void host.tick(), TICK_MS))
  .catch((err: unknown) =>
    ctx.postMessage({ type: 'error', message: `Failed to start: ${String(err)}` }),
  );
