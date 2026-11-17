import { CONTENT, type Content } from '../content';
import { HIDE_IDS } from '../content/materials';
import type { BaseItemDef, ZoneDef } from '../content/types';
import type { Rng } from '../core/rng';
import { addGold, addItem } from '../economy/bank';
import { dustYield, gearSellPrice } from '../items/enchanting';
import { newItem } from '../items/generate';
import { addToStash, allocateUid } from '../items/stash';
import type { ItemInstance, Rarity } from '../items/types';
import {
  TRIP_BAG_STACKS,
  type FilterAction,
  type FilterRule,
  type GameState,
  type TripBag,
} from '../state';
import { RARITY_SCALE, type MonsterStats } from './monsterStats';

export type Drop =
  | { kind: 'gold'; amount: number }
  | { kind: 'item'; itemId: string; qty: number }
  | { kind: 'gear'; item: ItemInstance };

export const zoneTier = (level: number) => Math.min(10, Math.floor((level - 1) / 10) + 1);
const gemTier = (level: number) => Math.min(5, Math.floor((level - 1) / 20) + 1);

/** Drop chances per loot roll (rarer monsters roll more often). */
export const DROP_CHANCES = {
  gold: 0.7,
  gear: 0.05,
  dust: 0.08,
  spark: 0.02,
  ember: 0.01,
  kindled: 0.003,
  uncutSkill: 0.008,
  uncutSupport: 0.006,
} as const;

let basesByTier: Map<
  number,
  { weapon: BaseItemDef[]; armour: BaseItemDef[]; jewel: BaseItemDef[] }
> | null = null;
function bases(tier: number, content: Content) {
  if (!basesByTier) {
    basesByTier = new Map();
    for (const b of content.bases.all()) {
      if (b.class === 'flask') continue;
      const entry = basesByTier.get(b.tier) ?? { weapon: [], armour: [], jewel: [] };
      const group = b.tags.includes('weapon')
        ? 'weapon'
        : b.class === 'ring' || b.class === 'amulet'
          ? 'jewel'
          : 'armour';
      entry[group].push(b);
      basesByTier.set(b.tier, entry);
    }
  }
  return basesByTier.get(tier)!;
}

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[rng.int(0, list.length - 1)]!;
}

export function rollGear(
  state: GameState,
  rng: Rng,
  level: number,
  rareMonster: boolean,
  content: Content,
): ItemInstance {
  const pool = bases(zoneTier(level), content);
  const group = rng.weighted([
    { weight: 40, value: pool.weapon },
    { weight: 45, value: pool.armour },
    { weight: 15, value: pool.jewel },
  ]);
  const base = pick(rng, group);
  const rarity = rng.weighted<Rarity>(
    rareMonster
      ? [
          { weight: 25, value: 'normal' },
          { weight: 50, value: 'magic' },
          { weight: 25, value: 'rare' },
        ]
      : [
          { weight: 60, value: 'normal' },
          { weight: 32, value: 'magic' },
          { weight: 8, value: 'rare' },
        ],
  );
  return newItem(allocateUid(state), base.id, level, rarity, rng, content);
}

/** Everything a kill drops, before the loot filter. */
export function rollDrops(
  state: GameState,
  rng: Rng,
  monster: MonsterStats,
  content: Content = CONTENT,
): Drop[] {
  const drops: Drop[] = [];
  const L = monster.level;
  const rolls = RARITY_SCALE[monster.rarity].lootRolls;
  for (let r = 0; r < rolls; r++) {
    if (rng.chance(DROP_CHANCES.gold)) drops.push({ kind: 'gold', amount: rng.int(1, 2 + L) });
    if (rng.chance(DROP_CHANCES.gear))
      drops.push({
        kind: 'gear',
        item: rollGear(state, rng, L, monster.rarity === 'rare', content),
      });
    if (rng.chance(DROP_CHANCES.dust))
      drops.push({ kind: 'item', itemId: 'item.arcane_dust', qty: rng.int(1, 3) });
    if (rng.chance(DROP_CHANCES.spark))
      drops.push({ kind: 'item', itemId: 'item.spark_of_change', qty: 1 });
    if (rng.chance(DROP_CHANCES.ember))
      drops.push({ kind: 'item', itemId: 'item.ember_of_growth', qty: 1 });
    if (rng.chance(DROP_CHANCES.kindled))
      drops.push({ kind: 'item', itemId: 'item.kindled_heart', qty: 1 });
    if (rng.chance(DROP_CHANCES.uncutSkill))
      drops.push({ kind: 'item', itemId: `item.uncut_skill_gem_t${gemTier(L)}`, qty: 1 });
    if (rng.chance(DROP_CHANCES.uncutSupport))
      drops.push({ kind: 'item', itemId: `item.uncut_support_gem_t${gemTier(L)}`, qty: 1 });
  }
  if (monster.def.hideChance > 0 && rng.chance(monster.def.hideChance))
    drops.push({ kind: 'item', itemId: HIDE_IDS[zoneTier(L) - 1]!, qty: 1 });
  return drops;
}

// ---------------------------------------------------------------- Loot filter

export function ruleMatches(rule: FilterRule, drop: Drop, content: Content = CONTENT): boolean {
  if (!rule.enabled || drop.kind === 'gold') return false;
  if (drop.kind === 'gear') {
    if (rule.target !== 'gear') return false;
    const item = drop.item;
    const base = content.bases.get(item.baseId);
    if (rule.rarities?.length && !rule.rarities.includes(item.rarity)) return false;
    if (rule.classes?.length && !rule.classes.includes(base.class)) return false;
    if (rule.minTier !== undefined && base.tier < rule.minTier) return false;
    if (rule.maxTier !== undefined && base.tier > rule.maxTier) return false;
    if (rule.minIlvl !== undefined && item.ilvl < rule.minIlvl) return false;
    if (rule.hasAffix) {
      const groups = [...item.prefixes, ...item.suffixes].map(
        (m) => content.affixes.get(m.affixId).group,
      );
      if (!groups.includes(rule.hasAffix)) return false;
    }
    return true;
  }
  if (rule.target !== 'material') return false;
  const def = content.items.get(drop.itemId);
  if (rule.categories?.length && !rule.categories.includes(def.category)) return false;
  if (rule.minTier !== undefined && def.tier < rule.minTier) return false;
  if (rule.maxTier !== undefined && def.tier > rule.maxTier) return false;
  return true;
}

export function filterAction(
  rules: readonly FilterRule[],
  drop: Drop,
  content: Content = CONTENT,
): FilterAction {
  for (const r of rules) if (ruleMatches(r, drop, content)) return r.action;
  return 'keep';
}

export const FILTER_PRESETS: Record<
  'keepAll' | 'earlyGame' | 'raresOnly',
  Omit<FilterRule, 'id'>[]
> = {
  keepAll: [],
  earlyGame: [
    { enabled: true, target: 'gear', rarities: ['normal'], action: 'disenchant' },
    { enabled: true, target: 'material', categories: ['junk'], action: 'sell' },
  ],
  raresOnly: [
    { enabled: true, target: 'gear', rarities: ['rare', 'unique'], action: 'keep' },
    { enabled: true, target: 'gear', action: 'disenchant' },
  ],
};

// ---------------------------------------------------------------- Trip bag

export function bagStacks(bag: TripBag): number {
  return Object.keys(bag.items).length + bag.gear.length;
}

/**
 * Apply the loot filter and put the result in the trip bag. When the bag is full,
 * new stacks are lost (existing stacks still grow).
 */
export function collectDrops(
  state: GameState,
  bag: TripBag,
  drops: Drop[],
  content: Content = CONTENT,
): void {
  const toBag = (d: Exclude<Drop, { kind: 'gold' }>) => {
    if (d.kind === 'item' && bag.items[d.itemId] !== undefined) {
      bag.items[d.itemId]! += d.qty;
      return;
    }
    if (bagStacks(bag) >= TRIP_BAG_STACKS) {
      state.stats.itemsLost += d.kind === 'item' ? d.qty : 1;
      return;
    }
    if (d.kind === 'item') bag.items[d.itemId] = d.qty;
    else bag.gear.push(d.item);
  };
  for (const d of drops) {
    if (d.kind === 'gold') {
      bag.gold += d.amount;
      continue;
    }
    switch (filterAction(state.lootFilter.rules, d, content)) {
      case 'keep':
        toBag(d);
        break;
      case 'sell':
        bag.gold +=
          d.kind === 'gear'
            ? gearSellPrice(d.item, content)
            : content.items.get(d.itemId).sellPrice * d.qty;
        break;
      case 'disenchant':
        if (d.kind === 'gear')
          toBag({ kind: 'item', itemId: 'item.arcane_dust', qty: dustYield(d.item) });
        else toBag(d);
        break;
      case 'ignore':
        break;
    }
  }
}

/** Move the trip bag into the bank and stash. Gear that doesn't fit stays in the bag. */
export function bankBag(state: GameState, bag: TripBag, content: Content = CONTENT): void {
  addGold(state, bag.gold);
  bag.gold = 0;
  for (const [id, qty] of Object.entries(bag.items)) addItem(state, id, qty, content);
  bag.items = {};
  bag.gear = bag.gear.filter((item) => !addToStash(state, item));
}

export function emptyBag(): TripBag {
  return { gold: 0, items: {}, gear: [] };
}

export function pickZoneMonster(rng: Rng, zone: ZoneDef): string {
  return rng.weighted(zone.monsters.map((m) => ({ weight: m.weight, value: m.monsterId })));
}
