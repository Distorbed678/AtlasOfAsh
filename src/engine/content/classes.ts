import type { ClassDef } from './types';

export const CLASSES: ClassDef[] = [
  { id: 'class.ironclad', attributes: ['str'], weapons: ['weapon.mace', 'weapon.axe'] },
  {
    id: 'class.vanguard',
    attributes: ['str', 'dex'],
    weapons: ['weapon.sword', 'weapon.crossbow'],
  },
  { id: 'class.skirmisher', attributes: ['dex'], weapons: ['weapon.bow', 'weapon.dagger'] },
  {
    id: 'class.adept',
    attributes: ['dex', 'int'],
    weapons: ['weapon.quarterstaff', 'weapon.claw'],
  },
  { id: 'class.arcanist', attributes: ['int'], weapons: ['weapon.staff', 'weapon.wand'] },
  { id: 'class.zealot', attributes: ['int', 'str'], weapons: ['weapon.sceptre', 'weapon.flail'] },
];
