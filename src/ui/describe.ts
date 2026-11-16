import type { ActionDef } from '../engine/content/types';
import { nameOf, t } from '../i18n';
import { formatPercent } from '../shared/format';

/** One-line summary of what an action produces. */
export function describeOutputs(def: ActionDef): string {
  switch (def.type) {
    case 'simple':
    case 'rock':
      return def.qty > 1 ? `${nameOf(def.itemId)} ×${def.qty}` : nameOf(def.itemId);
    case 'catch':
    case 'bundle': {
      const total = def.table.reduce((s, e) => s + e.weight, 0);
      const list = def.table
        .map((e) => `${nameOf(e.itemId)} ${formatPercent(e.weight / total, 0)}`)
        .join(', ');
      return def.type === 'bundle'
        ? `${t('action.picks', { min: def.picks[0], max: def.picks[1] })}: ${list}`
        : list;
    }
    case 'thieve':
      return t('action.gold', { min: def.gold[0], max: def.gold[1] });
    case 'craft': {
      const o = def.output;
      if (o.kind === 'item') return o.qty > 1 ? `${nameOf(o.itemId)} ×${o.qty}` : nameOf(o.itemId);
      return nameOf(o.kind === 'gear' ? o.baseId : o.uniqueId);
    }
  }
}
