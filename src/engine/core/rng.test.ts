import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed, seedRng } from './rng';

describe('Rng', () => {
  it('is reproducible from the same seed', () => {
    const a = new Rng(seedRng(42));
    const b = new Rng(seedRng(42));
    for (let i = 0; i < 1000; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it('differs between seeds', () => {
    const a = new Rng(seedRng(1));
    const b = new Rng(seedRng(2));
    const sa = Array.from({ length: 8 }, () => a.nextU32());
    const sb = Array.from({ length: 8 }, () => b.nextU32());
    expect(sa).not.toEqual(sb);
  });

  it('continues identically after the state is serialised and restored', () => {
    const state = seedRng(7);
    const rng = new Rng(state);
    for (let i = 0; i < 50; i++) rng.nextU32();
    const restored = new Rng(JSON.parse(JSON.stringify(state)));
    for (let i = 0; i < 50; i++) expect(restored.nextU32()).toBe(rng.nextU32());
  });

  it('produces floats in [0,1) with a sane mean', () => {
    const rng = new Rng(seedRng(99));
    let sum = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const f = rng.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      sum += f;
    }
    expect(sum / n).toBeGreaterThan(0.49);
    expect(sum / n).toBeLessThan(0.51);
  });

  it('int() stays within inclusive bounds and hits both ends', () => {
    const rng = new Rng(seedRng(5));
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(1, 3);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('weighted() respects weights roughly', () => {
    const rng = new Rng(seedRng(11));
    const counts = { a: 0, b: 0 };
    const entries = [
      { weight: 3, value: 'a' as const },
      { weight: 1, value: 'b' as const },
    ];
    for (let i = 0; i < 40_000; i++) counts[rng.weighted(entries)]++;
    expect(counts.a / counts.b).toBeGreaterThan(2.8);
    expect(counts.a / counts.b).toBeLessThan(3.2);
  });

  it('deriveSeed gives distinct stable stream seeds', () => {
    expect(deriveSeed(1, 'combat')).toBe(deriveSeed(1, 'combat'));
    expect(deriveSeed(1, 'combat')).not.toBe(deriveSeed(1, 'loot'));
  });
});
