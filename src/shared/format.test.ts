import { describe, expect, it } from 'vitest';
import { formatDuration, formatFull, formatNumber, formatPercent } from './format';

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [7, '7'],
    [999, '999'],
    [1.5, '1.5'],
    [0.123, '0.12'],
    [1000, '1k'],
    [1234, '1.23k'],
    [12_345, '12.3k'],
    [123_456, '123k'],
    [999_999, '1M'],
    [4_560_000, '4.56M'],
    [7_890_000_000, '7.89B'],
    [-1234, '-1.23k'],
    [Infinity, '∞'],
  ])('%s → %s', (input, expected) => {
    expect(formatNumber(input)).toBe(expected);
  });
});

describe('formatFull / formatPercent', () => {
  it('formats with separators', () => expect(formatFull(1234567)).toBe('1,234,567'));
  it('formats percents', () => {
    expect(formatPercent(0.255)).toBe('25.5%');
    expect(formatPercent(0.5)).toBe('50%');
  });
});

describe('formatDuration', () => {
  it.each([
    [500, '0.5s'],
    [3000, '3s'],
    [45_000, '45s'],
    [125_000, '2m 05s'],
    [2 * 3_600_000 + 14 * 60_000, '2h 14m'],
    [3 * 86_400_000 + 4 * 3_600_000, '3d 4h'],
  ])('%s → %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});
