import { describe, expect, it } from 'vitest';
import { parseFlagList, resolveFlags } from './flags';

describe('flags', () => {
  it('uses dev/prod defaults', () => {
    expect(resolveFlags(true).devTools).toBe(true);
    expect(resolveFlags(false).devTools).toBe(false);
  });

  it('parses override lists and ignores unknown names', () => {
    expect(parseFlagList('devTools, -showUpcoming, bogus')).toEqual({
      devTools: true,
      showUpcoming: false,
    });
  });

  it('later overrides win', () => {
    const f = resolveFlags(false, { devTools: true }, { devTools: false });
    expect(f.devTools).toBe(false);
  });
});
