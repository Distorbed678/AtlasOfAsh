import { useMemo, useState } from 'react';
import type { CharacterSheet } from '../../engine/stats/character';
import { computeHit, type TargetStats } from '../../engine/stats/damage';
import { maxHits, mitigateIncoming } from '../../engine/stats/defence';
import { DAMAGE_TYPES, type DamageType, type ModKind, type StatId } from '../../engine/stats/types';
import { t } from '../../i18n';
import { formatNumber, formatPercent } from '../../shared/format';
import { useBench } from '../bench';
import { ALL_STATS, BENCH_PRESETS, BENCH_SKILLS, BENCH_WEAPONS } from '../benchPresets';
import { Breakdown } from './Breakdown';

const KINDS: ModKind[] = ['flat', 'increased', 'more', 'override'];
const n = (x: number) => (Math.abs(x) < 1000 ? String(Math.round(x * 10) / 10) : formatNumber(x));

export function TestBench({ sheet }: { sheet: CharacterSheet }) {
  const bench = useBench();
  const skill = BENCH_SKILLS.find((s) => s.id === bench.skillId) ?? BENCH_SKILLS[0]!;
  const weapon = BENCH_WEAPONS.find((w) => w.id === bench.weaponId) ?? BENCH_WEAPONS[0]!;
  const isAttack = skill.tags.includes('attack');
  const tg = bench.target;
  const target: TargetStats = useMemo(
    () => ({
      life: tg.life,
      armour: tg.armour,
      evasion: tg.evasion,
      resists: { fire: tg.fire, cold: tg.cold, lightning: tg.lightning, chaos: tg.chaos },
    }),
    [tg],
  );
  const hit = useMemo(
    () => computeHit(sheet, skill, isAttack ? weapon : null, target),
    [sheet, skill, weapon, isAttack, target],
  );
  const [packetIdx, setPacketIdx] = useState(0);
  const packet = hit.packets[Math.min(packetIdx, hit.packets.length - 1)];
  const inc = bench.incoming;
  const incoming = mitigateIncoming(sheet, {
    damage: { [inc.type]: inc.amount },
    accuracy: inc.accuracy > 0 ? inc.accuracy : undefined,
  });
  const survivable = maxHits(sheet);

  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  return (
    <section className="panel panel-wide bench">
      <h2 className="section-title">{t('bench.title')}</h2>
      <p className="dim small">{t('bench.intro')}</p>

      <h3 className="sub-title">{t('bench.presets')}</h3>
      <div className="row">
        {BENCH_PRESETS.map((p) => (
          <button
            key={p.label}
            className="btn btn-small"
            onClick={() => p.mods.forEach((m) => bench.addMod(m))}
          >
            {p.label}
          </button>
        ))}
      </div>

      <h3 className="sub-title">{t('bench.mods')}</h3>
      <div className="bench-mods">
        {bench.mods.map((m) => (
          <div key={m.id} className="bench-mod">
            <select
              className="input"
              aria-label={t('bench.stat')}
              value={m.stat}
              onChange={(e) => bench.updateMod(m.id, { stat: e.target.value as StatId })}
            >
              {ALL_STATS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="input"
              aria-label={t('bench.kind')}
              value={m.kind}
              onChange={(e) => bench.updateMod(m.id, { kind: e.target.value as ModKind })}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              className="input input-num"
              type="number"
              aria-label={t('bench.value')}
              value={m.value}
              onChange={(e) => bench.updateMod(m.id, { value: num(e.target.value) })}
            />
            <input
              className="input"
              aria-label={t('bench.tags')}
              placeholder={t('bench.tags')}
              value={m.tags}
              onChange={(e) => bench.updateMod(m.id, { tags: e.target.value })}
            />
            <button className="btn btn-small btn-danger" onClick={() => bench.removeMod(m.id)}>
              {t('bench.remove')}
            </button>
          </div>
        ))}
      </div>
      <div className="row">
        <button
          className="btn btn-small"
          onClick={() => bench.addMod({ stat: 'life', kind: 'flat', value: 10, tags: '' })}
        >
          {t('bench.addMod')}
        </button>
        {bench.mods.length > 0 && (
          <button className="btn btn-small" onClick={() => bench.update({ mods: [] })}>
            {t('bench.clear')}
          </button>
        )}
      </div>

      <div className="bench-grid">
        <label className="field">
          <span className="field-label">{t('bench.skill')}</span>
          <select
            className="input"
            value={skill.id}
            onChange={(e) => bench.update({ skillId: e.target.value })}
          >
            {BENCH_SKILLS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {isAttack && (
          <label className="field">
            <span className="field-label">{t('bench.weapon')}</span>
            <select
              className="input"
              value={weapon.id}
              onChange={(e) => bench.update({ weaponId: e.target.value })}
            >
              {BENCH_WEAPONS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <fieldset className="field">
        <legend className="field-label">{t('bench.target')}</legend>
        <div className="bench-target">
          {(['life', 'armour', 'evasion', 'fire', 'cold', 'lightning', 'chaos'] as const).map(
            (k) => (
              <label key={k} className="small">
                {k === 'life'
                  ? t('bench.targetLife')
                  : k === 'armour' || k === 'evasion'
                    ? t(`stat.${k}`)
                    : t(`dmg.${k}`)}
                <input
                  className="input input-num"
                  type="number"
                  value={tg[k]}
                  onChange={(e) => bench.update({ target: { ...tg, [k]: num(e.target.value) } })}
                />
              </label>
            ),
          )}
        </div>
      </fieldset>

      <h3 className="sub-title">{t('bench.result')}</h3>
      <div className="bench-dps">{t('bench.dps', { n: n(hit.dps) })}</div>
      <div className="stat-row small">
        <span>
          {t('bench.crit', {
            chance: formatPercent(hit.critChance, 1),
            bonus: formatPercent(hit.critBonus, 0),
          })}
        </span>
        <span>{t('bench.speed', { n: n(hit.usesPerSecond) })}</span>
        <span>{t('bench.hitChance', { pct: formatPercent(hit.hitChance, 1) })}</span>
        {hit.leechPerSecond > 0 && <span>{t('bench.leech', { n: n(hit.leechPerSecond) })}</span>}
      </div>
      {Object.keys(hit.conversion).length > 0 && (
        <div className="faint small">
          {t('bench.conversion', {
            list: Object.entries(hit.conversion)
              .map(([k, v]) => `${k.replace('.', ' → ')} ${n(v)}%`)
              .join(', '),
          })}
        </div>
      )}

      <div className="scroll-x">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('bench.type')}</th>
              <th>{t('bench.min')}</th>
              <th>{t('bench.max')}</th>
              <th>{t('bench.avg')}</th>
              <th>{t('bench.afterMit')}</th>
            </tr>
          </thead>
          <tbody>
            {DAMAGE_TYPES.filter((d) => hit.byType[d].max > 0).map((d) => (
              <tr key={d}>
                <td className={`dmg-${d}`}>{t(`dmg.${d}`)}</td>
                <td>{n(hit.byType[d].min)}</td>
                <td>{n(hit.byType[d].max)}</td>
                <td>{n(hit.byType[d].avg)}</td>
                <td>{n(hit.mitigatedByType[d])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hit.packets.length > 0 && (
        <div className="bench-packets">
          <div className="row small">
            {hit.packets.map((p, i) => (
              <button
                key={i}
                className={`btn btn-small${i === packetIdx ? ' btn-primary' : ''}`}
                onClick={() => setPacketIdx(i)}
              >
                {p.chain.map((c) => t(`dmg.${c}`)).join(' → ')} ({p.origin})
              </button>
            ))}
          </div>
          {packet && (
            <Breakdown
              b={packet.breakdown}
              label={`${t('bench.perType')}: ×${n(packet.breakdown.total)}`}
            />
          )}
        </div>
      )}
      <div className="bench-two">
        <Breakdown
          b={hit.critChanceBreakdown}
          label={t('bench.crit', { chance: '', bonus: '' }).split('·')[0]!}
          unit="%"
        />
        <Breakdown b={hit.speedBreakdown} label={t('bench.speed', { n: '' })} />
      </div>

      <h3 className="sub-title">{t('bench.ailments')}</h3>
      <ul className="gain-list">
        {hit.ailments.map((a) => (
          <li key={a.ailment}>
            <span>{t(`ailment.${a.ailment}`)}</span>
            <span className="small">
              {a.ailment === 'freeze'
                ? t('bench.ailment.freeze', {
                    n: Number.isFinite(a.hitsToFreeze) ? a.hitsToFreeze! : '∞',
                  })
                : t('bench.ailment.chance', { pct: formatPercent(a.chance, 1) })}
              {a.dps !== undefined &&
                ` · ${t('bench.ailment.dps', { n: n(a.dps), s: a.durationS })}`}
              {a.magnitude !== undefined &&
                ` · ${t('bench.ailment.magnitude', { n: n(a.magnitude), s: a.durationS })}`}
            </span>
          </li>
        ))}
      </ul>

      <h3 className="sub-title">{t('bench.incoming')}</h3>
      <div className="bench-target">
        <label className="small">
          {t('bench.incomingType')}
          <select
            className="input"
            value={inc.type}
            onChange={(e) =>
              bench.update({ incoming: { ...inc, type: e.target.value as DamageType } })
            }
          >
            {DAMAGE_TYPES.map((d) => (
              <option key={d} value={d}>
                {t(`dmg.${d}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="small">
          {t('bench.incomingAmount')}
          <input
            className="input input-num"
            type="number"
            value={inc.amount}
            onChange={(e) => bench.update({ incoming: { ...inc, amount: num(e.target.value) } })}
          />
        </label>
        <label className="small">
          {t('bench.incomingAccuracy')}
          <input
            className="input input-num"
            type="number"
            value={inc.accuracy}
            onChange={(e) => bench.update({ incoming: { ...inc, accuracy: num(e.target.value) } })}
          />
        </label>
      </div>
      <p className="small">
        {t('bench.incomingResult', {
          taken: n(incoming.taken),
          es: n(incoming.toEnergyShield),
          life: n(incoming.toLife),
          avoid: formatPercent(incoming.avoidChance, 1),
        })}
      </p>
      <h3 className="sub-title">{t('bench.maxHits')}</h3>
      <div className="stat-row small">
        {DAMAGE_TYPES.map((d) => (
          <span key={d} className={`dmg-${d}`}>
            {t(`dmg.${d}`)}: {Number.isFinite(survivable[d]) ? n(survivable[d]) : '∞'}
          </span>
        ))}
      </div>
    </section>
  );
}
