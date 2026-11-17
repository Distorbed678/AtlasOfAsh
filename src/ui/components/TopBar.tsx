import { CONTENT } from '../../engine/content';
import { characterLevel } from '../../engine/combat/progression';
import { nameOf, t } from '../../i18n';
import { useGameState } from '../bridge';
import { Icon } from './Icon';
import { Num } from './Num';

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const gold = useGameState((s) => s.gold);
  const name = useGameState((s) => s.character.name);
  const actionId = useGameState((s) => s.action?.actionId);
  const zoneId = useGameState((s) => s.combat?.zoneId);
  const level = useGameState((s) => characterLevel(s.charXp));
  const def = actionId ? CONTENT.actions.get(actionId) : null;

  return (
    <header className="topbar">
      <button className="btn btn-icon menu-btn" onClick={onMenu} aria-label={t('nav.menu')}>
        ☰
      </button>
      <div className="topbar-char">
        {name} <span className="faint small">{t('topbar.level', { n: level })}</span>
      </div>
      <div className="topbar-action">
        {zoneId ? (
          <>
            <span className="pulse-dot pulse-combat" aria-hidden="true" />
            {t('topbar.fighting', { zone: nameOf(zoneId) })}
          </>
        ) : def ? (
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
