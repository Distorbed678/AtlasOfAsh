import { CONTENT } from '../../engine/content';
import { t, tDynamic } from '../../i18n';
import { formatDuration } from '../../shared/format';
import { command, useGame } from '../bridge';
import { ProgressBar } from '../components/ProgressBar';
import { useFlag } from '../flags';

export function HomePage({ onWhatsNew }: { onWhatsNew: () => void }) {
  const demo = useFlag('demoActions');
  const action = useGame((s) => s.state?.action ?? null);
  const time = useGame((s) => s.state?.time ?? 0);

  return (
    <div className="page">
      <h1 className="page-title">{t('home.title')}</h1>
      <div className="panel">
        <p>{t('home.intro')}</p>
        <button className="btn" onClick={onWhatsNew}>
          {t('home.whatsNew')}
        </button>
      </div>

      {demo && (
        <>
          <h2 className="section-title">{t('home.actions')}</h2>
          <div className="card-grid">
            {CONTENT.actions.all().map((def) => {
              const active = action?.actionId === def.id;
              const progress =
                active && action
                  ? (time - action.startedAt) / (action.nextAt - action.startedAt)
                  : 0;
              return (
                <div key={def.id} className={`card${active ? ' card-active' : ''}`}>
                  <div className="card-title">{tDynamic(def.nameKey)}</div>
                  <div className="dim small">
                    {t('home.duration', { time: formatDuration(def.durationMs) })}
                  </div>
                  <ProgressBar value={progress} label={tDynamic(def.nameKey)} />
                  <button
                    className={`btn ${active ? '' : 'btn-primary'}`}
                    onClick={() =>
                      command(
                        active ? { type: 'stopAction' } : { type: 'startAction', actionId: def.id },
                      )
                    }
                  >
                    {active ? t('home.stop') : t('home.start')}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
