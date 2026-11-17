import { CONTENT, type Content } from '../content';
import { FLASK_SLOTS, type BaseItemDef, type EquipSlot } from '../content/types';
import { computeCharacter, type CharacterSheet } from '../stats/character';
import type { GameState } from '../state';
import { equipmentMods } from './itemStats';
import type { ItemInstance } from './types';
import { characterLevel } from '../combat/progression';

const ONE_HANDED_OFFHAND_CLASSES = new Set([
  'mace',
  'axe',
  'sword',
  'dagger',
  'claw',
  'flail',
  'sceptre',
  'wand',
]);

/** Equipment slots a base can go in. */
export function slotsFor(base: BaseItemDef): EquipSlot[] {
  switch (base.class) {
    case 'shield':
    case 'quiver':
    case 'focus':
      return ['offHand'];
    case 'helmet':
    case 'body':
    case 'gloves':
    case 'boots':
    case 'belt':
    case 'amulet':
      return [base.class];
    case 'ring':
      return ['ring1', 'ring2'];
    case 'flask':
      return [...FLASK_SLOTS];
    default:
      // Weapons: main hand; one-handed weapons may also be dual-wielded in the off hand.
      return ONE_HANDED_OFFHAND_CLASSES.has(base.class) ? ['mainHand', 'offHand'] : ['mainHand'];
  }
}

/** The character sheet for this state (character level from combat XP, equipped gear). */
export function sheetFor(
  state: GameState,
  equipment = state.equipment,
  labelFor: (item: ItemInstance) => string = (i) => i.baseId,
  content: Content = CONTENT,
): CharacterSheet {
  return computeCharacter(
    {
      classId: state.character.classId,
      level: characterLevel(state.charXp),
      mods: equipmentMods(equipment, labelFor, content),
    },
    content,
  );
}

/**
 * Why `item` can't go in `slot`, or null if it can. Attribute requirements are
 * checked against the character without whatever the item would replace.
 */
export function equipProblem(
  state: GameState,
  item: ItemInstance,
  slot: EquipSlot,
  content: Content = CONTENT,
): string | null {
  const base = content.bases.get(item.baseId);
  if (!slotsFor(base).includes(slot)) return 'That item does not fit in this slot';
  const main = state.equipment.mainHand ? content.bases.get(state.equipment.mainHand.baseId) : null;
  if (slot === 'offHand' && main?.twoHanded) {
    const quiverOk = (main.class === 'bow' || main.class === 'crossbow') && base.class === 'quiver';
    if (!quiverOk) return 'Your main-hand weapon is two-handed';
  }
  if (
    slot === 'offHand' &&
    base.class === 'quiver' &&
    main &&
    main.class !== 'bow' &&
    main.class !== 'crossbow'
  )
    return 'Quivers need a bow or crossbow';
  const without = { ...state.equipment };
  delete without[slot];
  if (slot === 'mainHand' && base.twoHanded) delete without.offHand;
  const sheet = sheetFor(state, without, undefined, content);
  const have = { str: sheet.str.total, dex: sheet.dex.total, int: sheet.int.total };
  const level = characterLevel(state.charXp);
  if (base.levelReq > level) return `Requires level ${base.levelReq} (you are ${level})`;
  for (const a of ['str', 'dex', 'int'] as const) {
    if (base.req[a] > have[a])
      return `Requires ${base.req[a]} ${a.toUpperCase()} (you have ${Math.floor(have[a])})`;
  }
  return null;
}

/** Items that must be removed to equip `item` in `slot` (the slot's item, and the off hand for 2H). */
export function displacedBy(
  state: GameState,
  item: ItemInstance,
  slot: EquipSlot,
  content: Content = CONTENT,
): EquipSlot[] {
  const base = content.bases.get(item.baseId);
  const out: EquipSlot[] = [];
  if (state.equipment[slot]) out.push(slot);
  if (slot === 'mainHand' && base.twoHanded && state.equipment.offHand) {
    const off = content.bases.get(state.equipment.offHand.baseId);
    const keepQuiver =
      (base.class === 'bow' || base.class === 'crossbow') && off.class === 'quiver';
    if (!keepQuiver) out.push('offHand');
  }
  return out;
}
