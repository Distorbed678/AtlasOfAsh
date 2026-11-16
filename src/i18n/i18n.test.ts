import { describe, expect, it } from 'vitest';
import { CONTENT } from '../engine/content';
import { en } from './en';
import { t, tDynamic } from './index';

describe('i18n', () => {
  it('interpolates params', () => {
    expect(t('nav.phase', { n: 3 })).toBe('Phase 3');
  });

  it('falls back to the key for unknown dynamic keys', () => {
    expect(tDynamic('nope.missing')).toBe('nope.missing');
  });

  it('every content nameKey has an English string', () => {
    const keys = new Set(Object.keys(en));
    for (const item of CONTENT.items.all()) expect(keys.has(item.nameKey)).toBe(true);
    for (const action of CONTENT.actions.all()) expect(keys.has(action.nameKey)).toBe(true);
  });
});
