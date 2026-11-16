import { CONTENT } from '../../engine/content';
import { nameOf, t } from '../../i18n';
import { useGameState } from '../bridge';
import { Icon } from './Icon';
import { Num } from './Num';

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const gold = useGameState((s) => s.gold);
  const name = useGameState((s) => s.character.name);
  const actionId = useGameState((s) => s.action?.actionId);
  const def = actionId ? CONTENT.actions.get(actionId) : null;

  return (
    <header className="topbar">
      <button className="btn btn-icon menu-btn" onClick={onMenu} aria-label={t('nav.menu')}>
        ☰
      </button>
      <div className="topbar-char">{name}</div>
      <div className="topbar-action">
        {def ? (
          <>
            <span className="pulse-dot" aria-hidden="true" />
            {nameOf(def.skillId)}: {nameOf(def.id)}
          </>
        ) : (
          <span className="faint">{t('topbar.idle')}</span>
        )}
      </div>
      <div className="topbar-gold" title={t('topbar.gold')}>
        <Icon name="ui.gold" size={18} />
        <Num value={gold} />
      </div>
    </header>
  );
}
