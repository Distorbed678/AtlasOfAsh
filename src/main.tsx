import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { request, startGame } from './ui/bridge';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import './ui/styles/theme.css';
import './ui/styles/app.css';

startGame();

// Crash safety outside React rendering: save immediately on any uncaught error.
const saveNow = () => void request({ type: 'saveNow' }).catch(() => {});
window.addEventListener('error', saveNow);
window.addEventListener('unhandledrejection', saveNow);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
