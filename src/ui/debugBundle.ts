import type { DebugBundle } from '../worker/protocol';
import { request } from './bridge';
import { downloadText, timestampForFile } from './download';

export async function downloadDebugBundle(extra: Record<string, unknown> = {}): Promise<void> {
  const bundle = await request<DebugBundle>({ type: 'debugBundle' });
  const full = { ...bundle, userAgent: navigator.userAgent, url: window.location.href, ...extra };
  downloadText(`atlas-of-ash-debug-${timestampForFile()}.json`, JSON.stringify(full, null, 2));
}
