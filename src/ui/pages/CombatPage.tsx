import { useMemo } from 'react';
import { CONTENT } from '../../engine/content';
import { FLASK_SLOTS, type FlaskSlot } from '../../engine/content/types';
import { combatContext } from '../../engine/combat/context';
import { flaskFor } from '../../engine/combat/flasks';
import { bagStacks } from '../../engine/combat/loot';
import { mainOffence, predictZone, type ZonePrediction } from '../../engine/combat/predict';
import { characterLevel } from '../../engine/combat/progression';
import { buildingValue } from '../../engine/economy/town';
import type { SimEvent } from '../../engine/sim';
import { TRIP_BAG_STACKS, type FlaskRuleMode, type GameState } from '../../engine/state';
import { nameOf, t, tDynamic } from '../../i18n';
import { formatDuration, formatNumber, formatPercent } from '../../shared/format';
import { command, useGame } from '../bridge';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { href } from '../router';
import { toast } from '../toasts';

const n = (x: number) => formatNumber(Math.round(x));

export function CombatPage() {
  const state = useGame((s) => s.state) as GameState;
  return (
    <div className="page">
      <h1 className="page-title">{t('combat.title')}</h1>
      {state.combat ? <Duel state={state} /> : <p className="dim">{t('combat.intro')}</p>}
      <SkillAndFlasks state={state} />
      <ZoneList state={state} />
    </div>
  );
}

function ZoneList({ state }: { state: GameState }) {
  // Predictions only change with gear, level and flask settings.
  const key = `${state.gearVersion}|${characterLevel(state.charXp)}|${state.combatSettings.skill}|${JSON.stringify(state.combatSettings.flaskRules)}`;
  const predictions = useMemo(() => {
    const out: Record<string, ZonePrediction> = {};
    for (const z of CONTENT.zones.all()) out[z.id] = predictZone(state, z.id);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <section>
      <h2 className="section-title">{tDynamic('act.1')}</h2>
      <div className="card-grid card-grid-wide">
        {CONTENT.zones.all().map((z) => {
          const p = predictions[z.id]!;
          const active = state.combat?.zoneId === z.id;
          return (
            <div key={z.id} className={`card${active ? ' card-active' : ''}`}>
              <div className="card-head">
                <div className="card-title">{nameOf(z.id)}</div>
                <span className="tag">{t('combat.monsterLevel', { n: z.level })}</span>
              </div>
              <p className="dim small">{tDynamic(`${z.id}.desc`)}</p>
              <div className="monster-list small">
                {z.monsters.map((m) => {
                  const def = CONTENT.monsters.get(m.monsterId);
                  return (
                    <span key={m.monsterId} title={tDynamic(`family.${def.family}`)}>
                      <Icon name={`family.${def.family}`} size={16} className="inline-icon" />{' '}
                      {nameOf(m.monsterId)}
                    </span>
                  );
                })}
              </div>
              <div className="small rates">
                {t('combat.predict', {
                  kills: n(p.killsPerHour),
                  xp: n(p.xpPerHour),
                  gold: n(p.goldPerHour),
                  gear: formatNumber(Math.round(p.gearPerHour * 10) / 10),
                })}
              </div>
              <div className={`risk risk-${p.risk} small`}>
                {t(`combat.risk.${p.risk}`)}
                {p.risk === 'risky' && Number.isFinite(p.killsToDeath) && (
                  <span className="dim">
                    {' '}
                    — {t('combat.riskNote.risky', { n: Math.floor(p.killsToDeath) })}
                  </span>
                )}
                {p.risk === 'deadly' && (
                  <span className="dim"> — {t('combat.riskNote.deadly')}</span>
                )}
              </div>
              {!active && (
                <button
                  className="btn btn-primary"
                  onClick={() => void command({ type: 'startCombat', zoneId: z.id })}
                >
                  {t('combat.fight')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Duel({ state }: { state: GameState }) {
  const c = state.combat!;
  const log = useGame((s) => s.log);
  const ctx = combatContext(state, state.time);
  const m = c.monster;
  const mStats = ctx.monster;
  const off = mainOffence(ctx);
  const playerProgress = 1 - (c.playerNextAt - state.time) / off.intervalMs;
  const current = c.lastSkill ?? off.skillId;
  const currentName =
    current === 'basic_attack' || current === 'basic_spell'
      ? t(`combat.skill.${current === 'basic_spell' ? 'spell' : 'attack'}`)
      : nameOf(current);
  const charges = (['endurance', 'frenzy', 'power'] as const).map((type) => ({
    type,
    n: c.charges[type].until > state.time ? c.charges[type].n : 0,
  }));
  const debuffs = m.debuffs.filter((d) => d.until > state.time);
  const monsterProgress = 1 - (m.nextAt - state.time) / mStats.attackIntervalMs;
  const stacks = bagStacks(c.bag);
  const autoBank = buildingValue(state, 'building.waystone');
  const retreatIn = Math.max(0, c.retreatReadyAt - state.time);
  const lifePct = c.life / ctx.maxLife;
  const ailments = [
    m.ignite && m.ignite.until > state.time && 'ignite',
    m.bleed && m.bleed.until > state.time && 'bleed',
    m.poison.length > 0 && `poison ×${m.poison.length}`,
    m.shock && m.shock.until > state.time && 'shock',
    m.chill && m.chill.until > state.time && 'chill',
    m.frozenUntil && m.frozenUntil > state.time && 'freeze',
  ].filter(Boolean) as string[];

  return (
    <>
      <div className="duel">
        <div className="panel duel-side">
          <div className="card-head">
            <div className="card-title">{state.character.name}</div>
            <span className="tag">{t('topbar.level', { n: ctx.level })}</span>
          </div>
          <Bar label={t('combat.life')} value={c.life} max={ctx.maxLife} kind="life" />
          {ctx.maxEs > 0 && <Bar label={t('combat.es')} value={c.es} max={ctx.maxEs} kind="es" />}
          <Bar label={t('combat.mana')} value={c.mana} max={ctx.maxMana} kind="mana" />
          <div className="small dim">{t('combat.current', { name: currentName })}</div>
          <ProgressBar value={playerProgress} label="attack" />
          <div className="combat-status small">
            <span className="dim">{t('combat.charges')}</span>
            {charges.map(({ type, n }) => (
              <span key={type} title={tDynamic(`charge.${type}`)}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`charge-pip charge-${type}${i < n ? ' on' : ''}`} />
                ))}
              </span>
            ))}
            {c.combo.points > 0 && (
              <span className="tag">{t('combat.combo', { n: c.combo.points })}</span>
            )}
            {c.guard && c.guard.until > state.time && (
              <span className="tag">{t('combat.guard', { n: Math.round(c.guard.absorb) })}</span>
            )}
            {c.buffs
              .filter((b) => b.until > state.time)
              .map((b) => {
                const gem = state.gems.find((g) => g.uid === b.gemUid);
                return (
                  <span key={b.gemUid} className="tag tag-good">
                    {gem ? nameOf(gem.gemId) : ''}
                  </span>
                );
              })}
          </div>
          {c.minions.length > 0 && (
            <div className="minion-list small">
              <span className="dim">{t('combat.minions')}</span>
              {c.minions.map((mi) => {
                const gem = state.gems.find((g) => g.uid === mi.gemUid);
                return (
                  <Bar
                    key={mi.id}
                    label={`${gem ? nameOf(gem.gemId) : ''}${mi.reviveAt !== undefined ? ` (${t('combat.minionDead')})` : ''}`}
                    value={mi.reviveAt !== undefined ? 0 : mi.life}
                    max={mi.maxLife}
                    kind="life"
                  />
                );
              })}
            </div>
          )}
          <div className="flask-row">
            {FLASK_SLOTS.map((slot) => {
              const item = state.equipment[slot];
              const f = item ? flaskFor(item) : null;
              const fs = c.flasks[slot];
              if (!f || !fs) return <span key={slot} className="flask-pip empty" />;
              const active = (fs.activeUntil ?? 0) > state.time || !!fs.recovery;
              return (
                <span
                  key={slot}
                  className={`flask-pip flask-${f.kind}${active ? ' active' : ''}`}
                  title={`${nameOf(item!.baseId)}: ${Math.floor(fs.charges)}/${f.maxCharges}`}
                >
                  <span
                    className="flask-fill"
                    style={{ height: `${(fs.charges / f.maxCharges) * 100}%` }}
                  />
                </span>
              );
            })}
          </div>
        </div>

        <div className="panel duel-side">
          <div className="card-head">
            <div className={`card-title monster-${m.rarity}`}>
              <Icon name={`family.${mStats.def.family}`} size={20} className="inline-icon" />{' '}
              {nameOf(m.defId)}
            </div>
            <span className="tag">
              {t(`combat.rarity.${m.rarity}`)} · {t('combat.monsterLevel', { n: m.level })}
            </span>
          </div>
          {m.mods.length > 0 && (
            <div className="small monster-mods">{m.mods.map((id) => nameOf(id)).join(' · ')}</div>
          )}
          <Bar label={t('combat.life')} value={m.life} max={m.maxLife} kind="enemy" />
          <ProgressBar value={monsterProgress} label="monster attack" />
          {ailments.length > 0 && <div className="small ailments">{ailments.join(' · ')}</div>}
          {debuffs.length > 0 && (
            <div className="small ailments">
              {debuffs
                .map((d) => {
                  const gem = state.gems.find((g) => g.uid === d.gemUid);
                  return gem ? nameOf(gem.gemId) : '';
                })
                .join(' · ')}
            </div>
          )}
          <div className="small dim">{t('combat.kills', { n: c.kills })}</div>
        </div>
      </div>

      <div className="row">
        <button className="btn" onClick={() => void command({ type: 'stopCombat' })}>
          {t('combat.stop')}
        </button>
        <button
          className="btn"
          disabled={retreatIn > 0}
          onClick={async () => {
            const before = useGame.getState().state?.combat;
            await command({ type: 'retreat' });
            if (before && useGame.getState().state?.combat) toastRetreat();
          }}
        >
          {retreatIn > 0
            ? t('combat.retreatCooldown', { s: Math.ceil(retreatIn / 1000) })
            : t('combat.retreat', { pct: formatPercent(lifePct, 0) })}
        </button>
      </div>

      <div className="duel-bottom">
        <section className="panel panel-wide">
          <div className="card-head">
            <h2 className="section-title">
              <Icon name="ui.bag" size={20} className="inline-icon" /> {t('combat.bag')}
            </h2>
            <span className={`tag${stacks >= TRIP_BAG_STACKS ? ' tag-bad' : ''}`}>
              {t('combat.bagCount', { n: stacks, cap: TRIP_BAG_STACKS })}
            </span>
          </div>
          {stacks >= TRIP_BAG_STACKS && <div className="bad small">{t('combat.bagFull')}</div>}
          <div className="small">{t('combat.bagGold', { gold: n(c.bag.gold) })}</div>
          {stacks === 0 ? (
            <p className="faint small">{t('combat.bagEmpty')}</p>
          ) : (
            <div className="bag-items small">
              {Object.entries(c.bag.items).map(([id, q]) => (
                <span key={id}>
                  {q}× {nameOf(id)}
                </span>
              ))}
              {c.bag.gear.map((g) => (
                <span key={g.uid} className={`rarity-text-${g.rarity}`}>
                  {g.name ? g.name.join(' ') : nameOf(g.baseId)}
                </span>
              ))}
            </div>
          )}
          <div className="row">
            <button className="btn btn-primary" onClick={() => void command({ type: 'bankLoot' })}>
              {t('combat.bank')}
            </button>
            <span className="faint small">{t('combat.bankNote')}</span>
          </div>
          <div className="faint small">
            {autoBank > 0
              ? t('combat.autoBank', {
                  n: autoBank,
                  t: formatDuration(Math.max(0, c.lastBankAt + autoBank * 60_000 - state.time)),
                })
              : t('combat.noAutoBank')}
          </div>
        </section>
        <section className="panel panel-wide">
          <h2 className="section-title">{t('combat.log')}</h2>
          <ul className="combat-log small">
            {[...log]
              .reverse()
              .slice(0, 14)
              .map((e, i) => (
                <li key={`${e.time}-${i}`} className={logClass(e)}>
                  {logText(e)}
                </li>
              ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function toastRetreat() {
  toast(t('combat.retreatFailed'), 'error');
}

function logClass(e: SimEvent): string {
  if (e.type === 'combatTaken' || e.type === 'death') return 'bad';
  if (e.type === 'combatKill' || e.type === 'characterLevelUp' || e.type === 'gemLevelUp')
    return 'good';
  if (e.type === 'minionDied') return 'bad';
  if (e.type === 'combatHit' && e.crit) return 'crit';
  return '';
}

function logText(e: SimEvent): string {
  switch (e.type) {
    case 'combatHit':
      return t(e.crit ? 'combat.log.crit' : 'combat.log.hit', {
        n: formatNumber(Math.round(e.damage * 10) / 10),
      });
    case 'combatMiss':
      return t('combat.log.miss');
    case 'combatTaken':
      return t('combat.log.taken', { n: formatNumber(Math.round(e.damage * 10) / 10) });
    case 'combatEvade':
      return t('combat.log.evade');
    case 'combatBlock':
      return t('combat.log.block');
    case 'combatKill':
      return t('combat.log.kill', { name: nameOf(e.monsterId) });
    case 'flaskUsed':
      return t('combat.log.flask', { slot: t(`slot.${e.slot as FlaskSlot}`) });
    case 'characterLevelUp':
      return t('combat.log.level', { n: e.level });
    case 'autoBanked':
      return t('combat.log.banked');
    case 'death':
      return t('combat.log.death', { name: nameOf(e.killer) });
    case 'skillTriggered':
      return t('combat.log.trigger', { name: nameOf(e.gemId) });
    case 'minionDied':
      return t('combat.log.minionDied');
    case 'gemLevelUp':
      return t('combat.log.gemLevel', { name: nameOf(e.gemId), n: e.level });
    default:
      return '';
  }
}

function Bar({
  label,
  value,
  max,
  kind,
}: {
  label: string;
  value: number;
  max: number;
  kind: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div
      className={`res-bar res-${kind}`}
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemax={Math.round(max)}
      aria-label={label}
    >
      <div className="res-fill" style={{ width: `${pct * 100}%` }} />
      <span className="res-text">
        {label} {formatNumber(Math.max(0, Math.round(value)))} / {formatNumber(Math.round(max))}
      </span>
    </div>
  );
}

function SkillAndFlasks({ state }: { state: GameState }) {
  const rules = state.combatSettings.flaskRules;
  const modes: FlaskRuleMode[] = ['off', 'lifeBelow', 'manaBelow', 'whenInactive'];
  const hasFlask = FLASK_SLOTS.some((s) => state.equipment[s]);
  return (
    <section className="panel panel-wide">
      <div className="row">
        <label className="row small">
          {t('combat.skill')}
          <select
            className="input"
            value={state.combatSettings.skill}
            onChange={(e) =>
              void command({
                type: 'setCombatSkill',
                skill: e.target.value as 'auto' | 'attack' | 'spell',
              })
            }
          >
            {(['auto', 'attack', 'spell'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`combat.skill.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <span className="faint small">{t('combat.skillNote')}</span>
      </div>
      <h2 className="section-title">{t('combat.flasks')}</h2>
      {!hasFlask && (
        <p className="faint small">
          {t('combat.noFlasks')} <a href={href({ page: 'equipment' })}>{t('nav.equipment')}</a>
        </p>
      )}
      <div className="flask-rules">
        {FLASK_SLOTS.map((slot) => {
          const item = state.equipment[slot];
          const rule = rules[slot] ?? { mode: 'off', threshold: 50 };
          return (
            <div key={slot} className="flask-rule small">
              <span className="flask-rule-name">
                {item ? nameOf(item.baseId) : t(`slot.${slot}`)}
              </span>
              <select
                className="input"
                value={rule.mode}
                onChange={(e) =>
                  void command({
                    type: 'setFlaskRule',
                    slot,
                    rule: { ...rule, mode: e.target.value as FlaskRuleMode },
                  })
                }
              >
                {modes.map((m) => (
                  <option key={m} value={m}>
                    {t(`combat.rule.${m}`)}
                  </option>
                ))}
              </select>
              {(rule.mode === 'lifeBelow' || rule.mode === 'manaBelow') && (
                <input
                  className="input input-num"
                  type="number"
                  min={1}
                  max={99}
                  value={rule.threshold}
                  onChange={(e) =>
                    void command({
                      type: 'setFlaskRule',
                      slot,
                      rule: { ...rule, threshold: Number(e.target.value) || 0 },
                    })
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
