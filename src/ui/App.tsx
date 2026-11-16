import { useState } from 'react';
import { useGame } from './bridge';
import { AwayModal, CatchUpOverlay } from './components/AwayModal';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WhatsNewModal } from './components/WhatsNew';
import { shouldAutoShowWhatsNew } from './whatsNewSeen';
import { useFlag } from './flags';
import { BankPage } from './pages/BankPage';
import { DevPage } from './pages/DevPage';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { useRoute } from './router';
import { t } from '../i18n';

export function App() {
  const route = useRoute();
  const loaded = useGame((s) => s.state !== null);
  const workerError = useGame((s) => s.workerError);
  const dismissError = useGame((s) => s.dismissError);
  const devTools = useFlag('devTools');
  const [menuOpen, setMenuOpen] = useState(false);
  const [whatsNew, setWhatsNew] = useState(shouldAutoShowWhatsNew);

  let page;
  switch (route) {
    case 'bank':
      page = <BankPage />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    case 'dev':
      page = devTools ? <DevPage /> : <HomePage onWhatsNew={() => setWhatsNew(true)} />;
      break;
    default:
      page = <HomePage onWhatsNew={() => setWhatsNew(true)} />;
  }

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
          {loaded ? page : <div className="loading">{t('app.title')}…</div>}
        </main>
      </div>
      <CatchUpOverlay />
      <AwayModal />
      {whatsNew && <WhatsNewModal onClose={() => setWhatsNew(false)} />}
    </div>
  );
}
