import { useState } from 'react';
import { t } from '../i18n';
import { useGame } from './bridge';
import { AwayModal, CatchUpOverlay } from './components/AwayModal';
import { Sidebar } from './components/Sidebar';
import { Toasts } from './components/Toasts';
import { TopBar } from './components/TopBar';
import { WhatsNewModal } from './components/WhatsNew';
import { useFlag } from './flags';
import { BankPage } from './pages/BankPage';
import { CharacterSelect } from './pages/CharacterSelect';
import { CodexPage } from './pages/CodexPage';
import { CombatPage } from './pages/CombatPage';
import { FilterPage } from './pages/FilterPage';
import { GemsPage } from './pages/GemsPage';
import { CreditsPage } from './pages/CreditsPage';
import { DevPage } from './pages/DevPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { StashPage } from './pages/StashPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { SkillPage } from './pages/SkillPage';
import { TownPage } from './pages/TownPage';
import { WorkersPage } from './pages/WorkersPage';
import { useRoute, type Route } from './router';
import { shouldAutoShowWhatsNew } from './whatsNewSeen';

export function App() {
  const ready = useGame((s) => s.ready);
  const hasCharacter = useGame((s) => s.state !== null);
  const [whatsNew, setWhatsNew] = useState(shouldAutoShowWhatsNew);

  return (
    <>
      {!ready ? (
        <div className="loading">{t('app.loading')}</div>
      ) : hasCharacter ? (
        <GameShell onWhatsNew={() => setWhatsNew(true)} />
      ) : (
        <CharacterSelect />
      )}
      <CatchUpOverlay />
      <AwayModal />
      {whatsNew && <WhatsNewModal onClose={() => setWhatsNew(false)} />}
      <Toasts />
    </>
  );
}

function GameShell({ onWhatsNew }: { onWhatsNew: () => void }) {
  const route = useRoute();
  const workerError = useGame((s) => s.workerError);
  const dismissError = useGame((s) => s.dismissError);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app">
      <Sidebar route={route} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}
      <div className="main">
        <TopBar onMenu={() => setMenuOpen((o) => !o)} />
        {workerError && (
          <div className="notice notice-error" role="alert">
            {t('error.generic', { message: workerError })}
            <button className="btn btn-small" onClick={dismissError}>
              ✕
            </button>
          </div>
        )}
        <main className="content">
          <Page route={route} onWhatsNew={onWhatsNew} />
        </main>
      </div>
    </div>
  );
}

function Page({ route, onWhatsNew }: { route: Route; onWhatsNew: () => void }) {
  const devTools = useFlag('devTools');
  switch (route.page) {
    case 'skill':
      return <SkillPage key={route.skillId} skillId={route.skillId} />;
    case 'bank':
      return <BankPage />;
    case 'town':
      return <TownPage />;
    case 'workers':
      return <WorkersPage />;
    case 'settings':
      return <SettingsPage />;
    case 'credits':
      return <CreditsPage />;
    case 'codex':
      return <CodexPage />;
    case 'stash':
      return <StashPage />;
    case 'combat':
      return <CombatPage />;
    case 'filter':
      return <FilterPage />;
    case 'gems':
      return <GemsPage />;
    case 'equipment':
      return <EquipmentPage />;
    case 'dev':
      if (devTools) return <DevPage />;
      return <OverviewPage onWhatsNew={onWhatsNew} />;
    case 'overview':
      return <OverviewPage onWhatsNew={onWhatsNew} />;
  }
}
