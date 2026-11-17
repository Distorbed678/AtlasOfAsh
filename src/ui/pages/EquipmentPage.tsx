import { useState } from 'react';
import { CONTENT } from '../../engine/content';
import { EQUIP_SLOTS, type EquipSlot } from '../../engine/content/types';
import { equipProblem, sheetFor, slotsFor } from '../../engine/items/equipment';
import type { GameState } from '../../engine/state';
import { t } from '../../i18n';
import { command, useGame } from '../bridge';
import { Icon } from '../components/Icon';
import { ItemTooltip } from '../components/ItemTooltip';
import { baseIcon, itemName } from '../items';
import { href } from '../router';

export function EquipmentPage() {
  const state = useGame((s) => s.state) as GameState;
  const [slot, setSlot] = useState<EquipSlot>('mainHand');
  const sheet = sheetFor(state);
  const attrs = { str: sheet.str.total, dex: sheet.dex.total, int: sheet.int.total };
  const equipped = state.equipment[slot];
  const fitting = state.stash.tabs
    .flatMap((tab) => tab.items)
    .filter((i) => slotsFor(CONTENT.bases.get(i.baseId)).includes(slot));

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{t('equip.title')}</h1>
        <span className="tag">
          {t('equip.attrs', {
            str: Math.floor(attrs.str),
            dex: Math.floor(attrs.dex),
            int: Math.floor(attrs.int),
          })}
        </span>
        <a className="btn btn-small" href={href({ page: 'codex' })}>
          {t('nav.codex')}
        </a>
      </div>
      <p className="dim">{t('equip.intro')}</p>

      <div className="bank-layout">
        <div className="slot-grid">
          {EQUIP_SLOTS.map((s) => {
            const item = state.equipment[s];
            return (
              <button
                key={s}
                className={`slot-tile${s === slot ? ' selected' : ''}${item ? ` rarity-${item.rarity}` : ''}`}
                onClick={() => setSlot(s)}
              >
                <span className="slot-label">{t(`slot.${s}`)}</span>
                {item ? (
                  <span className="slot-item">
                    <Icon
                      name={baseIcon(item)}
                      size={22}
                      className={`rarity-icon-${item.rarity}`}
                    />
                    <span>{itemName(item)}</span>
                  </span>
                ) : (
                  <span className="faint">{t('equip.empty')}</span>
                )}
              </button>
            );
          })}
        </div>
        <aside className="item-detail stack">
          {equipped ? (
            <>
              <ItemTooltip item={equipped} attributes={attrs} level={sheet.level} />
              <button className="btn" onClick={() => void command({ type: 'unequip', slot })}>
                {t('equip.unequip')}
              </button>
            </>
          ) : (
            <div className="panel">
              <h2 className="section-title">{t('equip.fits')}</h2>
              {fitting.length === 0 ? (
                <p className="dim">{t('equip.noneFit')}</p>
              ) : (
                <ul className="list">
                  {fitting.map((i) => {
                    const problem = equipProblem(state, i, slot);
                    return (
                      <li key={i.uid} className="list-row">
                        <span className={`rarity-text-${i.rarity}`}>{itemName(i)}</span>
                        <button
                          className="btn btn-small"
                          disabled={!!problem}
                          title={problem ?? undefined}
                          onClick={() => void command({ type: 'equip', uid: i.uid, slot })}
                        >
                          {t('stash.equip')}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
