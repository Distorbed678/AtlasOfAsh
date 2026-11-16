/**
 * Seeded, serialisable PRNG (xoshiro128**).
 *
 * All game randomness MUST go through this so online play and offline
 * catch-up produce identical results from the same save.
 * The state is a plain 4-tuple stored inside GameState; `Rng` mutates it in place.
 */
export type RngState = [number, number, number, number];

function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  };
}

/** Create a fresh RNG state from a 32-bit seed (any integer). */
export function seedRng(seed: number): RngState {
  const sm = splitmix32(seed);
  const s: RngState = [sm(), sm(), sm(), sm()];
  // xoshiro must never be all-zero.
  if ((s[0] | s[1] | s[2] | s[3]) === 0) s[0] = 1;
  return s;
}

/** Derive an independent stream seed from a base seed and a stream name. */
export function deriveSeed(baseSeed: number, stream: string): number {
  let h = baseSeed ^ 0x811c9dc5;
  for (let i = 0; i < stream.length; i++) {
    h ^= stream.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const rotl = (x: number, k: number) => (x << k) | (x >>> (32 - k));

export class Rng {
  constructor(private readonly s: RngState) {}

  /** Uniform unsigned 32-bit integer. */
  nextU32(): number {
    const s = this.s;
    const result = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
    const t = s[1] << 9;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return result;
  }

  /** Uniform float in [0, 1). */
  float(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`Rng.int: max (${max}) < min (${min})`);
    return min + Math.floor(this.float() * (max - min + 1));
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.float() < p;
  }

  /** Pick a value from weighted entries. */
  weighted<T>(entries: readonly { weight: number; value: T }[]): T {
    let total = 0;
    for (const e of entries) total += e.weight;
    if (total <= 0) throw new Error('Rng.weighted: total weight must be > 0');
    let roll = this.float() * total;
    for (const e of entries) {
      roll -= e.weight;
      if (roll < 0) return e.value;
    }
    return entries[entries.length - 1]!.value;
  }
}
