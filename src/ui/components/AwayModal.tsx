import { CONTENT } from '../../engine/content';
import { t, tDynamic } from '../../i18n';
import { formatDuration } from '../../shared/format';
import { useGame } from '../bridge';
import { Modal } from './Modal';
import { Num } from './Num';
import { ProgressBar } from './ProgressBar';

export function AwayModal() {
  const away = useGame((s) => s.away);
  const dismiss = useGame((s) => s.dismissAway);
  if (!away) return null;
  const { summary } = away;
  const empty =
    summary.actionsCompleted === 0 && summary.items.length === 0 && summary.goldDelta === 0;

  return (
    <Modal
      title={t('away.title')}
      onClose={dismiss}
      footer={
        <button className="btn btn-primary" onClick={dismiss}>
          {t('away.close')}
        </button>
      }
    >
      <p>{t('away.duration', { time: formatDuration(summary.durationMs) })}</p>
      {empty ? (
        <p className="dim">{t('away.nothing')}</p>
      ) : (
        <>
          <p className="dim">{t('away.actions', { n: summary.actionsCompleted })}</p>
          <ul className="gain-list">
            {summary.items.map((i) => (
              <li key={i.itemId}>
                <span>{tDynamic(CONTENT.items.tryGet(i.itemId)?.nameKey ?? i.itemId)}</span>
                <span className={i.delta > 0 ? 'gain' : 'loss'}>
                  {i.delta > 0 ? '+' : ''}
                  <Num value={i.delta} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

export function CatchUpOverlay() {
  const catchUp = useGame((s) => s.catchUp);
  if (!catchUp) return null;
  return (
    <Modal title={t('catchup.title')}>
      <ProgressBar value={catchUp.done / catchUp.total} label={t('catchup.title')} />
      <p className="dim center">
        {t('catchup.progress', {
          done: formatDuration(catchUp.done),
          total: formatDuration(catchUp.total),
        })}
      </p>
    </Modal>
  );
}
