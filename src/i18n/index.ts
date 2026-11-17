import { combatEn } from './combat.en';
import { contentEn } from './content.en';
import { en, type TKey } from './en';
import { flavourEn } from './flavour.en';
import { itemsEn } from './items.en';

export type { TKey } from './en';
export type Params = Record<string, string | number>;

const english: Record<string, string> = {
  ...contentEn,
  ...itemsEn,
  ...combatEn,
  ...flavourEn,
  ...en,
};
const dictionaries: Record<string, Record<string, string>> = { en: english };
let current: Record<string, string> = english;

export function setLanguage(lang: string): void {
  current = dictionaries[lang] ?? english;
}

/** Translate a known UI key, interpolating `{name}` placeholders. */
export function t(key: TKey, params?: Params): string {
  return tDynamic(key, params);
}

/** Translate a key built at runtime (content ids, etc.). Falls back to the key itself. */
export function tDynamic(key: string, params?: Params): string {
  const template = current[key] ?? english[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

/** Display name for any content id. */
export function nameOf(id: string): string {
  return tDynamic(id);
}

export function hasTranslation(key: string): boolean {
  return key in english;
}
