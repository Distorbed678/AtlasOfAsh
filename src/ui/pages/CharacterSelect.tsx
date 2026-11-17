import { useState } from 'react';
import { CONTENT } from '../../engine/content';
import { CHARACTER_MODES, type CharacterMode } from '../../engine/state';
import { nameOf, t, tDynamic } from '../../i18n';
import { formatDuration } from '../../shared/format';
import { request, useGame } from '../bridge';
import { navigate } from '../router';
import { toast } from '../toasts';

export function CharacterSelect() {
  const characters = useGame((s) => s.characters);
  const [creating, setCreating] = useState(characters.length === 0);
  const [importText, setImportText] = useState('');

  const play = (id: string) => {
    navigate({ page: 'overview' });
    void request({ type: 'selectCharacter', id }).catch((e: Error) => toast(e.message, 'error'));
  };

  return (
    <div className="select-screen">
      <h1 className="select-brand">{t('app.title')}</h1>
      {creating ? (
        <CreateCharacter onCancel={characters.length ? () => setCreating(false) : undefined} />
      ) : (
        <div className="select-panel">
          <h2 className="section-title">{t('select.title')}</h2>
          <ul className="char-list">
            {characters
              .filter((c) => !c.memorial)
              .map((c) => (
                <li key={c.id} className="char-card">
                  <div className="char-info">
                    <div className="char-name">{c.name}</div>
                    <div className="dim small">
                      {t('select.level', { n: c.level ?? 1 })} {nameOf(c.classId)} ·{' '}
                      {t(`mode.${c.mode}`)}
                      {c.fellInHardcore ? ` · ${t('select.fellInHardcore')}` : ''} ·{' '}
                      {t('select.totalLevel', { n: c.totalLevel })}
                    </div>
                    <div className="faint small">
                      {t('select.lastPlayed', { date: new Date(c.lastPlayed).toLocaleString() })}
                    </div>
                  </div>
                  <div className="row">
                    <button className="btn btn-primary" onClick={() => play(c.id)}>
                      {t('select.play')}
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => {
                        if (window.confirm(t('select.deleteConfirm', { name: c.name })))
                          void request({ type: 'deleteCharacter', id: c.id });
                      }}
                    >
                      {t('select.delete')}
                    </button>
                  </div>
                </li>
              ))}
          </ul>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            {t('select.new')}
          </button>
          {characters.some((c) => c.memorial) && (
            <div className="memorials">
              <h3 className="sub-title">{t('select.memorial')}</h3>
              <ul className="char-list">
                {characters
                  .filter((c) => c.memorial)
                  .map((c) => (
                    <li key={c.id} className="char-card memorial">
                      <div className="char-info">
                        <div className="char-name">{c.name}</div>
                        <div className="dim small">
                          {t('select.memorialLine', {
                            level: c.memorial!.level,
                            cls: nameOf(c.classId),
                            cause: nameOf(c.memorial!.cause),
                            time: formatDuration(c.memorial!.playedMs),
                          })}
                        </div>
                      </div>
                      <button
                        className="btn btn-small"
                        onClick={() => void request({ type: 'deleteCharacter', id: c.id })}
                      >
                        {t('select.delete')}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <details className="import-box">
            <summary className="dim small">{t('select.import')}</summary>
            <textarea
              className="textarea"
              rows={3}
              value={importText}
              placeholder="AOA1.…"
              onChange={(e) => setImportText(e.target.value)}
            />
            <button
              className="btn"
              disabled={!importText.trim()}
              onClick={() =>
                void request({ type: 'importSave', data: importText }).then(
                  () => {
                    setImportText('');
                    toast(t('settings.imported'), 'success');
                  },
                  (e: Error) => toast(e.message, 'error'),
                )
              }
            >
              {t('select.importButton')}
            </button>
          </details>
        </div>
      )}
    </div>
  );
}

function CreateCharacter({ onCancel }: { onCancel?: () => void }) {
  const classes = CONTENT.classes.all();
  const [name, setName] = useState('');
  const [classId, setClassId] = useState(classes[0]!.id);
  const [mode, setMode] = useState<CharacterMode>('standard');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await request<string>({
        type: 'createCharacter',
        character: { name, classId, mode },
      });
      navigate({ page: 'overview' });
      await request({ type: 'selectCharacter', id });
    } catch (e) {
      toast((e as Error).message, 'error');
      setBusy(false);
    }
  };

  return (
    <form
      className="select-panel"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2 className="section-title">{t('create.title')}</h2>

      <label className="field">
        <span className="field-label">{t('create.name')}</span>
        <input
          className="input"
          value={name}
          maxLength={24}
          placeholder={t('create.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </label>

      <fieldset className="field">
        <legend className="field-label">{t('create.class')}</legend>
        <div className="choice-grid">
          {classes.map((c) => (
            <label key={c.id} className={`choice${classId === c.id ? ' selected' : ''}`}>
              <input
                type="radio"
                name="class"
                value={c.id}
                checked={classId === c.id}
                onChange={() => setClassId(c.id)}
              />
              <span className="choice-title">{nameOf(c.id)}</span>
              <span className="choice-meta">
                {c.attributes.map((a) => tDynamic(`attr.${a}`)).join(' / ')} ·{' '}
                {c.weapons.map(nameOf).join(', ')}
              </span>
              <span className="choice-desc">{tDynamic(`${c.id}.desc`)}</span>
            </label>
          ))}
        </div>
        <p className="faint small">{t('create.classNote')}</p>
      </fieldset>

      <fieldset className="field">
        <legend className="field-label">{t('create.mode')}</legend>
        <div className="choice-grid choice-grid-3">
          {CHARACTER_MODES.map((m) => (
            <label key={m} className={`choice${mode === m ? ' selected' : ''}`}>
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
              />
              <span className="choice-title">{t(`mode.${m}`)}</span>
              <span className="choice-desc">{t(`mode.${m}.desc`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
          {t('create.submit')}
        </button>
        {onCancel && (
          <button className="btn" type="button" onClick={onCancel}>
            {t('create.cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
