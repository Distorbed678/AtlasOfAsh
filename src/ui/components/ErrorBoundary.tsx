import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../../i18n';
import { request } from '../bridge';
import { downloadDebugBundle } from '../debugBundle';

interface State {
  error: Error | null;
  exported: string | null;
}

/**
 * Crash-safe UI: if rendering throws, immediately save, then show an export
 * string and a debug bundle button so no progress is ever lost to a bug.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, exported: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI crash', error, info.componentStack);
    void request({ type: 'saveNow' })
      .then(() => request<string>({ type: 'exportSave' }))
      .then((exported) => this.setState({ exported }))
      .catch(() => {});
  }

  override render() {
    const { error, exported } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash">
        <h1>{t('crash.title')}</h1>
        <p>{t('crash.body')}</p>
        <pre className="crash-error">{error.message}</pre>
        <textarea className="textarea" readOnly value={exported ?? '…'} rows={5} />
        <div className="row">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            {t('crash.reload')}
          </button>
          <button
            className="btn"
            onClick={() => void downloadDebugBundle({ crash: error.message, stack: error.stack })}
          >
            {t('crash.debug')}
          </button>
        </div>
      </div>
    );
  }
}
