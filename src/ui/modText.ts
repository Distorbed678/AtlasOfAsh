import type { ItemLine } from '../engine/items/itemStats';
import type { StatId } from '../engine/stats/types';
import { t, tDynamic } from '../i18n';

const TYPE: Record<string, string> = {
  physical: 'Physical',
  fire: 'Fire',
  cold: 'Cold',
  lightning: 'Lightning',
  chaos: 'Chaos',
};
const ATTR: Record<string, string> = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence' };

const fmt = (v: number) => String(Math.round(v * 10) / 10);

/** A displayable item line, possibly merged from several stat lines (e.g. "Adds 3 to 7"). */
export interface DisplayLine {
  text: string;
  origin: ItemLine['origin'];
  affixId?: string;
  tierIndex?: number;
}

function single(
  stat: StatId,
  kind: string,
  v: number,
  tags: readonly string[] = [],
  local = false,
): string {
  const val = fmt(v);
  const [head, a, b] = stat.split('.') as [string, string | undefined, string | undefined];
  switch (head) {
    case 'life':
      return kind === 'increased'
        ? t('mod.life.increased', { v: val })
        : t('mod.life.flat', { v: val });
    case 'mana':
      return t('mod.mana.flat', { v: val });
    case 'spirit':
      return t('mod.spirit.flat', { v: val });
    case 'energyShield':
    case 'armour':
    case 'evasion':
      if (local)
        return tDynamic(`mod.${head}.local.${kind === 'increased' ? 'increased' : 'flat'}`, {
          v: val,
        });
      if (head === 'energyShield') return t('mod.energyShield.flat', { v: val });
      return tDynamic(`mod.${head}.local.flat`, { v: val });
    case 'damage': {
      const what = tags.includes('physical')
        ? 'Physical '
        : tags.includes('spell')
          ? 'Spell '
          : tags.includes('elemental')
            ? 'Elemental '
            : tags.includes('attack')
              ? 'Attack '
              : '';
      return t(kind === 'more' ? 'mod.damage.more' : 'mod.damage.increased', { v: val, what });
    }
    case 'accuracy':
      return t('mod.accuracy.flat', { v: val });
    case 'str':
    case 'dex':
    case 'int':
      return t('mod.attr.flat', { v: val, attr: ATTR[head]! });
    case 'resist':
      return t('mod.resist.flat', { v: val, type: TYPE[a!]! });
    case 'maxResist':
      return t('mod.maxResist.flat', { v: val, type: TYPE[a!]! });
    case 'attackSpeed':
      return t('mod.attackSpeed.increased', { v: val });
    case 'castSpeed':
      return t('mod.castSpeed.increased', { v: val });
    case 'critChance':
      return t('mod.critChance.increased', { v: val });
    case 'critBonus':
      return t('mod.critBonus.flat', { v: val });
    case 'lifeRegenPct':
      return t('mod.lifeRegenPct.flat', { v: val });
    case 'manaRegenPct':
      return t('mod.manaRegenPct.increased', { v: val });
    case 'lifeLeech':
      return t('mod.lifeLeech.flat', { v: val });
    case 'ailmentChance':
      return tDynamic(`mod.ailmentChance.${a}`, { v: val });
    case 'block':
      return t('mod.block.flat', { v: val });
    case 'esRechargeStart':
      return t('mod.esRechargeStart.flat', { v: val });
    case 'penetration':
      return t('mod.penetration', { v: val, type: TYPE[a!]! });
    case 'flaskRecovery':
      return t('mod.flaskRecovery', { v: val });
    case 'flaskMaxCharges':
      return t('mod.flaskMaxCharges', { v: val });
    case 'flaskChargesUsed':
      return t('mod.flaskChargesUsed', { v: fmt(Math.abs(v)) });
    case 'flaskDuration':
      return t('mod.flaskDuration', { v: val });
    case 'gainAs':
      return t('mod.gainAs', { v: val, from: TYPE[a!]!, to: TYPE[b!]! });
    default:
      return t('mod.generic', { stat, kind, v: val });
  }
}

/** Turn item lines into display text, merging min/max pairs and identical penetration lines. */
export function displayLines(lines: ItemLine[]): DisplayLine[] {
  const out: DisplayLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const meta = { origin: l.origin, affixId: l.affixId, tierIndex: l.tierIndex };
    const stat = l.line.stat;
    if (stat.startsWith('added.') && stat.endsWith('.min')) {
      const next = lines[i + 1];
      const type = stat.split('.')[1]!;
      const max = next && next.line.stat === `added.${type}.max` ? next.value : l.value;
      if (next && next.line.stat === `added.${type}.max`) i++;
      const tags = l.line.tags ?? [];
      const key = tags.includes('attack')
        ? 'mod.added.attack'
        : tags.includes('spell')
          ? 'mod.added.spell'
          : 'mod.added';
      out.push({
        text: tDynamic(key, { a: fmt(l.value), b: fmt(max), type: TYPE[type]! }),
        ...meta,
      });
      continue;
    }
    if (stat === 'penetration.fire') {
      const c = lines[i + 1];
      const li = lines[i + 2];
      if (
        c?.line.stat === 'penetration.cold' &&
        li?.line.stat === 'penetration.lightning' &&
        c.value === l.value &&
        li.value === l.value
      ) {
        out.push({ text: t('mod.penetration.elemental', { v: fmt(l.value) }), ...meta });
        i += 2;
        continue;
      }
    }
    out.push({ text: single(stat, l.line.kind, l.value, l.line.tags, !!l.line.local), ...meta });
  }
  return out;
}
