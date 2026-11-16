import { useState } from 'react';
import { CONTENT } from '../../engine/content';
import type { EquipSlot } from '../../engine/content/types';
import { dustYield, gearSellPrice } from '../../engine/items/enchanting';
import { equipProblem, sheetFor, slotsFor } from '../../engine/items/equipment';
import { MAX_STASH_TABS, nextTabCost } from '../../engine/items/stash';
import type { ItemInstance } from '../../engine/items/types';
import { STASH_TAB_SIZE, type GameState } from '../../engine/state';
import { t } from '../../i18n';
import { formatNumber } from '../../shared/format';
import { command, useGame } from '../bridge';
import { Icon } from '../components/Icon';
import { ItemTooltip } from '../components/ItemTooltip';
import { baseIcon, itemName, useSelection } from '../items';
import { href } from '../router';

export function StashPage() {
  const state = useGame((s) => s.state) as GameState;
  const [tabId, setTabId] = useState(0);
  const selected = useSelection((s) => s.itemUid);
  const select = useSelection((s) => s.select);
  const tab = state.stash.tabs.find((tb) => tb.id === tabId) ?? state.stash.tabs[0]!;
  const cost = nextTabCost(state);
  const item = tab.items.find((i) => i.uid === selected) ?? null;
  const normals = tab.items.filter((i) => i.rarity === 'normal');

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{t('stash.title')}</h1>
      </div>
      <p className="dim">{t('stash.intro')}</p>

      <div className="tabs" role="tablist">
        {state.stash.tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tb.id === tab.id}
            className={`tab${tb.id === tab.id ? ' active' : ''}`}
            onClick={() => setTabId(tb.id)}
          >
            {tb.name}{' '}
            <span className="faint small">
              {t('stash.count', { n: tb.items.length, cap: STASH_TAB_SIZE })}
            </span>
          </button>
        ))}
        {state.stash.tabs.length < MAX_STASH_TABS && cost !== null ? (
          <button
            className="tab tab-add"
            disabled={state.gold < cost}
            onClick={() => void command({ type: 'buyStashTab' })}
          >
            {t('stash.buyTab', { gold: formatNumber(cost) })}
          </button>
        ) : (
          <span className="faint small">{t('stash.maxTabs')}</span>
        )}
        <span className="tab-tools">
          <button
            className="btn btn-small"
            onClick={() => {
              const name = window.prompt(t('stash.renamePrompt'), tab.name);
              if (name) void command({ type: 'renameStashTab', tabId: tab.id, name });
            }}
          >
            {t('stash.renameTab')}
          </button>
          {normals.length > 0 && (
            <button
              className="btn btn-small"
              onClick={() => {
                if (window.confirm(t('stash.bulkConfirm', { n: normals.length })))
                  void command({ type: 'disenchant', uids: normals.map((i) => i.uid) });
              }}
            >
              {t('stash.bulkDisenchant')}
            </button>
          )}
        </span>
      </div>

      <div className="bank-layout">
        <div className="gear-grid">
          {tab.items.length === 0 && <p className="dim">{t('stash.empty')}</p>}
          {tab.items.map((i) => (
            <button
              key={i.uid}
              className={`gear-tile rarity-${i.rarity}${selected === i.uid ? ' selected' : ''}${i.ashen ? ' tt-ashen' : ''}`}
              onClick={() => select(i.uid)}
              title={itemName(i)}
            >
              <Icon name={baseIcon(i)} size={30} className={`rarity-icon-${i.rarity}`} />
              <span className="gear-tile-name">{itemName(i)}</span>
              <span className="gear-tile-ilvl">{i.ilvl}</span>
            </button>
          ))}
        </div>
        <aside className="item-detail">
          {item ? (
            <StashActions item={item} state={state} tabId={tab.id} />
          ) : (
            <p className="panel dim">{t('stash.select')}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function StashActions({
  item,
  state,
  tabId,
}: {
  item: ItemInstance;
  state: GameState;
  tabId: number;
}) {
  const base = CONTENT.bases.get(item.baseId);
  const sheet = sheetFor(state);
  const attrs = { str: sheet.str.total, dex: sheet.dex.total, int: sheet.int.total };
  const slots = slotsFor(base);
  const select = useSelection((s) => s.select);

  return (
    <div className="stack">
      <ItemTooltip item={item} attributes={attrs} />
      <div className="panel">
        {slots.map((slot: EquipSlot) => {
          const problem = equipProblem(state, item, slot);
          return (
            <div key={slot} className="stack">
              <button
                className="btn btn-primary"
                disabled={!!problem}
                onClick={() => void command({ type: 'equip', uid: item.uid, slot })}
              >
                {slots.length > 1
                  ? t('stash.equipTo', { slot: t(`slot.${slot}`) })
                  : t('stash.equip')}
              </button>
              {problem && <span className="bad small">{problem}</span>}
            </div>
          );
        })}
        <div className="row">
          {!item.ashen && (
            <a
              className="btn"
              href={href({ page: 'skill', skillId: 'skill.enchanting' })}
              onClick={() => select(item.uid)}
            >
              {t('stash.enchant')}
            </a>
          )}
          <button
            className="btn"
            onClick={() => {
              select(null);
              void command({ type: 'sellGear', uids: [item.uid] });
            }}
          >
            {t('stash.sell', { gold: formatNumber(gearSellPrice(item)) })}
          </button>
          <button
            className="btn"
            onClick={() => {
              select(null);
              void command({ type: 'disenchant', uids: [item.uid] });
            }}
          >
            {t('stash.disenchant', { n: dustYield(item) })}
          </button>
        </div>
        {state.stash.tabs.length > 1 && (
          <label className="row small">
            {t('stash.moveTo')}
            <select
              className="input"
              value={tabId}
              onChange={(e) =>
                void command({ type: 'moveGear', uid: item.uid, tabId: Number(e.target.value) })
              }
            >
              {state.stash.tabs.map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {tb.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
