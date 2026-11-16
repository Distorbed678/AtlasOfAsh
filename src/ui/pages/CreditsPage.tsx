import { t } from '../../i18n';
import { Icon } from '../components/Icon';
import { ICON_DATA } from '../iconData';

export function CreditsPage() {
  const byAuthor = new Map<string, string[]>();
  for (const [key, icon] of Object.entries(ICON_DATA)) {
    byAuthor.set(icon.author, [...(byAuthor.get(icon.author) ?? []), key]);
  }
  return (
    <div className="page">
      <h1 className="page-title">{t('credits.title')}</h1>
      <section className="panel panel-wide">
        <h2 className="section-title">{t('credits.icons')}</h2>
        <p className="dim">
          {t('credits.iconsBody')}{' '}
          <a href="https://game-icons.net" target="_blank" rel="noreferrer">
            game-icons.net
          </a>{' '}
          ·{' '}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
            CC BY 3.0
          </a>
        </p>
        {[...byAuthor].map(([author, keys]) => (
          <div key={author} className="credit-row">
            <div className="credit-author">{author}</div>
            <div className="credit-icons">
              {keys.map((k) => (
                <span key={k} className="credit-icon" title={ICON_DATA[k]!.name}>
                  <Icon name={k} size={22} />
                  <span className="faint small">{ICON_DATA[k]!.name}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
