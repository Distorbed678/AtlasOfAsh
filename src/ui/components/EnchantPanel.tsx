import { useState } from 'react';
import { INFUSIONS } from '../../engine/content/materials';
import { enchantProblem, ENCHANT_OPS, opSpec, type EnchantOp } from '../../engine/items/enchanting';
import { findItem } from '../../engine/items/stash';
import type { ItemInstance } from '../../engine/items/types';
import { skillLevel } from '../../engine/skills/actions';
import type { GameState } from '../../engine/state';
import { nameOf, t } from '../../i18n';
import { command, useGame } from '../bridge';
import { itemName, useSelection } from '../items';
import { toast } from '../toasts';
import { ItemTooltip } from './ItemTooltip';

const OPS: EnchantOp[] = [
  'transmute',
  'augment',
  'upgrade',
  'reroll',
  'rerollValues',
  'remove',
  'rerollKeepPrefixes',
  'rerollKeepSuffixes',
  'infuse',
  'brand',
];

/** Pick an item and apply Enchanting operations to it. */
export function EnchantPanel() {
  const state = useGame((s) => s.state) as GameState;
  const uid = useSelection((s) => s.itemUid);
  const select = useSelection((s) => s.select);
  const [infusionId, setInfusionId] = useState(INFUSIONS[0]!.id);
  const level = skillLevel(state, 'skill.enchanting');

  const stashItems = state.stash.tabs.flatMap((tab) => tab.items);
  const equipped = Object.values(state.equipment).filter((i): i is ItemInstance => !!i);
  const loc = uid !== null ? findItem(state, uid) : null;
  const item = loc?.item ?? null;

  const apply = async (op: EnchantOp) => {
    if (!item) return;
    if (op === 'brand' && !window.confirm(t('enchant.brandConfirm'))) return;
    const ok = await command({
      type: 'enchant',
      uid: item.uid,
      op,
      infusionId: op === 'infuse' ? infusionId : undefined,
    });
    const outcome = useGame.getState().state?.lastEnchant?.outcome;
    if (ok && op === 'brand' && outcome) {
      toast(
        t(`enchant.brand.${outcome as 'nothing'}`),
        outcome === 'brick' ? 'error' : 'success',
        6000,
      );
    }
  };

  return (
    <section className="panel panel-wide">
      <h2 className="section-title">{t('enchant.title')}</h2>
      {stashItems.length + equipped.length === 0 ? (
        <p className="dim">{t('enchant.none')}</p>
      ) : (
        <>
          <label className="field">
            <span className="field-label">{t('enchant.pick')}</span>
            <select
              className="input"
              value={uid ?? ''}
              onChange={(e) => select(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">—</option>
              {equipped.length > 0 && (
                <optgroup label={t('enchant.equipped')}>
                  {equipped.map((i) => (
                    <option key={i.uid} value={i.uid}>
                      {itemName(i)} ({t(`item.rarity.${i.rarity}`)})
                    </option>
                  ))}
                </optgroup>
              )}
              {state.stash.tabs.map((tab) => (
                <optgroup key={tab.id} label={tab.name}>
                  {tab.items.map((i) => (
                    <option key={i.uid} value={i.uid}>
                      {itemName(i)} ({t(`item.rarity.${i.rarity}`)})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {item && (
            <div className="enchant-layout">
              <ItemTooltip item={item} />
              <ul className="list enchant-ops">
                {OPS.map((op) => {
                  const spec = op === 'infuse' ? opSpec(op, infusionId) : ENCHANT_OPS[op];
                  const locked = level < spec.level;
                  const problem = enchantProblem(
                    item,
                    op,
                    op === 'infuse' ? infusionId : undefined,
                  );
                  const missing = Object.entries(spec.reagents).some(
                    ([id, q]) => (state.bank.items[id] ?? 0) < q,
                  );
                  return (
                    <li key={op} className="list-row enchant-op">
                      <div className="stack">
                        <strong>{t(`enchant.op.${op}`)}</strong>
                        <span className="small dim">
                          {Object.entries(spec.reagents)
                            .map(([id, q]) => `${q}× ${nameOf(id)} (${state.bank.items[id] ?? 0})`)
                            .join(' + ')}
                        </span>
                        {op === 'infuse' && (
                          <select
                            className="input"
                            value={infusionId}
                            onChange={(e) => setInfusionId(e.target.value)}
                          >
                            {INFUSIONS.map((inf) => (
                              <option key={inf.id} value={inf.id}>
                                {nameOf(inf.id)}
                              </option>
                            ))}
                          </select>
                        )}
                        {locked ? (
                          <span className="small bad">
                            {t('enchant.requires', { n: spec.level })}
                          </span>
                        ) : (
                          problem && <span className="small faint">{problem}</span>
                        )}
                      </div>
                      <button
                        className={`btn btn-small${op === 'brand' ? ' btn-danger' : ''}`}
                        disabled={locked || !!problem || missing}
                        onClick={() => void apply(op)}
                      >
                        {t('enchant.apply')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
