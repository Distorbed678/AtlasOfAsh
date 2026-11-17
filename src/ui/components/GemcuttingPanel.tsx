import { useState } from 'react';
import { CONTENT } from '../../engine/content';
import { CUT_LEVEL, uncutKind, uncutTier } from '../../engine/gems/gems';
import { skillLevel } from '../../engine/skills/actions';
import type { GameState } from '../../engine/state';
import { nameOf, t } from '../../i18n';
import { command, useGame } from '../bridge';
import { gemIcon, gemLines, gemTags } from '../gemText';
import { href } from '../router';
import { toast } from '../toasts';
import { Icon } from './Icon';

/** Choose an uncut gem, then the gem to cut it into. */
export function GemcuttingPanel() {
  const state = useGame((s) => s.state) as GameState;
  const level = skillLevel(state, 'skill.gemcutting');
  const uncut = Object.entries(state.bank.items)
    .filter(([id, q]) => uncutKind(id) && q > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  const [picked, setPicked] = useState<string | null>(null);
  const itemId = picked && (state.bank.items[picked] ?? 0) > 0 ? picked : (uncut[0]?.[0] ?? null);
  const owned = (gemId: string) => state.gems.filter((g) => g.gemId === gemId).length;

  const kind = itemId ? uncutKind(itemId)! : null;
  const tier = itemId ? uncutTier(itemId) : 0;
  const options = kind ? CONTENT.gems.all().filter((g) => g.kind === kind && g.tier <= tier) : [];

  return (
    <section className="panel panel-wide">
      <h2 className="section-title">{t('gemcut.title')}</h2>
      <p className="dim small">
        {t('gemcut.intro')} {t('gemcut.ops')} <a href={href({ page: 'gems' })}>{t('nav.gems')}</a>
      </p>
      {uncut.length === 0 ? (
        <p className="faint">{t('gemcut.none')}</p>
      ) : (
        <>
          <div className="row-wrap">
            {uncut.map(([id, q]) => (
              <button
                key={id}
                className={`btn btn-small${id === itemId ? ' btn-primary' : ''}`}
                onClick={() => setPicked(id)}
              >
                {q}× {nameOf(id)}
              </button>
            ))}
          </div>
          <div className="card-grid">
            {options.map((g) => {
              const need = CUT_LEVEL[g.tier - 1] ?? 1;
              return (
                <div key={g.id} className={`card gem-card gem-${g.kind}`}>
                  <div className="card-head">
                    <div className="card-title">
                      <Icon name={gemIcon(g)} size={20} className="inline-icon" /> {nameOf(g.id)}
                    </div>
                    {owned(g.id) > 0 && (
                      <span className="tag">{t('gemcut.owned', { n: owned(g.id) })}</span>
                    )}
                  </div>
                  <div className="small dim">
                    {t('gem.tier', { n: g.tier })} · {gemTags(g)}
                  </div>
                  {level < need && (
                    <div className="bad small">{t('gemcut.locked', { n: need })}</div>
                  )}
                  <ul className="gem-lines small">
                    {gemLines(g, 1).map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                  <button
                    className="btn btn-primary"
                    disabled={level < need}
                    onClick={async () => {
                      if (await command({ type: 'cutGem', itemId: itemId!, gemId: g.id }))
                        toast(t('gemcut.done', { name: nameOf(g.id) }), 'success');
                    }}
                  >
                    {t('gemcut.cut')}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
