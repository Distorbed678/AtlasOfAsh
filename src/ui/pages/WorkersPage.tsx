import { actionsForSkill, CONTENT, SKILL_IDS } from '../../engine/content';
import { workerEfficiency, workerSlotCount, workerXpShare } from '../../engine/economy/town';
import { canPerform, cycleDuration, wagePerHour } from '../../engine/skills/actions';
import type { GameState } from '../../engine/state';
import { nameOf, t } from '../../i18n';
import { formatDuration, formatNumber, formatPercent } from '../../shared/format';
import { command, useGame } from '../bridge';
import { ProgressBar } from '../components/ProgressBar';
import { href } from '../router';
import { totalWagePerHour } from '../selectors';

export function WorkersPage() {
  const state = useGame((s) => s.state) as GameState;
  const slots = workerSlotCount(state);
  const totalWage = totalWagePerHour(state);

  return (
    <div className="page">
      <h1 className="page-title">{t('workers.title')}</h1>
      <p className="dim">
        {t('workers.intro', {
          eff: formatPercent(workerEfficiency(state), 0),
          xp: formatPercent(workerXpShare(state), 0),
        })}
      </p>
      {slots === 0 ? (
        <div className="panel">
          <p>{t('workers.none')}</p>
          <a className="btn" href={href({ page: 'town' })}>
            {t('nav.town')}
          </a>
        </div>
      ) : (
        <>
          <div className="panel panel-wide">
            <div>{t('workers.totalWage', { gold: formatNumber(totalWage) })}</div>
            {totalWage > 0 && (
              <div className="dim small">
                {t('workers.goldLasts', {
                  time: formatDuration((state.gold / totalWage) * 3_600_000),
                })}
              </div>
            )}
          </div>
          <div className="card-grid card-grid-wide">
            {Array.from({ length: slots }, (_, slot) => (
              <WorkerCard key={slot} slot={slot} state={state} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function WorkerCard({ slot, state }: { slot: number; state: GameState }) {
  const w = state.workers[slot];
  const def = w?.actionId ? CONTENT.actions.get(w.actionId) : null;
  const runner = w?.runner;
  const progress = runner
    ? (state.time - runner.startedAt) / (runner.nextAt - runner.startedAt)
    : 0;
  const status = !def ? t('workers.idle') : w?.paused ? t('workers.paused') : t('workers.working');

  return (
    <div className={`card${def && !w?.paused ? ' card-active' : ''}`}>
      <div className="card-head">
        <div className="card-title">{t('workers.slot', { n: slot + 1 })}</div>
        <span className={`tag${w?.paused ? ' tag-bad' : ''}`}>{status}</span>
      </div>
      <select
        className="input"
        value={w?.actionId ?? ''}
        onChange={(e) =>
          void command({ type: 'assignWorker', slot, actionId: e.target.value || null })
        }
      >
        <option value="">{t('workers.unassigned')}</option>
        {SKILL_IDS.map((skillId) => (
          <optgroup key={skillId} label={nameOf(skillId)}>
            {actionsForSkill(skillId)
              .filter((a) => canPerform(state, a))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {nameOf(a.id)}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {def && (
        <>
          <ProgressBar value={progress} label={nameOf(def.id)} />
          <div className="stat-row small">
            <span>{t('workers.wage', { gold: formatNumber(wagePerHour(state, def)) })}</span>
            <span>
              {t('workers.rate', {
                n: formatNumber(3_600_000 / cycleDuration(state, def, { kind: 'worker', slot })),
              })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
