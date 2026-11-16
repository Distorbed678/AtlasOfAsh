/**
 * The single number/time formatter used everywhere in the UI.
 * Compact: 999 → "999", 1234 → "1.23k", 4_560_000 → "4.56M".
 */
const SUFFIXES = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : value < 0 ? '-∞' : '—';
  const sign = value < 0 ? '-' : '';
  let abs = Math.abs(value);
  if (abs < 1000) {
    // Small numbers: integers stay integers, fractions get up to 2 decimals.
    return sign + (Number.isInteger(abs) ? String(abs) : trimZeros(abs.toFixed(2)));
  }
  let tier = 0;
  while (abs >= 1000 && tier < SUFFIXES.length - 1) {
    abs /= 1000;
    tier++;
  }
  if (abs >= 1000) return sign + Math.abs(value).toExponential(2).replace('e+', 'e');
  // Round to `digits` significant figures, carrying into the next tier if needed (999.9k → 1M).
  let rounded = Number(abs.toPrecision(digits));
  if (rounded >= 1000 && tier < SUFFIXES.length - 1) {
    rounded /= 1000;
    tier++;
  }
  return (
    sign + trimZeros(rounded.toFixed(Math.max(0, digits - intDigits(rounded)))) + SUFFIXES[tier]
  );
}

/** Full value with thousands separators, e.g. for hover tooltips: 1234567 → "1,234,567". */
export function formatFull(value: number): string {
  if (!Number.isFinite(value)) return formatNumber(value);
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatPercent(fraction: number, decimals = 1): string {
  return trimZeros((fraction * 100).toFixed(decimals)) + '%';
}

/** Duration: "45s", "2m 05s", "2h 14m", "3d 4h". Shows the two most significant units. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60)
    return ms < 10_000 && ms % 1000 !== 0 ? `${(ms / 1000).toFixed(1)}s` : `${totalSec}s`;
  const d = Math.floor(totalSec / 86_400);
  const h = Math.floor((totalSec % 86_400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function intDigits(n: number): number {
  return Math.max(1, Math.floor(Math.log10(Math.abs(n))) + 1);
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}
