import type { BreakdownEntry, StatBreakdown } from '../../engine/stats/types';
import { t } from '../../i18n';
import { formatNumber, formatPercent } from '../../shared/format';

function fmt(n: number): string {
  return Math.abs(n) < 1000 ? String(Math.round(n * 100) / 100) : formatNumber(n);
}

function Entry({ e, render }: { e: BreakdownEntry; render: (v: number) => string }) {
  return (
    <li>
      <span className="bd-value">{render(e.value)}</span>
      <span className="bd-source">{e.source.label}</span>
      {e.tags && e.tags.length > 0 && <span className="bd-tags">{e.tags.join(' · ')}</span>}
      {e.condition && <span className="bd-tags">when {e.condition}</span>}
    </li>
  );
}

/** Explains one stat: base, every added/increased/more modifier with its source, and the total. */
export function Breakdown({
  b,
  label,
  unit = '',
}: {
  b: StatBreakdown;
  label: string;
  unit?: string;
}) {
  const none = !b.flat.length && !b.increased.length && !b.more.length && !b.override;
  return (
    <div className="breakdown">
      <h3 className="sub-title">{label}</h3>
      <ul className="bd-list">
        <li>
          <span className="bd-value">
            {fmt(b.base)}
            {unit}
          </span>
          <span className="bd-source">
            {t('bd.base')}
            {b.baseSource && b.baseSource.kind !== 'base' ? ` — ${b.baseSource.label}` : ''}
          </span>
        </li>
      </ul>
      {b.flat.length > 0 && (
        <>
          <div className="bd-head">{t('bd.flat')}</div>
          <ul className="bd-list">
            {b.flat.map((e, i) => (
              <Entry key={i} e={e} render={(v) => `${v >= 0 ? '+' : ''}${fmt(v)}${unit}`} />
            ))}
          </ul>
        </>
      )}
      {b.increased.length > 0 && (
        <>
          <div className="bd-head">
            {t('bd.increased', { pct: formatPercent(b.incSum / 100, 0) })}
          </div>
          <ul className="bd-list">
            {b.increased.map((e, i) => (
              <Entry key={i} e={e} render={(v) => `${v >= 0 ? '+' : ''}${fmt(v)}%`} />
            ))}
          </ul>
        </>
      )}
      {b.more.length > 0 && (
        <>
          <div className="bd-head">{t('bd.more')}</div>
          <ul className="bd-list">
            {b.more.map((e, i) => (
              <Entry key={i} e={e} render={(v) => `×${fmt(1 + v / 100)}`} />
            ))}
          </ul>
        </>
      )}
      {b.override && (
        <>
          <div className="bd-head">{t('bd.override')}</div>
          <ul className="bd-list">
            <Entry e={b.override} render={(v) => `${fmt(v)}${unit}`} />
          </ul>
        </>
      )}
      {none && <p className="faint small">{t('bd.none')}</p>}
      <div className="bd-formula small">
        {b.override
          ? `${t('bd.total')}: ${fmt(b.total)}${unit}`
          : t('bd.formula', {
              base: fmt(b.base),
              flat: fmt(b.flatSum),
              inc: fmt(1 + b.incSum / 100),
              more: fmt(b.moreMult),
              total: `${fmt(b.total)}${unit}`,
            })}
      </div>
    </div>
  );
}
