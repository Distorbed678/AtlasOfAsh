import { en, type TKey } from './en';

export type { TKey } from './en';
export type Params = Record<string, string | number>;

const dictionaries: Record<string, Record<string, string>> = { en };
let current: Record<string, string> = en;

export function setLanguage(lang: string): void {
  current = dictionaries[lang] ?? en;
}

/** Translate a known key, interpolating `{name}` placeholders. */
export function t(key: TKey, params?: Params): string {
  return tDynamic(key, params);
}

/** Translate a key built at runtime (e.g. content `nameKey`s). Falls back to the key itself. */
export function tDynamic(key: string, params?: Params): string {
  const template = current[key] ?? (en as Record<string, string>)[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}
