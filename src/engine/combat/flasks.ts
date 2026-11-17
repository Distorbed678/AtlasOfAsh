import { CONTENT, type Content } from '../content';
import type { FlaskStats } from '../content/types';
import { itemLines } from '../items/itemStats';
import type { ItemInstance } from '../items/types';

/** A flask's stats after its local affixes. */
export function flaskFor(item: ItemInstance, content: Content = CONTENT): FlaskStats | null {
  const base = content.bases.get(item.baseId);
  if (!base.flask) return null;
  const inc = { flaskRecovery: 0, flaskMaxCharges: 0, flaskChargesUsed: 0, flaskDuration: 0 };
  for (const { line, value } of itemLines(item, content)) {
    if (line.stat in inc) inc[line.stat as keyof typeof inc] += value;
  }
  const f = base.flask;
  const recovery = f.kind === 'life' || f.kind === 'mana';
  return {
    kind: f.kind,
    amount: recovery ? f.amount * (1 + inc.flaskRecovery / 100) : f.amount,
    durationMs: recovery ? f.durationMs : Math.round(f.durationMs * (1 + inc.flaskDuration / 100)),
    maxCharges: Math.round(f.maxCharges * (1 + inc.flaskMaxCharges / 100)),
    chargesPerUse: Math.max(1, Math.round(f.chargesPerUse * (1 + inc.flaskChargesUsed / 100))),
  };
}

export const CHARGES_PER_KILL = 1;
export const CHARGES_PER_HIT_TAKEN = 0.2;
