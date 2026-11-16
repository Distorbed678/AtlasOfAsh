import { useState } from 'react';
import { CONTENT } from '../../engine/content';
import { nameOf, t } from '../../i18n';
import { send, useGame } from '../bridge';

const MIN = 60_000;
const HOUR = 60 * MIN;
const SKIPS: [string, number][] = [
  ['1m', MIN],
  ['10m', 10 * MIN],
  ['1h', HOUR],
  ['8h', 8 * HOUR],
  ['24h', 24 * HOUR],
  ['7d', 7 * 24 * HOUR],
];
const SPEEDS = [1, 10, 100];

export function DevPage() {
  const state = useGame((s) => s.state);
  const items = CONTENT.items.all();
  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const [qty, setQty] = useState(100);
  const [speed, setSpeed] = useState(1);

  return (
    <div className="page">
      <h1 className="page-title">{t('dev.title')}</h1>

      <section className="panel">
        <h2 className="section-title">{t('dev.skip')}</h2>
        <div className="row">
          {SKIPS.map(([label, ms]) => (
            <button key={label} className="btn" onClick={() => send({ type: 'devSkip', ms })}>
              +{label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="section-title">{t('dev.speed')}</h2>
        <div className="row">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`btn${speed === s ? ' btn-primary' : ''}`}
              onClick={() => {
                setSpeed(s);
                send({ type: 'devSpeed', speed: s });
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="section-title">{t('dev.give')}</h2>
        <div className="row">
          <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {nameOf(i.id)}
              </option>
            ))}
          </select>
          <input
            className="input input-num"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          />
          <button className="btn" onClick={() => send({ type: 'devGive', itemId, qty })}>
            {t('dev.giveButton')}
          </button>
        </div>
        <div className="row">
          <button className="btn" onClick={() => send({ type: 'devGive', gold: 10_000 })}>
            {t('dev.gold')}
          </button>
          <button className="btn" onClick={() => send({ type: 'devGive', levels: 10 })}>
            {t('dev.levels')}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="section-title">{t('dev.state')}</h2>
        <pre className="code-block">{JSON.stringify(state, null, 2)}</pre>
      </section>
    </div>
  );
}
