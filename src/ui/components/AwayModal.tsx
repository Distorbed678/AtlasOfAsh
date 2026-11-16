import { nameOf, t } from '../../i18n';
import { formatDuration, formatNumber } from '../../shared/format';
import { useGame } from '../bridge';
import { Modal } from './Modal';
import { Num } from './Num';
import { ProgressBar } from './ProgressBar';

export function AwayModal() {
  const away = useGame((s) => s.away);
  const dismiss = useGame((s) => s.dismissAway);
  if (!away) return null;
  const { summary: s } = away;
  const empty = s.skills.length === 0 && s.items.length === 0 && s.goldDelta === 0;

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
      <p>{t('away.duration', { time: formatDuration(s.durationMs) })}</p>
      {empty ? (
        <p className="dim">{t('away.nothing')}</p>
      ) : (
        <>
          {s.skills.length > 0 && (
            <>
              <h3 className="sub-title">{t('away.skills')}</h3>
              <ul className="gain-list">
                {s.skills.map((g) => (
                  <li key={g.skillId}>
                    <span>
                      {nameOf(g.skillId)}
                      {g.levelAfter > g.levelBefore && (
                        <span className="good small">
                          {' '}
                          {t('away.levelUp', { from: g.levelBefore, to: g.levelAfter })}
                        </span>
                      )}
                    </span>
                    <span className="gain">
                      +<Num value={Math.floor(g.xp)} /> XP
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {(s.goldDelta !== 0 || s.wagesPaid > 0) && (
            <>
              <h3 className="sub-title">{t('away.gold')}</h3>
              <ul className="gain-list">
                <li>
                  <span>{t('away.gold')}</span>
                  <span className={s.goldDelta >= 0 ? 'gain' : 'loss'}>
                    {s.goldDelta >= 0 ? '+' : ''}
                    <Num value={s.goldDelta} />
                  </span>
                </li>
                {s.wagesPaid > 0 && (
                  <li className="dim small">
                    <span>{t('away.wages', { gold: formatNumber(s.wagesPaid) })}</span>
                  </li>
                )}
              </ul>
            </>
          )}
          {s.items.length > 0 && (
            <>
              <h3 className="sub-title">{t('away.items')}</h3>
              <ul className="gain-list">
                {s.items.map((i) => (
                  <li key={i.itemId}>
                    <span>{nameOf(i.itemId)}</span>
                    <span className={i.delta > 0 ? 'gain' : 'loss'}>
                      {i.delta > 0 ? '+' : ''}
                      <Num value={i.delta} />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {s.itemsDiscarded > 0 && (
            <p className="bad small">
              {t('away.discarded', { n: formatNumber(s.itemsDiscarded) })}
            </p>
          )}
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
