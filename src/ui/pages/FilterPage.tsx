import { useState } from 'react';
import { CONTENT } from '../../engine/content';
import type { BaseClass, ItemCategory } from '../../engine/content/types';
import type { Rarity } from '../../engine/items/types';
import type { FilterAction, FilterRule, GameState } from '../../engine/state';
import { t, tDynamic } from '../../i18n';
import { command, useGame } from '../bridge';
import { toast } from '../toasts';

type Draft = Omit<FilterRule, 'id'>;

const RARITIES: Rarity[] = ['normal', 'magic', 'rare', 'unique'];
const CLASSES = [...new Set(CONTENT.bases.all().map((b) => b.class))] as BaseClass[];
const CATEGORIES = [...new Set(CONTENT.items.all().map((i) => i.category))] as ItemCategory[];
const ACTIONS: FilterAction[] = ['keep', 'sell', 'disenchant', 'ignore'];
const GROUPS = [
  ...new Set(
    CONTENT.affixes
      .all()
      .filter((a) => a.kind !== 'ashen')
      .map((a) => a.group),
  ),
];

export function FilterPage() {
  const saved = useGame((s) => (s.state as GameState).lootFilter.rules);
  const [draft, setDraft] = useState<Draft[]>(() => saved.map(({ id: _id, ...r }) => r));
  const [dirty, setDirty] = useState(false);

  const update = (i: number, patch: Partial<Draft>) => {
    setDraft((d) => d.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const preset = async (p: 'keepAll' | 'earlyGame' | 'raresOnly') => {
    if (await command({ type: 'applyFilterPreset', preset: p })) {
      const rules = useGame.getState().state!.lootFilter.rules;
      setDraft(rules.map(({ id: _id, ...r }) => r));
      setDirty(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">{t('filter.title')}</h1>
      <p className="dim">{t('filter.intro')}</p>
      <div className="row">
        <span className="small faint">{t('filter.presets')}</span>
        {(['keepAll', 'earlyGame', 'raresOnly'] as const).map((p) => (
          <button key={p} className="btn btn-small" onClick={() => void preset(p)}>
            {t(`filter.preset.${p}`)}
          </button>
        ))}
      </div>

      {draft.length === 0 && <p className="faint">{t('filter.noRules')}</p>}
      <div className="filter-rules">
        {draft.map((r, i) => (
          <div key={i} className="panel filter-rule">
            <div className="row">
              <label className="toggle small">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => update(i, { enabled: e.target.checked })}
                />
                {t('filter.enabled')}
              </label>
              <label className="row small">
                {t('filter.target')}
                <select
                  className="input"
                  value={r.target}
                  onChange={(e) => update(i, { target: e.target.value as Draft['target'] })}
                >
                  <option value="gear">{t('filter.target.gear')}</option>
                  <option value="material">{t('filter.target.material')}</option>
                </select>
              </label>
              {r.target === 'gear' ? (
                <>
                  <label className="row small">
                    {t('filter.rarities')}
                    <select
                      className="input"
                      value={r.rarities?.[0] ?? ''}
                      onChange={(e) =>
                        update(i, {
                          rarities: e.target.value ? [e.target.value as Rarity] : undefined,
                        })
                      }
                    >
                      <option value="">{t('filter.any')}</option>
                      {RARITIES.map((x) => (
                        <option key={x} value={x}>
                          {t(`item.rarity.${x}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="row small">
                    {t('filter.class')}
                    <select
                      className="input"
                      value={r.classes?.[0] ?? ''}
                      onChange={(e) =>
                        update(i, {
                          classes: e.target.value ? [e.target.value as BaseClass] : undefined,
                        })
                      }
                    >
                      <option value="">{t('filter.any')}</option>
                      {CLASSES.map((c) => (
                        <option key={c} value={c}>
                          {tDynamic(`baseclass.${c}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="row small">
                    {t('filter.minIlvl')}
                    <input
                      className="input input-num"
                      type="number"
                      min={0}
                      value={r.minIlvl ?? ''}
                      onChange={(e) =>
                        update(i, { minIlvl: e.target.value ? Number(e.target.value) : undefined })
                      }
                    />
                  </label>
                  <label className="row small">
                    {t('filter.hasAffix')}
                    <select
                      className="input"
                      value={r.hasAffix ?? ''}
                      onChange={(e) => update(i, { hasAffix: e.target.value || undefined })}
                    >
                      <option value="">{t('filter.any')}</option>
                      {GROUPS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <label className="row small">
                  {t('filter.category')}
                  <select
                    className="input"
                    value={r.categories?.[0] ?? ''}
                    onChange={(e) =>
                      update(i, {
                        categories: e.target.value ? [e.target.value as ItemCategory] : undefined,
                      })
                    }
                  >
                    <option value="">{t('filter.any')}</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {tDynamic(`category.${c}`)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="row small">
                {t('filter.tiers')}
                <input
                  className="input input-num"
                  type="number"
                  min={1}
                  max={10}
                  placeholder="min"
                  value={r.minTier ?? ''}
                  onChange={(e) =>
                    update(i, { minTier: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
                –
                <input
                  className="input input-num"
                  type="number"
                  min={1}
                  max={10}
                  placeholder="max"
                  value={r.maxTier ?? ''}
                  onChange={(e) =>
                    update(i, { maxTier: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </label>
              <label className="row small">
                {t('filter.action')}
                <select
                  className="input"
                  value={r.action}
                  onChange={(e) => update(i, { action: e.target.value as FilterAction })}
                >
                  {ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {t(`filter.action.${a}`)}
                    </option>
                  ))}
                </select>
              </label>
              {i > 0 && (
                <button
                  className="btn btn-small"
                  onClick={() => {
                    setDraft((d) => {
                      const next = [...d];
                      [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                      return next;
                    });
                    setDirty(true);
                  }}
                >
                  {t('filter.up')}
                </button>
              )}
              <button
                className="btn btn-small btn-danger"
                onClick={() => {
                  setDraft((d) => d.filter((_, j) => j !== i));
                  setDirty(true);
                }}
              >
                {t('filter.remove')}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="row">
        <button
          className="btn"
          onClick={() => {
            setDraft((d) => [
              ...d,
              { enabled: true, target: 'gear', rarities: ['normal'], action: 'disenchant' },
            ]);
            setDirty(true);
          }}
        >
          {t('filter.addRule')}
        </button>
        <button
          className="btn btn-primary"
          disabled={!dirty}
          onClick={async () => {
            if (await command({ type: 'setFilterRules', rules: draft })) {
              setDirty(false);
              toast(t('filter.saved'), 'success');
            }
          }}
        >
          {t('filter.save')}
        </button>
      </div>
    </div>
  );
}
