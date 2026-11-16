import { CONTENT, type Content } from '../content';
import { INFUSIONS, INFUSION_LEVEL } from '../content/materials';
import type { Rng } from '../core/rng';
import { addRandomAffix, rareName, rollAffix, rollMods, rollValues } from './generate';
import { AFFIX_LIMITS, type ItemInstance, type Rarity } from './types';

export type EnchantOp =
  | 'transmute'
  | 'augment'
  | 'upgrade'
  | 'reroll'
  | 'rerollValues'
  | 'remove'
  | 'rerollKeepPrefixes'
  | 'rerollKeepSuffixes'
  | 'infuse'
  | 'brand';

export interface OpSpec {
  op: EnchantOp;
  level: number;
  reagents: Record<string, number>;
  xp: number;
}

/** Enchanting level unlocks operations; every operation always succeeds. */
export const ENCHANT_OPS: Record<Exclude<EnchantOp, 'infuse'>, OpSpec> = {
  transmute: { op: 'transmute', level: 1, reagents: { 'item.spark_of_change': 1 }, xp: 4 },
  augment: { op: 'augment', level: 5, reagents: { 'item.ember_of_growth': 1 }, xp: 6 },
  upgrade: { op: 'upgrade', level: 15, reagents: { 'item.kindled_heart': 1 }, xp: 15 },
  reroll: { op: 'reroll', level: 25, reagents: { 'item.ashfall_powder': 1 }, xp: 25 },
  rerollValues: { op: 'rerollValues', level: 35, reagents: { 'item.tempering_oil': 1 }, xp: 30 },
  remove: { op: 'remove', level: 45, reagents: { 'item.severing_salt': 1 }, xp: 40 },
  rerollKeepPrefixes: {
    op: 'rerollKeepPrefixes',
    level: 60,
    reagents: { 'item.ashfall_powder': 1, 'item.warding_wax': 1 },
    xp: 80,
  },
  rerollKeepSuffixes: {
    op: 'rerollKeepSuffixes',
    level: 60,
    reagents: { 'item.ashfall_powder': 1, 'item.binding_wax': 1 },
    xp: 80,
  },
  brand: { op: 'brand', level: 80, reagents: { 'item.ashfire_brand': 1 }, xp: 200 },
};

export function opSpec(op: EnchantOp, infusionId?: string): OpSpec {
  if (op === 'infuse') {
    if (!infusionId || !INFUSIONS.some((i) => i.id === infusionId))
      throw new Error('Choose an infusion');
    return { op, level: INFUSION_LEVEL, reagents: { [infusionId]: 1 }, xp: 120 };
  }
  return ENCHANT_OPS[op];
}

const modCount = (item: ItemInstance) => item.prefixes.length + item.suffixes.length;

/** Why this op can't be applied to this item, or null if it can. */
export function enchantProblem(
  item: ItemInstance,
  op: EnchantOp,
  infusionId?: string,
  content: Content = CONTENT,
): string | null {
  if (item.ashen) return 'Ashen items can no longer be changed';
  const r = item.rarity;
  switch (op) {
    case 'transmute':
      return r === 'normal' ? null : 'Needs a normal item';
    case 'augment':
      if (r !== 'magic' && r !== 'rare') return 'Needs a magic or rare item';
      return modCount(item) < AFFIX_LIMITS[r] * 2 ? null : 'No open affix slots';
    case 'upgrade':
      return r === 'magic' ? null : 'Needs a magic item';
    case 'reroll':
    case 'rerollKeepPrefixes':
    case 'rerollKeepSuffixes':
      return r === 'magic' || r === 'rare' ? null : 'Needs a magic or rare item';
    case 'rerollValues':
      return modCount(item) > 0 || r === 'unique' ? null : 'Nothing to reroll';
    case 'remove':
      return modCount(item) > 0 ? null : 'No affixes to remove';
    case 'infuse': {
      if (r === 'unique') return 'Uniques cannot be infused';
      const group = INFUSIONS.find((i) => i.id === infusionId)?.group;
      const base = content.bases.get(item.baseId);
      const fits = content.affixes
        .all()
        .some(
          (a) =>
            a.group === group &&
            a.allowedTags.some((t) => base.tags.includes(t)) &&
            a.tiers[0]!.ilvl <= item.ilvl,
        );
      return fits ? null : 'That infusion cannot appear on this item';
    }
    case 'brand':
      return null;
  }
}

function rerollValuesOf(rng: Rng, item: ItemInstance, content: Content) {
  for (const m of [...item.prefixes, ...item.suffixes]) {
    m.values = rollValues(rng, content.affixes.get(m.affixId).tiers[m.tierIndex]!.ranges);
  }
  if (item.uniqueId) {
    item.uniqueValues = rollValues(
      rng,
      content.uniques.get(item.uniqueId).lines.map((l) => l.range),
    );
  }
}

function fillRare(rng: Rng, item: ItemInstance, content: Content) {
  const target = rng.int(4, 6);
  while (modCount(item) < target) if (!addRandomAffix(rng, item, content)) break;
}

export type BrandOutcome = 'nothing' | 'implicit' | 'reroll' | 'brick';

/** Apply an Enchanting operation (reagents and level are checked by the caller). */
export function applyEnchant(
  rng: Rng,
  item: ItemInstance,
  op: EnchantOp,
  infusionId?: string,
  content: Content = CONTENT,
): BrandOutcome | null {
  const problem = enchantProblem(item, op, infusionId, content);
  if (problem) throw new Error(problem);
  const base = content.bases.get(item.baseId);
  const setRarity = (r: Rarity) => (item.rarity = r);

  switch (op) {
    case 'transmute':
      setRarity('magic');
      rollMods(rng, item, content);
      return null;
    case 'augment':
      addRandomAffix(rng, item, content);
      return null;
    case 'upgrade':
      setRarity('rare');
      item.name = rareName(rng, base);
      addRandomAffix(rng, item, content);
      return null;
    case 'reroll':
      rollMods(rng, item, content);
      return null;
    case 'rerollValues':
      rerollValuesOf(rng, item, content);
      return null;
    case 'remove': {
      const all = [
        ...item.prefixes.map((m) => ['p', m] as const),
        ...item.suffixes.map((m) => ['s', m] as const),
      ];
      const [kind, mod] = all[rng.int(0, all.length - 1)]!;
      if (kind === 'p') item.prefixes = item.prefixes.filter((m) => m !== mod);
      else item.suffixes = item.suffixes.filter((m) => m !== mod);
      return null;
    }
    case 'rerollKeepPrefixes':
    case 'rerollKeepSuffixes': {
      const keepPrefixes = op === 'rerollKeepPrefixes';
      if (keepPrefixes) item.suffixes = [];
      else item.prefixes = [];
      const kind = keepPrefixes ? 'suffix' : 'prefix';
      const limit = AFFIX_LIMITS[item.rarity];
      const want = item.rarity === 'rare' ? rng.int(1, limit) : 1;
      for (let i = 0; i < want; i++) {
        const m = rollAffix(rng, item, base, kind, content);
        if (!m) break;
        (kind === 'prefix' ? item.prefixes : item.suffixes).push(m);
      }
      return null;
    }
    case 'infuse': {
      const group = INFUSIONS.find((i) => i.id === infusionId)!.group;
      setRarity('rare');
      item.prefixes = [];
      item.suffixes = [];
      item.name = rareName(rng, base);
      const kind = content.affixes.all().find((a) => a.group === group)!.kind as
        'prefix' | 'suffix';
      const guaranteed = rollAffix(rng, item, base, kind, content, group);
      if (guaranteed) (kind === 'prefix' ? item.prefixes : item.suffixes).push(guaranteed);
      fillRare(rng, item, content);
      return null;
    }
    case 'brand':
      return brand(rng, item, content);
  }
}

/** Ashen Brand (harsh odds): 25% nothing, 25% Ashen implicit, 25% reroll into a random rare, 25% brick. */
function brand(rng: Rng, item: ItemInstance, content: Content): BrandOutcome {
  const base = content.bases.get(item.baseId);
  const outcome = rng.weighted<BrandOutcome>([
    { weight: 25, value: 'nothing' },
    { weight: 25, value: 'implicit' },
    { weight: 25, value: 'reroll' },
    { weight: 25, value: 'brick' },
  ]);
  if (outcome === 'implicit') {
    const options = content.affixes
      .all()
      .filter((a) => a.kind === 'ashen' && a.allowedTags.some((t) => base.tags.includes(t)));
    const a = options[rng.int(0, options.length - 1)]!;
    item.ashenImplicits = [
      { affixId: a.id, tierIndex: 0, values: rollValues(rng, a.tiers[0]!.ranges) },
    ];
  } else if (outcome === 'reroll') {
    delete item.uniqueId;
    delete item.uniqueValues;
    item.rarity = 'rare';
    item.prefixes = [];
    item.suffixes = [];
    item.name = rareName(rng, base);
    fillRare(rng, item, content);
  } else if (outcome === 'brick') {
    // Heavily damaged: lose half the affixes (rounded up), the rest drop to their tier's minimum.
    const all = [...item.prefixes, ...item.suffixes];
    const lose = Math.ceil(all.length / 2);
    for (let i = 0; i < lose; i++) {
      const victim = [...item.prefixes, ...item.suffixes][
        rng.int(0, item.prefixes.length + item.suffixes.length - 1)
      ]!;
      item.prefixes = item.prefixes.filter((m) => m !== victim);
      item.suffixes = item.suffixes.filter((m) => m !== victim);
    }
    for (const m of [...item.prefixes, ...item.suffixes]) {
      m.values = content.affixes.get(m.affixId).tiers[m.tierIndex]!.ranges.map(([lo]) => lo);
    }
    if (item.uniqueId)
      item.uniqueValues = content.uniques.get(item.uniqueId).lines.map((l) => l.range[0]);
  }
  item.ashen = true;
  return outcome;
}

/** Arcane dust from disenchanting. */
export function dustYield(item: ItemInstance): number {
  const mult = { normal: 1, magic: 3, rare: 8, unique: 20 }[item.rarity];
  return Math.round(2 * mult * (1 + item.ilvl / 20));
}

export const DISENCHANT_XP = { normal: 1, magic: 2, rare: 4, unique: 10 } as const;

/** Gold from selling gear to the vendor. */
export function gearSellPrice(item: ItemInstance, content: Content = CONTENT): number {
  const mult = { normal: 1, magic: 1.5, rare: 3, unique: 10 }[item.rarity];
  return Math.ceil(content.bases.get(item.baseId).sellPrice * mult);
}
