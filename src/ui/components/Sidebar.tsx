import { SKILL_IDS } from '../../engine/content';
import { bankCapacity, bankSlotsUsed } from '../../engine/economy/bank';
import { skillLevel } from '../../engine/skills/actions';
import { nameOf, t, type TKey } from '../../i18n';
import { request, useGameState } from '../bridge';
import { useFlag } from '../flags';
import { SKILL_ICONS } from '../icons';
import { href, sameRoute, type Route } from '../router';

/** Systems on the roadmap, shown greyed out with the phase that delivers them. */
const UPCOMING: { key: TKey; phase: number }[] = [
  { key: 'nav.upcoming.character', phase: 3 },
  { key: 'nav.upcoming.crafting', phase: 3 },
  { key: 'nav.upcoming.combat', phase: 4 },
  { key: 'nav.upcoming.passives', phase: 6 },
  { key: 'nav.upcoming.atlas', phase: 9 },
];

interface Props {
  route: Route;
  open: boolean;
  onNavigate: () => void;
}

export function Sidebar({ route, open, onNavigate }: Props) {
  const devTools = useFlag('devTools');
  const showUpcoming = useFlag('showUpcoming');
  const levels = useGameState((s) => SKILL_IDS.map((id) => skillLevel(s, id)).join(','));
  const bankUsed = useGameState((s) => bankSlotsUsed(s));
  const bankCap = useGameState((s) => bankCapacity(s));
  const levelList = levels.split(',');

  const link = (to: Route, label: string, icon: string, badge?: string) => (
    <a
      key={href(to)}
      href={href(to)}
      className={`nav-link${sameRoute(route, to) ? ' active' : ''}`}
      aria-current={sameRoute(route, to) ? 'page' : undefined}
      onClick={onNavigate}
    >
      <span className="nav-icon" aria-hidden="true">
        {icon}
      </span>
      {label}
      {badge && <span className="nav-badge nav-badge-plain">{badge}</span>}
    </a>
  );

  return (
    <nav className={`sidebar${open ? ' open' : ''}`} aria-label="Main">
      <div className="sidebar-brand">{t('app.title')}</div>
      <div className="nav-group">
        <div className="nav-group-title">{t('nav.group.general')}</div>
        {link({ page: 'overview' }, t('nav.overview'), '◈')}
        {link({ page: 'bank' }, t('nav.bank'), '▤', `${bankUsed}/${bankCap}`)}
        {link({ page: 'town' }, t('nav.town'), '⌂')}
        {link({ page: 'workers' }, t('nav.workers'), '☗')}
      </div>
      <div className="nav-group">
        <div className="nav-group-title">{t('nav.group.skills')}</div>
        {SKILL_IDS.map((id, i) =>
          link({ page: 'skill', skillId: id }, nameOf(id), SKILL_ICONS[id], levelList[i]),
        )}
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
        {link({ page: 'settings' }, t('nav.settings'), '⚙')}
        {devTools && link({ page: 'dev' }, t('nav.dev'), '⚒')}
        <button
          className="nav-link nav-button"
          onClick={() => {
            onNavigate();
            void request({ type: 'closeCharacter' });
          }}
        >
          <span className="nav-icon" aria-hidden="true">
            ⇄
          </span>
          {t('nav.switch')}
        </button>
        <div className="nav-version">
          {t('app.version', { version: __APP_VERSION__, sha: __BUILD_SHA__ })}
        </div>
      </div>
    </nav>
  );
}
