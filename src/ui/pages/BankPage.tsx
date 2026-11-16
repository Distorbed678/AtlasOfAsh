import { useMemo, useState } from 'react';
import { CONTENT } from '../../engine/content';
import { bankCapacity, bankSlotsUsed } from '../../engine/economy/bank';
import { nameOf, t, tDynamic } from '../../i18n';
import { formatNumber } from '../../shared/format';
import { command, useGameState } from '../bridge';
import { Num } from '../components/Num';

type SortKey = 'name' | 'qty' | 'value' | 'category';

export function BankPage() {
  const bank = useGameState((s) => s.bank);
  const used = useGameState((s) => bankSlotsUsed(s));
  const cap = useGameState((s) => bankCapacity(s));
  const [tabId, setTabId] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('category');
  const [selected, setSelected] = useState<string | null>(null);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Object.entries(bank.items)
      .filter(([id]) => (bank.tabOf[id] ?? 0) === tabId || q !== '')
      .filter(([id]) => !q || nameOf(id).toLowerCase().includes(q))
      .map(([id, qty]) => ({ id, qty, def: CONTENT.items.tryGet(id) }));
    const cmp: Record<SortKey, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      name: (a, b) => nameOf(a.id).localeCompare(nameOf(b.id)),
      qty: (a, b) => b.qty - a.qty,
      value: (a, b) => b.qty * (b.def?.sellPrice ?? 0) - a.qty * (a.def?.sellPrice ?? 0),
      category: (a, b) =>
        (a.def?.category ?? '').localeCompare(b.def?.category ?? '') ||
        (a.def?.tier ?? 0) - (b.def?.tier ?? 0),
    };
    return list.sort(cmp[sort]);
  }, [bank, tabId, query, sort]);

  const activeTab = bank.tabs.find((tb) => tb.id === tabId) ?? bank.tabs[0]!;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{t('bank.title')}</h1>
        <span className={`tag${used >= cap ? ' tag-bad' : ''}`}>
          {t('bank.slots', { used, cap })}
        </span>
      </div>
      {used >= cap && <div className="notice notice-error">{t('bank.fullWarning')}</div>}

      <div className="tabs" role="tablist">
        {bank.tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tb.id === tabId}
            className={`tab${tb.id === tabId ? ' active' : ''}`}
            onClick={() => setTabId(tb.id)}
          >
            {tb.name}
          </button>
        ))}
        <button
          className="tab tab-add"
          onClick={() => {
            const name = window.prompt(t('bank.newTabPrompt'));
            if (name) void command({ type: 'createTab', name });
          }}
        >
          {t('bank.newTab')}
        </button>
        {activeTab.id !== 0 && (
          <span className="tab-tools">
            <button
              className="btn btn-small"
              onClick={() => {
                const name = window.prompt(t('bank.renamePrompt'), activeTab.name);
                if (name) void command({ type: 'renameTab', tabId: activeTab.id, name });
              }}
            >
              {t('bank.renameTab')}
            </button>
            <button
              className="btn btn-small btn-danger"
              onClick={() => {
                if (window.confirm(t('bank.deleteTabConfirm'))) {
                  void command({ type: 'deleteTab', tabId: activeTab.id });
                  setTabId(0);
                }
              }}
            >
              {t('bank.deleteTab')}
            </button>
          </span>
        )}
      </div>

      <div className="row">
        <input
          className="input grow"
          type="search"
          placeholder={t('bank.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          {(['category', 'name', 'qty', 'value'] as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {t(`bank.sort.${k}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="bank-layout">
        <div className="bank-grid">
          {entries.length === 0 && <p className="dim">{t('bank.empty')}</p>}
          {entries.map(({ id, qty }) => (
            <button
              key={id}
              className={`bank-item${selected === id ? ' selected' : ''}`}
              onClick={() => setSelected(id)}
            >
              <span className="bank-item-name">{nameOf(id)}</span>
              <Num value={qty} className="bank-item-qty" />
              {bank.locked.includes(id) && (
                <span className="bank-lock" aria-label="locked">
                  🔒
                </span>
              )}
            </button>
          ))}
        </div>
        <ItemDetail itemId={selected && bank.items[selected] ? selected : null} />
      </div>
    </div>
  );
}

function ItemDetail({ itemId }: { itemId: string | null }) {
  const qty = useGameState((s) => (itemId ? (s.bank.items[itemId] ?? 0) : 0));
  const locked = useGameState((s) => (itemId ? s.bank.locked.includes(itemId) : false));
  const tabs = useGameState((s) => s.bank.tabs);
  const tabOf = useGameState((s) => (itemId ? (s.bank.tabOf[itemId] ?? 0) : 0));
  const [amount, setAmount] = useState(1);

  if (!itemId) return <aside className="panel item-detail dim">{t('bank.select')}</aside>;
  const def = CONTENT.items.get(itemId);
  const sellQty = Math.min(Math.max(1, amount), qty);

  return (
    <aside className="panel item-detail">
      <h2 className="section-title">{nameOf(itemId)}</h2>
      <div className="dim small">
        {tDynamic(`category.${def.category}`)} · T{def.tier}
      </div>
      <div>{t('bank.owned', { qty: formatNumber(qty) })}</div>
      <div className="dim small">
        {t('bank.each', { gold: def.sellPrice })} ·{' '}
        {t('bank.total', { gold: formatNumber(def.sellPrice * qty) })}
      </div>

      {def.container && (
        <div className="row">
          <button
            className="btn btn-primary"
            onClick={() => void command({ type: 'openItem', itemId, qty: 1 })}
          >
            {t('bank.open')}
          </button>
          <button className="btn" onClick={() => void command({ type: 'openItem', itemId, qty })}>
            {t('bank.openAll')}
          </button>
        </div>
      )}

      <div className="divider" />
      {locked ? (
        <p className="faint small">{t('bank.lockedNote')}</p>
      ) : (
        <>
          <div className="row">
            {[1, 10, 100].map((n) => (
              <button key={n} className="btn btn-small" onClick={() => setAmount(n)}>
                {n}
              </button>
            ))}
            <button className="btn btn-small" onClick={() => setAmount(Math.max(1, qty - 1))}>
              {t('bank.sellAllButOne')}
            </button>
            <button className="btn btn-small" onClick={() => setAmount(qty)}>
              {t('bank.sellAll')}
            </button>
            <input
              className="input input-num"
              type="number"
              min={1}
              max={qty}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => void command({ type: 'sellItem', itemId, qty: sellQty })}
          >
            {t('bank.sellFor', {
              qty: formatNumber(sellQty),
              gold: formatNumber(sellQty * def.sellPrice),
            })}
          </button>
        </>
      )}

      <div className="divider" />
      <div className="row">
        <button
          className="btn btn-small"
          onClick={() => void command({ type: 'toggleLock', itemId })}
        >
          {locked ? t('bank.unlock') : t('bank.lock')}
        </button>
        <label className="row small">
          {t('bank.moveTo')}
          <select
            className="input"
            value={tabOf}
            onChange={(e) =>
              void command({ type: 'moveToTab', itemId, tabId: Number(e.target.value) })
            }
          >
            {tabs.map((tb) => (
              <option key={tb.id} value={tb.id}>
                {tb.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </aside>
  );
}
