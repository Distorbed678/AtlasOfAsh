import type { ReactNode } from 'react';
import { CONTENT, SKILL_IDS } from '../../engine/content';
import { bankCapacity, bankSlotsUsed } from '../../engine/economy/bank';
import { levelProgress } from '../../engine/skills/xp';
import { nameOf, t, type TKey } from '../../i18n';
import { request, useGame, useGameState } from '../bridge';
import { useFlag } from '../flags';
import { SKILL_ICONS } from '../icons';
import { href, sameRoute, type Route } from '../router';
import { Icon } from './Icon';

/** Systems on the roadmap, shown greyed out with the phase that delivers them. */
const UPCOMING: { key: TKey; phase: number }[] = [
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
  const skills = useGameState((s) => s.skills);
  const bankUsed = useGameState((s) => bankSlotsUsed(s));
  const bankCap = useGameState((s) => bankCapacity(s));
  const levelFlash = useGame((s) => s.levelFlash);

  const link = (to: Route, label: string, icon: string, extra?: ReactNode, flash = false) => (
    <a
      key={href(to)}
      href={href(to)}
      className={`nav-link${sameRoute(route, to) ? ' active' : ''}${flash ? ' flash' : ''}`}
      aria-current={sameRoute(route, to) ? 'page' : undefined}
      onClick={onNavigate}
    >
      <Icon name={icon} size={18} className="nav-icon" />
      <span className="nav-label">{label}</span>
      {extra}
    </a>
  );

  return (
    <nav className={`sidebar${open ? ' open' : ''}`} aria-label="Main">
      <div className="sidebar-brand">{t('app.title')}</div>
      <div className="nav-group">
        <div className="nav-group-title">{t('nav.group.general')}</div>
        {link({ page: 'overview' }, t('nav.overview'), 'nav.overview')}
        {link(
          { page: 'bank' },
          t('nav.bank'),
          'nav.bank',
          <span className="nav-badge nav-badge-plain">{`${bankUsed}/${bankCap}`}</span>,
        )}
        {link({ page: 'stash' }, t('nav.stash'), 'nav.stash')}
        {link({ page: 'equipment' }, t('nav.equipment'), 'nav.equipment')}
        {link({ page: 'town' }, t('nav.town'), 'nav.town')}
        {link({ page: 'workers' }, t('nav.workers'), 'nav.workers')}
        {link({ page: 'codex' }, t('nav.codex'), 'nav.codex')}
      </div>
      {(['gathering', 'artisan'] as const).map((kind) => (
        <div key={kind} className="nav-group">
          <div className="nav-group-title">{t(`nav.group.${kind}`)}</div>
          {SKILL_IDS.filter((id) =>
            kind === 'artisan'
              ? CONTENT.skills.get(id).kind === 'artisan'
              : CONTENT.skills.get(id).kind !== 'artisan',
          ).map((id) => {
            const p = levelProgress(skills[id].xp);
            return link(
              { page: 'skill', skillId: id },
              nameOf(id),
              SKILL_ICONS[id],
              <>
                <span className="nav-badge nav-badge-plain">{p.level}</span>
                <span className="nav-xp" aria-hidden="true">
                  <span style={{ width: `${p.fraction * 100}%` }} />
                </span>
              </>,
              !!levelFlash[id],
            );
          })}
        </div>
      ))}

      {showUpcoming && (
        <div className="nav-group">
          <div className="nav-group-title">{t('nav.group.upcoming')}</div>
          {UPCOMING.map((u) => (
            <div key={u.key} className="nav-link disabled" aria-disabled="true">
              <span className="nav-icon nav-dot" aria-hidden="true">
                ·
              </span>
              <span className="nav-label">{t(u.key)}</span>
              <span className="nav-badge">{t('nav.phase', { n: u.phase })}</span>
            </div>
          ))}
        </div>
      )}

      <div className="nav-group nav-bottom">
        {link({ page: 'settings' }, t('nav.settings'), 'nav.settings')}
        {devTools && link({ page: 'dev' }, t('nav.dev'), 'nav.dev')}
        <button
          className="nav-link nav-button"
          onClick={() => {
            onNavigate();
            void request({ type: 'closeCharacter' });
          }}
        >
          <Icon name="nav.switch" size={18} className="nav-icon" />
          <span className="nav-label">{t('nav.switch')}</span>
        </button>
        <div className="nav-version">
          {t('app.version', { version: __APP_VERSION__, sha: __BUILD_SHA__ })}
        </div>
      </div>
    </nav>
  );
}
