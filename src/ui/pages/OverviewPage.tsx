import { CONTENT, SKILL_IDS } from '../../engine/content';
import { workerSlotCount } from '../../engine/economy/town';
import { skillLevel } from '../../engine/skills/actions';
import type { GameState } from '../../engine/state';
import { nameOf, t } from '../../i18n';
import { formatNumber } from '../../shared/format';
import { useGame } from '../bridge';
import { ProgressBar } from '../components/ProgressBar';
import { SKILL_ICONS } from '../icons';
import { href } from '../router';
import { totalWagePerHour } from '../selectors';

export function OverviewPage({ onWhatsNew }: { onWhatsNew: () => void }) {
  const state = useGame((s) => s.state) as GameState;
  const { character } = state;
  const runner = state.action;
  const def = runner ? CONTENT.actions.get(runner.actionId) : null;
  const slots = workerSlotCount(state);
  const busy = state.workers.filter((w) => w.actionId && !w.paused).length;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{character.name}</h1>
        <span className="tag">
          {nameOf(character.classId)} · {t(`mode.${character.mode}`)}
        </span>
      </div>

      <section className="panel panel-wide">
        <h2 className="section-title">{t('overview.current')}</h2>
        {def && runner ? (
          <>
            <a href={href({ page: 'skill', skillId: def.skillId })}>
              {nameOf(def.skillId)} — {nameOf(def.id)}
            </a>
            <ProgressBar
              value={(state.time - runner.startedAt) / (runner.nextAt - runner.startedAt)}
              label={nameOf(def.id)}
            />
          </>
        ) : (
          <p className="dim">{t('overview.none')}</p>
        )}
      </section>

      <section>
        <h2 className="section-title">{t('overview.skills')}</h2>
        <div className="card-grid">
          {SKILL_IDS.map((id) => (
            <a key={id} className="card card-link" href={href({ page: 'skill', skillId: id })}>
              <div className="card-title">
                <span aria-hidden="true">{SKILL_ICONS[id]}</span> {nameOf(id)}
              </div>
              <div className="big-num">{skillLevel(state, id)}</div>
            </a>
          ))}
        </div>
      </section>

      <section className="panel panel-wide">
        <h2 className="section-title">{t('overview.workers')}</h2>
        {slots === 0 ? (
          <p className="dim">{t('overview.workersNone')}</p>
        ) : (
          <a href={href({ page: 'workers' })}>
            {t('overview.workersSummary', {
              busy,
              total: slots,
              wage: formatNumber(totalWagePerHour(state)),
            })}
          </a>
        )}
      </section>

      <button className="btn" onClick={onWhatsNew}>
        {t('overview.whatsNew')}
      </button>
    </div>
  );
}
