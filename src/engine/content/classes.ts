import type { ClassBase, ClassDef } from './types';

const base = (
  life: number,
  lifePerLevel: number,
  mana: number,
  manaPerLevel: number,
  extra: Partial<Pick<ClassBase, 'spirit' | 'energyShield'>> = {},
): ClassBase => ({
  life,
  lifePerLevel,
  mana,
  manaPerLevel,
  spirit: extra.spirit ?? 0,
  energyShield: extra.energyShield ?? 0,
});

export const CLASSES: ClassDef[] = [
  {
    id: 'class.ironclad',
    base: base(70, 14, 30, 3),
    attributes: ['str'],
    weapons: ['weapon.mace', 'weapon.axe'],
  },
  {
    id: 'class.vanguard',
    base: base(60, 13, 35, 3.5),
    attributes: ['str', 'dex'],
    weapons: ['weapon.sword', 'weapon.crossbow'],
  },
  {
    id: 'class.skirmisher',
    base: base(50, 12, 40, 4),
    attributes: ['dex'],
    weapons: ['weapon.bow', 'weapon.dagger'],
  },
  {
    id: 'class.adept',
    base: base(45, 11, 45, 4.5, { energyShield: 20 }),
    attributes: ['dex', 'int'],
    weapons: ['weapon.quarterstaff', 'weapon.claw'],
  },
  {
    id: 'class.arcanist',
    base: base(40, 10, 60, 6, { energyShield: 20 }),
    attributes: ['int'],
    weapons: ['weapon.staff', 'weapon.wand'],
  },
  {
    id: 'class.zealot',
    base: base(55, 12, 45, 4.5, { spirit: 30 }),
    attributes: ['int', 'str'],
    weapons: ['weapon.sceptre', 'weapon.flail'],
  },
];
