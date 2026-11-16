import { describe, expect, it } from 'vitest';
import { levelForXp, levelProgress, xpForLevel } from './xp';

describe('xp curve', () => {
  it('matches the classic idle curve reference points', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(83);
    expect(xpForLevel(10)).toBe(1154);
    expect(xpForLevel(99)).toBe(13_034_431);
  });

  it('level 92 is about halfway to 99', () => {
    expect(xpForLevel(92) / xpForLevel(99)).toBeGreaterThan(0.49);
    expect(xpForLevel(92) / xpForLevel(99)).toBeLessThan(0.51);
  });

  it('levelForXp inverts xpForLevel and respects the cap', () => {
    for (const l of [1, 2, 15, 50, 98, 99]) {
      expect(levelForXp(xpForLevel(l))).toBe(l);
      expect(levelForXp(xpForLevel(l) - 1)).toBe(Math.max(1, l - 1));
    }
    expect(levelForXp(1e12)).toBe(99);
    expect(levelForXp(1e12, 120)).toBe(120);
  });

  it('levelProgress reports fraction within the level', () => {
    const p = levelProgress(xpForLevel(10) + 50);
    expect(p.level).toBe(10);
    expect(p.current).toBe(50);
    expect(p.fraction).toBeGreaterThan(0);
    expect(levelProgress(1e12).atCap).toBe(true);
  });
});
