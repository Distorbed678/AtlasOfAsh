import { CONTENT, type Content } from '../content';
import type { AffixDef, BaseItemDef } from '../content/types';
import type { Rng } from '../core/rng';
import { AFFIX_LIMITS, type ItemInstance, type Rarity, type RolledMod } from './types';

/** Name parts for rare items (original word lists). */
const NAME_FIRST = [
  'Ash',
  'Cinder',
  'Grim',
  'Hollow',
  'Dusk',
  'Rust',
  'Pale',
  'Storm',
  'Bitter',
  'Iron',
  'Ember',
  'Gloom',
  'Raven',
  'Thorn',
  'Wraith',
  'Soot',
  'Kiln',
  'Mourn',
  'Blight',
  'Vigil',
];
const NAME_SECOND: Record<string, string[]> = {
  weapon: ['Edge', 'Bite', 'Song', 'Fang', 'Wrath', 'Toll', 'Reaver', 'Spike', 'Hymn', 'Brand'],
  armour: [
    'Mantle',
    'Shell',
    'Ward',
    'Veil',
    'Bastion',
    'Hide',
    'Shroud',
    'Aegis',
    'Coat',
    'Guard',
  ],
  jewellery: ['Loop', 'Knot', 'Clasp', 'Coil', 'Eye', 'Charm', 'Band', 'Spiral', 'Gleam', 'Sigil'],
};

export function nameKind(base: BaseItemDef): string {
  if (base.tags.includes('weapon') || base.class === 'quiver' || base.class === 'focus')
    return 'weapon';
  if (base.class === 'ring' || base.class === 'amulet') return 'jewellery';
  return 'armour';
}

export function eligibleAffixes(base: BaseItemDef, content: Content = CONTENT): AffixDef[] {
  return content.affixes
    .all()
    .filter((a) => a.kind !== 'ashen' && a.allowedTags.some((t) => base.tags.includes(t)));
}

export function rollValues(rng: Rng, ranges: readonly (readonly [number, number])[]): number[] {
  return ranges.map(([lo, hi]) => {
    if (lo === hi) return lo;
    if (Number.isInteger(lo) && Number.isInteger(hi)) return rng.int(lo, hi);
    return Math.round((lo + rng.float() * (hi - lo)) * 10) / 10;
  });
}

/** Roll one new affix of `kind` that respects item level and group exclusivity. */
export function rollAffix(
  rng: Rng,
  item: ItemInstance,
  base: BaseItemDef,
  kind: 'prefix' | 'suffix',
  content: Content = CONTENT,
  restrictGroup?: string,
): RolledMod | null {
  const taken = new Set(
    [...item.prefixes, ...item.suffixes].map((m) => content.affixes.get(m.affixId).group),
  );
  const options: { weight: number; value: { affix: AffixDef; tierIndex: number } }[] = [];
  for (const affix of eligibleAffixes(base, content)) {
    if (affix.kind !== kind || taken.has(affix.group)) continue;
    if (restrictGroup && affix.group !== restrictGroup) continue;
    affix.tiers.forEach((tier, tierIndex) => {
      if (tier.ilvl <= item.ilvl)
        options.push({ weight: tier.weight, value: { affix, tierIndex } });
    });
  }
  if (options.length === 0) return null;
  const { affix, tierIndex } = rng.weighted(options);
  return { affixId: affix.id, tierIndex, values: rollValues(rng, affix.tiers[tierIndex]!.ranges) };
}

export function openSlots(item: ItemInstance, kind: 'prefix' | 'suffix'): number {
  const limit = AFFIX_LIMITS[item.rarity];
  return limit - (kind === 'prefix' ? item.prefixes.length : item.suffixes.length);
}

/** Add one random affix in a free slot (prefix or suffix). Returns false if nothing fits. */
export function addRandomAffix(rng: Rng, item: ItemInstance, content: Content = CONTENT): boolean {
  const base = content.bases.get(item.baseId);
  const kinds = (['prefix', 'suffix'] as const).filter((k) => openSlots(item, k) > 0);
  // Try kinds in random order so prefixes and suffixes are equally likely.
  if (kinds.length === 2 && rng.chance(0.5)) kinds.reverse();
  for (const kind of kinds) {
    const mod = rollAffix(rng, item, base, kind, content);
    if (mod) {
      (kind === 'prefix' ? item.prefixes : item.suffixes).push(mod);
      return true;
    }
  }
  return false;
}

/** Fill a magic (1-2 mods) or rare (4-6 mods) item from scratch. */
export function rollMods(rng: Rng, item: ItemInstance, content: Content = CONTENT): void {
  item.prefixes = [];
  item.suffixes = [];
  const count =
    item.rarity === 'magic' ? rng.int(1, 2) : item.rarity === 'rare' ? rng.int(4, 6) : 0;
  for (let i = 0; i < count; i++) if (!addRandomAffix(rng, item, content)) break;
  if (item.rarity === 'rare') item.name = rareName(rng, content.bases.get(item.baseId));
  else delete item.name;
}

export function rareName(rng: Rng, base: BaseItemDef): [string, string] {
  const second = NAME_SECOND[nameKind(base)]!;
  return [NAME_FIRST[rng.int(0, NAME_FIRST.length - 1)]!, second[rng.int(0, second.length - 1)]!];
}

export function newItem(
  uid: number,
  baseId: string,
  ilvl: number,
  rarity: Rarity,
  rng: Rng,
  content: Content = CONTENT,
): ItemInstance {
  const item: ItemInstance = { uid, baseId, rarity, ilvl, prefixes: [], suffixes: [] };
  rollMods(rng, item, content);
  return item;
}

export function newUnique(
  uid: number,
  uniqueId: string,
  rng: Rng,
  content: Content = CONTENT,
): ItemInstance {
  const u = content.uniques.get(uniqueId);
  const base = content.bases.get(u.baseId);
  return {
    uid,
    baseId: base.id,
    rarity: 'unique',
    ilvl: base.tier * 10,
    prefixes: [],
    suffixes: [],
    uniqueId,
    uniqueValues: rollValues(
      rng,
      u.lines.map((l) => l.range),
    ),
  };
}
