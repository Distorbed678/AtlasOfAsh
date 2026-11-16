import { describe, expect, it } from 'vitest';
import { CONTENT, SKILL_IDS } from '../engine/content';
import { ICON_DATA } from './iconData';
import { itemIcon, SKILL_ICONS } from './icons';

describe('icons', () => {
  it('every skill, item and building has an icon', () => {
    for (const id of SKILL_IDS) expect(ICON_DATA[SKILL_ICONS[id]], id).toBeDefined();
    for (const item of CONTENT.items.all())
      expect(ICON_DATA[itemIcon(item)], item.id).toBeDefined();
    for (const b of CONTENT.buildings.all()) expect(ICON_DATA[b.id], b.id).toBeDefined();
  });

  it('icon data is plain path data with an author credit', () => {
    for (const [key, icon] of Object.entries(ICON_DATA)) {
      expect(icon.d, key).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\se+-]+$/);
      expect(icon.author.length).toBeGreaterThan(0);
    }
  });
});
