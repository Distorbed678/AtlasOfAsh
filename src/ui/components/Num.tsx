import { formatFull, formatNumber } from '../../shared/format';

/** Compact number with the full value on hover. */
export function Num({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className} title={formatFull(value)}>
      {formatNumber(value)}
    </span>
  );
}
