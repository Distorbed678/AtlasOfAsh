import { CONTENT } from '../../engine/content';
import { flaskFor } from '../../engine/combat/flasks';
import { computeItem, itemLines } from '../../engine/items/itemStats';
import type { ItemInstance } from '../../engine/items/types';
import { nameOf, t, tDynamic } from '../../i18n';
import { baseIcon, itemName, tierLabel } from '../items';
import { displayLines } from '../modText';
import { Icon } from './Icon';

interface Props {
  item: ItemInstance;
  /** Current attributes, to colour unmet requirements. */
  attributes?: { str: number; dex: number; int: number };
  /** Current character level, to colour an unmet level requirement. */
  level?: number;
}

/** PoE-style item card: name by rarity, base properties, requirements, implicits and affixes. */
export function ItemTooltip({ item, attributes, level }: Props) {
  const base = CONTENT.bases.get(item.baseId);
  const c = computeItem(item, itemName(item));
  const lines = displayLines(itemLines(item));
  const implicit = lines.filter((l) => l.origin === 'implicit');
  const ashen = lines.filter((l) => l.origin === 'ashen');
  const unique = lines.filter((l) => l.origin === 'unique');
  const affixes = lines.filter((l) => l.origin === 'prefix' || l.origin === 'suffix');
  const mod = (k: Parameters<typeof c.modified.has>[0]) =>
    c.modified.has(k) ? ' tt-modified' : '';
  const reqs = (['str', 'dex', 'int'] as const).filter((a) => base.req[a] > 0);
  const flask = flaskFor(item);

  return (
    <div className={`tooltip rarity-${item.rarity}${item.ashen ? ' tt-ashen' : ''}`}>
      <div className="tt-head">
        <Icon name={baseIcon(item)} size={34} className={`tt-icon rarity-icon-${item.rarity}`} />
        <div>
          <div className="tt-name">{itemName(item)}</div>
          {(item.rarity === 'rare' || item.rarity === 'unique') && (
            <div className="tt-base">{nameOf(base.id)}</div>
          )}
        </div>
      </div>
      <div className="tt-meta">
        {t(`item.rarity.${item.rarity}`)} · {tDynamic(`baseclass.${base.class}`)}
        {base.defenceType ? ` · ${tDynamic(`defence.${base.defenceType}`)}` : ''} ·{' '}
        {t('item.ilvl', { n: item.ilvl })}
        {base.twoHanded ? ` · ${t('item.twoHanded')}` : ''}
      </div>

      <div className="tt-props">
        {c.weapon && (
          <>
            <div className={mod('phys')}>
              {t('item.physDamage', { a: c.weapon.physRange[0], b: c.weapon.physRange[1] })}
            </div>
            {(['fire', 'cold', 'lightning', 'chaos'] as const).map((type) =>
              c.weapon!.damage[type] ? (
                <div key={type} className={`tt-modified dmg-${type}`}>
                  {t('item.eleDamage', {
                    type: t(`dmg.${type}`),
                    a: c.weapon!.damage[type]!.min,
                    b: c.weapon!.damage[type]!.max,
                  })}
                </div>
              ) : null,
            )}
            <div className={mod('crit')}>{t('item.crit', { v: c.weapon.critChance })}</div>
            <div className={mod('aps')}>{t('item.aps', { v: c.weapon.attacksPerSecond })}</div>
          </>
        )}
        {c.armour > 0 && <div className={mod('armour')}>{t('item.armour', { v: c.armour })}</div>}
        {c.evasion > 0 && (
          <div className={mod('evasion')}>{t('item.evasion', { v: c.evasion })}</div>
        )}
        {c.energyShield > 0 && (
          <div className={mod('energyShield')}>{t('item.es', { v: c.energyShield })}</div>
        )}
        {c.block > 0 && <div>{t('item.block', { v: c.block })}</div>}
        {flask && (
          <>
            <div>
              {flask.kind === 'life' || flask.kind === 'mana'
                ? t('item.flask.recover', {
                    v: Math.round(flask.amount),
                    res: flask.kind === 'life' ? t('combat.life') : t('combat.mana'),
                    s: flask.durationMs / 1000,
                  })
                : tDynamic(`item.flask.${flask.kind}`, {
                    v: flask.amount,
                    s: flask.durationMs / 1000,
                  })}
            </div>
            <div className="dim">
              {t('item.flask.charges', { use: flask.chargesPerUse, max: flask.maxCharges })}
            </div>
          </>
        )}
      </div>

      {(reqs.length > 0 || base.levelReq > 1) && (
        <div className="tt-req">
          {t('item.requires')}{' '}
          {base.levelReq > 1 && (
            <span className={level !== undefined && level < base.levelReq ? 'bad' : ''}>
              {t('item.levelReq', { n: base.levelReq })}
              {reqs.length > 0 ? ', ' : ''}
            </span>
          )}
          {reqs.map((a, i) => (
            <span key={a} className={attributes && attributes[a] < base.req[a] ? 'bad' : ''}>
              {i > 0 ? ', ' : ''}
              {base.req[a]} {a.charAt(0).toUpperCase() + a.slice(1)}
            </span>
          ))}
        </div>
      )}

      {(implicit.length > 0 || ashen.length > 0) && (
        <div className="tt-section">
          {implicit.map((l, i) => (
            <div key={`i${i}`} className="tt-implicit">
              {l.text}
            </div>
          ))}
          {ashen.map((l, i) => (
            <div key={`a${i}`} className="tt-ashen-line">
              {l.text}
            </div>
          ))}
        </div>
      )}

      {(unique.length > 0 || affixes.length > 0) && (
        <div className="tt-section">
          {unique.map((l, i) => (
            <div key={`u${i}`} className="tt-mod">
              {l.text}
            </div>
          ))}
          {affixes.map((l, i) => (
            <div key={`m${i}`} className="tt-mod">
              <span>{l.text}</span>
              {l.affixId && (
                <span className="tt-tier" title={l.origin}>
                  {l.origin === 'prefix' ? 'P' : 'S'} {tierLabel(l.affixId, l.tierIndex ?? 0)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {item.uniqueId && <div className="tt-flavour">{tDynamic(`${item.uniqueId}.desc`)}</div>}
      {item.ashen && <div className="tt-ashen-footer">{t('item.ashen')}</div>}
    </div>
  );
}
