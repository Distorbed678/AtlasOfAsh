import { t, type TKey } from '../../i18n';
import { useFlag } from '../flags';
import { href, type Route } from '../router';

const MAIN: { route: Route; key: TKey; icon: string }[] = [
  { route: 'home', key: 'nav.home', icon: '🜂' },
  { route: 'bank', key: 'nav.bank', icon: '▤' },
];

/** Systems on the roadmap, shown greyed out with the phase that delivers them. */
const UPCOMING: { key: TKey; phase: number }[] = [
  { key: 'nav.upcoming.skills', phase: 1 },
  { key: 'nav.upcoming.town', phase: 1 },
  { key: 'nav.upcoming.character', phase: 3 },
  { key: 'nav.upcoming.combat', phase: 4 },
  { key: 'nav.upcoming.passives', phase: 6 },
  { key: 'nav.upcoming.atlas', phase: 9 },
];

export function Sidebar({
  route,
  open,
  onNavigate,
}: {
  route: Route;
  open: boolean;
  onNavigate: () => void;
}) {
  const devTools = useFlag('devTools');
  const showUpcoming = useFlag('showUpcoming');

  const link = (r: Route, key: TKey, icon: string) => (
    <a
      key={r}
      href={href(r)}
      className={`nav-link${route === r ? ' active' : ''}`}
      aria-current={route === r ? 'page' : undefined}
      onClick={onNavigate}
    >
      <span className="nav-icon" aria-hidden="true">
        {icon}
      </span>
      {t(key)}
    </a>
  );

  return (
    <nav className={`sidebar${open ? ' open' : ''}`} aria-label="Main">
      <div className="sidebar-brand">{t('app.title')}</div>
      <div className="nav-group">
        <div className="nav-group-title">{t('nav.group.general')}</div>
        {MAIN.map((m) => link(m.route, m.key, m.icon))}
      </div>

      {showUpcoming && (
        <div className="nav-group">
          <div className="nav-group-title">{t('nav.group.upcoming')}</div>
          {UPCOMING.map((u) => (
            <div key={u.key} className="nav-link disabled" aria-disabled="true">
              <span className="nav-icon" aria-hidden="true">
                ·
              </span>
              {t(u.key)}
              <span className="nav-badge">{t('nav.phase', { n: u.phase })}</span>
            </div>
          ))}
        </div>
      )}

      <div className="nav-group nav-bottom">
        {link('settings', 'nav.settings', '⚙')}
        {devTools && link('dev', 'nav.dev', '⚒')}
        <div className="nav-version">
          {t('app.version', { version: __APP_VERSION__, sha: __BUILD_SHA__ })}
        </div>
      </div>
    </nav>
  );
}
