import { describe, expect, it } from 'vitest';
import { CONTENT } from '../engine/content';
import { hasTranslation, t, tDynamic } from './index';

describe('i18n', () => {
  it('interpolates params', () => {
    expect(t('nav.phase', { n: 3 })).toBe('Phase 3');
  });

  it('falls back to the key for unknown dynamic keys', () => {
    expect(tDynamic('nope.missing')).toBe('nope.missing');
  });

  it('every piece of content has an English name', () => {
    const all = [
      ...CONTENT.items.all(),
      ...CONTENT.actions.all(),
      ...CONTENT.skills.all(),
      ...CONTENT.classes.all(),
      ...CONTENT.buildings.all(),
      ...CONTENT.zones.all(),
      ...CONTENT.monsters.all(),
      ...CONTENT.monsterMods.all(),
      ...CONTENT.bases.all(),
      ...CONTENT.gems.all(),
    ];
    for (const c of all) expect(hasTranslation(c.id), c.id).toBe(true);
    for (const i of CONTENT.items.all())
      expect(hasTranslation(`${i.id}.desc`), `${i.id}.desc`).toBe(true);
    for (const c of CONTENT.classes.all()) {
      expect(hasTranslation(`${c.id}.desc`)).toBe(true);
      for (const w of c.weapons) expect(hasTranslation(w), w).toBe(true);
    }
  });
});
