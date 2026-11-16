/**
 * Content ids that once shipped and were removed. They must never be reused,
 * because old saves may still reference them (migrations map them to new ids).
 */
export const RETIRED_IDS: ReadonlySet<string> = new Set<string>([]);
