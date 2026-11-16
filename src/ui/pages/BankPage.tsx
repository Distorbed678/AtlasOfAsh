import { CONTENT } from '../../engine/content';
import { t, tDynamic } from '../../i18n';
import { command, useGame } from '../bridge';
import { Num } from '../components/Num';

export function BankPage() {
  const bank = useGame((s) => s.state?.bank ?? {});
  const entries = Object.entries(bank).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="page">
      <h1 className="page-title">{t('bank.title')}</h1>
      {entries.length === 0 ? (
        <p className="dim">{t('bank.empty')}</p>
      ) : (
        <div className="card-grid">
          {entries.map(([itemId, qty]) => {
            const def = CONTENT.items.tryGet(itemId);
            return (
              <div key={itemId} className="card">
                <div className="card-title">{tDynamic(def?.nameKey ?? itemId)}</div>
                <Num value={qty} className="big-num" />
                {def && <div className="dim small">{t('bank.value', { gold: def.sellPrice })}</div>}
                <button
                  className="btn"
                  onClick={() => command({ type: 'sellItem', itemId, qty })}
                  disabled={!def}
                >
                  {t('bank.sellAll')}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
