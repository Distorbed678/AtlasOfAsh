import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { FLAG_DEFS, type FlagName } from '../../shared/flags';
import { MAX_BACKUPS } from '../../engine/save/saveManager';
import type { BackupInfo } from '../../worker/protocol';
import { request } from '../bridge';
import { downloadDebugBundle } from '../debugBundle';
import { useFlags } from '../flags';

export function SettingsPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [backups, setBackups] = useState<BackupInfo[]>([]);

  const refreshBackups = () =>
    void request<BackupInfo[]>({ type: 'listBackups' })
      .then(setBackups)
      .catch(() => {});
  useEffect(refreshBackups, []);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) setStatus(done);
    } catch (err) {
      setStatus(t('error.generic', { message: err instanceof Error ? err.message : String(err) }));
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">{t('settings.title')}</h1>
      {status && (
        <div className="notice" role="status">
          {status}
        </div>
      )}

      <section className="panel">
        <h2 className="section-title">{t('settings.save')}</h2>
        <div className="row">
          <button
            className="btn"
            onClick={() => void run(() => request({ type: 'saveNow' }), t('settings.saved'))}
          >
            {t('settings.saveNow')}
          </button>
          <button
            className="btn"
            onClick={() =>
              void run(async () => {
                setExported(await request<string>({ type: 'exportSave' }));
                setCopied(false);
              })
            }
          >
            {t('settings.export')}
          </button>
        </div>
        {exported && (
          <div className="stack">
            <p className="dim small">{t('settings.exportHelp')}</p>
            <textarea
              className="textarea"
              readOnly
              rows={4}
              value={exported}
              onFocus={(e) => e.target.select()}
            />
            <button
              className="btn"
              onClick={() =>
                void navigator.clipboard.writeText(exported).then(
                  () => setCopied(true),
                  () => {},
                )
              }
            >
              {copied ? t('settings.copied') : t('settings.copy')}
            </button>
          </div>
        )}

        <h3 className="sub-title">{t('settings.import')}</h3>
        <p className="dim small">{t('settings.importHelp')}</p>
        <textarea
          className="textarea"
          rows={3}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="AOA1.…"
        />
        <button
          className="btn"
          disabled={!importText.trim()}
          onClick={() => {
            if (!window.confirm(t('settings.importConfirm'))) return;
            void run(async () => {
              await request({ type: 'importSave', data: importText });
              setImportText('');
              refreshBackups();
            }, t('settings.importDone'));
          }}
        >
          {t('settings.importButton')}
        </button>
      </section>

      <section className="panel">
        <h2 className="section-title">{t('settings.backups')}</h2>
        <p className="dim small">{t('settings.backupsHelp', { n: MAX_BACKUPS })}</p>
        {backups.length === 0 ? (
          <p className="dim">{t('settings.noBackups')}</p>
        ) : (
          <ul className="list">
            {backups.map((b) => {
              const date = new Date(b.savedAt).toLocaleString();
              return (
                <li key={b.key} className="list-row">
                  <span>{date}</span>
                  <button
                    className="btn btn-small"
                    onClick={() => {
                      if (!window.confirm(t('settings.restoreConfirm', { date }))) return;
                      void run(
                        () => request({ type: 'restoreBackup', key: b.key }),
                        t('settings.importDone'),
                      );
                    }}
                  >
                    {t('settings.restore')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2 className="section-title">{t('settings.debug')}</h2>
        <p className="dim small">{t('settings.debugHelp')}</p>
        <button className="btn" onClick={() => void run(() => downloadDebugBundle())}>
          {t('settings.debugButton')}
        </button>
      </section>

      <FlagsPanel />

      <section className="panel panel-danger">
        <h2 className="section-title">{t('settings.danger')}</h2>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (!window.confirm(t('settings.resetConfirm'))) return;
            void run(async () => {
              await request({ type: 'reset' });
              refreshBackups();
            });
          }}
        >
          {t('settings.reset')}
        </button>
      </section>
    </div>
  );
}

function FlagsPanel() {
  const { flags, setFlag } = useFlags();
  return (
    <section className="panel">
      <h2 className="section-title">{t('settings.flags')}</h2>
      <ul className="list">
        {(Object.keys(FLAG_DEFS) as FlagName[]).map((name) => (
          <li key={name} className="list-row">
            <label className="toggle">
              <input
                type="checkbox"
                checked={flags[name]}
                onChange={(e) => setFlag(name, e.target.checked)}
              />
              <span>
                <code>{name}</code>{' '}
                <span className="dim small">— {FLAG_DEFS[name].description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
