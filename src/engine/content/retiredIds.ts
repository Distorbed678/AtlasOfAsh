/**
 * Content ids that once shipped and were removed. They must never be reused,
 * because old saves may still reference them (migrations map them to new ids).
 */
export const RETIRED_IDS: ReadonlySet<string> = new Set<string>([
  // Phase 0 demo content
  'item.demo_ember',
  'item.demo_ash',
  'item.demo_cinder_shard',
  'action.demo_kindle',
  'action.demo_sift',
]);
