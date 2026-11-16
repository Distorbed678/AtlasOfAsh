import { CONTENT } from '../../engine/content';
import type { BuildingDef, BuildingEffect } from '../../engine/content/types';
import { buildingTier } from '../../engine/economy/town';
import { nameOf, t, tDynamic } from '../../i18n';
import { formatNumber, formatPercent } from '../../shared/format';
import { command, useGameState } from '../bridge';
import { Icon } from '../components/Icon';

function effectText(effect: BuildingEffect, value: number): string {
  const v =
    effect === 'workerEfficiency' || effect === 'workerXpShare'
      ? formatPercent(value, 0)
      : String(value);
  return t(`town.effect.${effect}`, { value: v });
}

export function TownPage() {
  return (
    <div className="page">
      <h1 className="page-title">{t('town.title')}</h1>
      <p className="dim">{t('town.intro')}</p>
      <div className="card-grid card-grid-wide">
        {CONTENT.buildings.all().map((b) => (
          <BuildingCard key={b.id} def={b} />
        ))}
      </div>
    </div>
  );
}

function BuildingCard({ def }: { def: BuildingDef }) {
  const tier = useGameState((s) => buildingTier(s, def.id));
  const gold = useGameState((s) => s.gold);
  const bank = useGameState((s) => s.bank.items);
  const max = def.tiers.length;
  const cost = def.tiers[tier];
  const affordable =
    !!cost &&
    gold >= cost.gold &&
    Object.entries(cost.items).every(([id, q]) => (bank[id] ?? 0) >= q);

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <Icon name={def.id} size={22} className="inline-icon" /> {nameOf(def.id)}
        </div>
        <span className="tag">
          {tier === 0 ? t('town.unbuilt') : t('town.tier', { tier, max })}
        </span>
      </div>
      <p className="dim small">{tDynamic(`${def.id}.desc`)}</p>
      <div className="small">
        {t('town.current', { value: effectText(def.effect, def.values[tier]!) })}
      </div>
      {cost ? (
        <>
          <div className="small good">
            {t('town.next', { value: effectText(def.effect, def.values[tier + 1]!) })}
          </div>
          <div className="cost-list small">
            <div className="faint">{t('town.cost')}</div>
            <div className={gold >= cost.gold ? '' : 'bad'}>
              {formatNumber(cost.gold)} {t('topbar.gold').toLowerCase()}
            </div>
            {Object.entries(cost.items).map(([id, q]) => (
              <div key={id} className={(bank[id] ?? 0) >= q ? '' : 'bad'}>
                {formatNumber(bank[id] ?? 0)} / {formatNumber(q)} {nameOf(id)}
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            disabled={!affordable}
            onClick={() => void command({ type: 'upgradeBuilding', buildingId: def.id })}
          >
            {t('town.upgrade')}
          </button>
        </>
      ) : (
        <div className="good small">{t('town.maxed')}</div>
      )}
    </div>
  );
}
