import changelogMd from '../../../CHANGELOG.md?raw';
import { t } from '../../i18n';
import { parseChangelog } from '../../shared/changelog';
import { Modal } from './Modal';

const RELEASES = parseChangelog(changelogMd);

export function WhatsNewModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title={t('whatsNew.title')}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          {t('whatsNew.close')}
        </button>
      }
    >
      {RELEASES.map((r) => (
        <section key={r.version} className="changelog-release">
          <h3>
            {r.version}
            {r.date && <span className="dim"> · {r.date}</span>}
          </h3>
          {r.sections.map((s) => (
            <div key={s.title}>
              <h4>{s.title}</h4>
              <ul>
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </Modal>
  );
}
