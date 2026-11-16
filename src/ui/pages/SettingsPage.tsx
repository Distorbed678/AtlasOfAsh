import { useEffect, useState } from 'react';
import { MAX_BACKUPS } from '../../engine/save/saveManager';
import { t } from '../../i18n';
import { FLAG_DEFS, type FlagName } from '../../shared/flags';
import type { BackupInfo } from '../../worker/protocol';
import { request, useGameState } from '../bridge';
import { downloadDebugBundle } from '../debugBundle';
import { useFlags } from '../flags';
import { href } from '../router';
import { toast } from '../toasts';

export function SettingsPage() {
  const character = useGameState((s) => s.character);
  const [exported, setExported] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);

  const refreshBackups = () =>
    void request<BackupInfo[]>({ type: 'listBackups' })
      .then(setBackups)
      .catch(() => {});
  useEffect(refreshBackups, []);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) toast(done, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">{t('settings.title')}</h1>

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
                        t('settings.restored'),
                      ).then(refreshBackups);
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

      <section className="panel">
        <h2 className="section-title">{t('nav.credits')}</h2>
        <a className="btn" href={href({ page: 'credits' })}>
          {t('credits.title')}
        </a>
      </section>

      <FlagsPanel />

      <section className="panel panel-danger">
        <h2 className="section-title">{t('settings.danger')}</h2>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (!window.confirm(t('select.deleteConfirm', { name: character.name }))) return;
            void run(() => request({ type: 'deleteCharacter', id: character.id }));
          }}
        >
          {t('settings.delete')}
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
