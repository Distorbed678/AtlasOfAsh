import { CONTENT, type Content } from '../content';
import type { AffixStatLine, BaseItemDef, EquipSlot } from '../content/types';
import type { WeaponStats } from '../stats/damage';
import type { DamageType, Mod, ModSource } from '../stats/types';
import type { ItemInstance, RolledMod } from './types';

/** One displayable/statable line of an item: a stat line with its rolled value. */
export interface ItemLine {
  line: AffixStatLine;
  value: number;
  /** Where the line comes from on the item. */
  origin: 'implicit' | 'prefix' | 'suffix' | 'unique' | 'ashen';
  affixId?: string;
  tierIndex?: number;
}

export function itemLines(item: ItemInstance, content: Content = CONTENT): ItemLine[] {
  const base = content.bases.get(item.baseId);
  const out: ItemLine[] = base.implicits.map((m) => ({
    line: { stat: m.stat, kind: m.kind, tags: m.tags },
    value: m.value,
    origin: 'implicit' as const,
  }));
  const rolled = (mods: RolledMod[] | undefined, origin: ItemLine['origin']) => {
    for (const m of mods ?? []) {
      const affix = content.affixes.get(m.affixId);
      affix.lines.forEach((line, i) =>
        out.push({ line, value: m.values[i]!, origin, affixId: m.affixId, tierIndex: m.tierIndex }),
      );
    }
  };
  rolled(item.ashenImplicits, 'ashen');
  if (item.uniqueId) {
    const u = content.uniques.get(item.uniqueId);
    u.lines.forEach((line, i) =>
      out.push({ line, value: item.uniqueValues?.[i] ?? line.range[0], origin: 'unique' }),
    );
  }
  rolled(item.prefixes, 'prefix');
  rolled(item.suffixes, 'suffix');
  return out;
}

export interface ComputedItem {
  base: BaseItemDef;
  /** Weapon stats after local modifiers (for weapons only). */
  weapon?: WeaponStats & { physRange: [number, number] };
  /** Defences after local modifiers. */
  armour: number;
  evasion: number;
  energyShield: number;
  block: number;
  /** Which local values changed (for highlighting in tooltips). */
  modified: Set<'phys' | 'elemental' | 'aps' | 'crit' | 'armour' | 'evasion' | 'energyShield'>;
  /** Everything that applies to the character (non-local lines + defences + block). */
  globalMods: Mod[];
}

/**
 * Resolve an item: local lines modify its own base stats; the rest become
 * global character modifiers sourced to this item.
 */
export function computeItem(
  item: ItemInstance,
  label: string,
  content: Content = CONTENT,
): ComputedItem {
  const base = content.bases.get(item.baseId);
  const source: ModSource = { kind: 'item', id: `item:${item.uid}`, label };
  const lines = itemLines(item, content);
  const modified: ComputedItem['modified'] = new Set();
  const globalMods: Mod[] = [];
  const localFlat: Partial<Record<string, number>> = {};
  const localInc: Partial<Record<string, number>> = {};

  for (const { line, value } of lines) {
    if (!line.local) {
      globalMods.push({ stat: line.stat, kind: line.kind, value, tags: line.tags, source });
      continue;
    }
    const key = line.stat === 'damage' ? `damage.${line.tags?.[0] ?? 'all'}` : line.stat;
    if (line.kind === 'flat') localFlat[key] = (localFlat[key] ?? 0) + value;
    else if (line.kind === 'increased') localInc[key] = (localInc[key] ?? 0) + value;
  }

  const def = (stat: 'armour' | 'evasion' | 'energyShield', baseValue: number | undefined) => {
    if (baseValue === undefined && !localFlat[stat]) return 0;
    const v = ((baseValue ?? 0) + (localFlat[stat] ?? 0)) * (1 + (localInc[stat] ?? 0) / 100);
    if (localFlat[stat] || localInc[stat]) modified.add(stat);
    return Math.round(v);
  };
  const armour = def('armour', base.defence?.armour);
  const evasion = def('evasion', base.defence?.evasion);
  const energyShield = def('energyShield', base.defence?.energyShield);
  const block = base.defence?.block ?? 0;
  if (armour) globalMods.push({ stat: 'armour', kind: 'flat', value: armour, source });
  if (evasion) globalMods.push({ stat: 'evasion', kind: 'flat', value: evasion, source });
  if (energyShield)
    globalMods.push({ stat: 'energyShield', kind: 'flat', value: energyShield, source });
  if (block) globalMods.push({ stat: 'block', kind: 'flat', value: block, source });

  let weapon: ComputedItem['weapon'];
  if (base.weapon) {
    const physMult = 1 + (localInc['damage.physical'] ?? 0) / 100;
    const phys: [number, number] = [
      Math.round((base.weapon.phys[0] + (localFlat['added.physical.min'] ?? 0)) * physMult),
      Math.round((base.weapon.phys[1] + (localFlat['added.physical.max'] ?? 0)) * physMult),
    ];
    if (localFlat['added.physical.min'] || localInc['damage.physical']) modified.add('phys');
    const damage: WeaponStats['damage'] = { physical: { min: phys[0], max: phys[1] } };
    for (const t of ['fire', 'cold', 'lightning', 'chaos'] as DamageType[]) {
      const min = localFlat[`added.${t}.min`] ?? 0;
      const max = localFlat[`added.${t}.max`] ?? 0;
      if (min || max) {
        damage[t] = { min, max };
        modified.add('elemental');
      }
    }
    const aps = base.weapon.attacksPerSecond * (1 + (localInc.attackSpeed ?? 0) / 100);
    const crit = base.weapon.critChance * (1 + (localInc.critChance ?? 0) / 100);
    if (localInc.attackSpeed) modified.add('aps');
    if (localInc.critChance) modified.add('crit');
    weapon = {
      id: `item:${item.uid}`,
      damage,
      attacksPerSecond: Math.round(aps * 100) / 100,
      critChance: Math.round(crit * 100) / 100,
      tags: base.tags,
      physRange: phys,
    };
  }

  return { base, weapon, armour, evasion, energyShield, block, modified, globalMods };
}

/** Unarmed fallback for the Basic Attack. */
export const UNARMED: WeaponStats = {
  id: 'unarmed',
  damage: { physical: { min: 2, max: 6 } },
  attacksPerSecond: 1.2,
  critChance: 0,
  tags: ['unarmed', 'melee'],
};

export function equipmentMods(
  equipment: Partial<Record<EquipSlot, ItemInstance>>,
  labelFor: (item: ItemInstance) => string,
  content: Content = CONTENT,
): Mod[] {
  return Object.values(equipment).flatMap((item) =>
    item ? computeItem(item, labelFor(item), content).globalMods : [],
  );
}
