import { tDynamic, t } from '../../i18n';
import { CONTENT } from '../../engine/content';
import { useGame } from '../bridge';
import { Num } from './Num';

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const gold = useGame((s) => s.state?.gold ?? 0);
  const actionId = useGame((s) => s.state?.action?.actionId);
  const actionName = actionId ? tDynamic(CONTENT.actions.get(actionId).nameKey) : null;

  return (
    <header className="topbar">
      <button className="btn btn-icon menu-btn" onClick={onMenu} aria-label={t('nav.menu')}>
        ☰
      </button>
      <div className="topbar-action">
        {actionName && <span className="pulse-dot" aria-hidden="true" />}
        {actionName}
      </div>
      <div className="topbar-gold" title={t('topbar.gold')}>
        <span className="gold-icon" aria-hidden="true">
          ◉
        </span>
        <Num value={gold} />
      </div>
    </header>
  );
}
