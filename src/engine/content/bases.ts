import { BAR_IDS, CLOTH_IDS, CUT_GEM, LEATHER_IDS, MATERIAL_ITEMS, PLANK_IDS } from './materials';
import type {
  Attribute,
  BaseClass,
  BaseItemDef,
  DefenceType,
  ModTemplate,
  SkillId,
  WeaponClass,
} from './types';

/**
 * Equipment bases: one per material tier (1-10) for every weapon class and
 * armour piece, generated from templates. Each base also has a crafting spec.
 */
const tiers = [...Array(10).keys()];
const DMG_MULT = [1, 1.7, 2.5, 3.4, 4.5, 5.8, 7.2, 8.8, 10.6, 12.5];
const DEF_MULT = [1, 1.8, 2.8, 4, 5.4, 7, 8.8, 10.8, 13, 15.5];

/** Requirement for tier i: pure 8 + 12i; each attribute of a hybrid 6 + 9i. */
function req(attrs: readonly Attribute[], i: number): Record<Attribute, number> {
  const r: Record<Attribute, number> = { str: 0, dex: 0, int: 0 };
  const v = attrs.length > 1 ? 6 + 9 * i : 8 + 12 * i;
  for (const a of attrs) r[a] = v;
  return r;
}

export interface CraftSpec {
  skillId: SkillId;
  group: string;
  /** Material families per tier: bar / plank / cloth / leather / gem counts. */
  mats: Partial<Record<'bar' | 'plank' | 'cloth' | 'leather' | 'gem', number>>;
}

function inputsFor(spec: CraftSpec, i: number): Record<string, number> {
  const inputs: Record<string, number> = {};
  const fam = { bar: BAR_IDS, plank: PLANK_IDS, cloth: CLOTH_IDS, leather: LEATHER_IDS };
  for (const [k, n] of Object.entries(spec.mats)) {
    if (!n) continue;
    const id = k === 'gem' ? CUT_GEM : fam[k as keyof typeof fam][i]!;
    inputs[id] = (inputs[id] ?? 0) + n;
  }
  return inputs;
}

interface WeaponTemplate {
  cls: WeaponClass;
  phys: [number, number];
  aps: number;
  crit: number;
  attrs: Attribute[];
  twoHanded: boolean;
  ranged: boolean;
  spellWeapon: boolean;
  implicit?: (i: number) => ModTemplate[];
  craft: CraftSpec;
}

const SMITH = (group: string, mats: CraftSpec['mats']): CraftSpec => ({
  skillId: 'skill.smithing',
  group,
  mats,
});
const WOOD = (group: string, mats: CraftSpec['mats']): CraftSpec => ({
  skillId: 'skill.woodworking',
  group,
  mats,
});
const TAILOR = (group: string, mats: CraftSpec['mats']): CraftSpec => ({
  skillId: 'skill.tailoring',
  group,
  mats,
});
const JEWEL = (group: string, mats: CraftSpec['mats']): CraftSpec => ({
  skillId: 'skill.jewelcrafting',
  group,
  mats,
});

const spellDamage =
  (base: number, per: number) =>
  (i: number): ModTemplate[] => [
    { stat: 'damage', kind: 'increased', value: base + per * i, tags: ['spell'] },
  ];

const WEAPONS: WeaponTemplate[] = [
  {
    cls: 'mace',
    phys: [6, 12],
    aps: 1.2,
    crit: 5,
    attrs: ['str'],
    twoHanded: false,
    ranged: false,
    spellWeapon: false,
    craft: SMITH('weapons', { bar: 3 }),
  },
  {
    cls: 'axe',
    phys: [5, 14],
    aps: 1.25,
    crit: 5,
    attrs: ['str'],
    twoHanded: false,
    ranged: false,
    spellWeapon: false,
    craft: SMITH('weapons', { bar: 3 }),
  },
  {
    cls: 'sword',
    phys: [5, 11],
    aps: 1.4,
    crit: 5,
    attrs: ['str', 'dex'],
    twoHanded: false,
    ranged: false,
    spellWeapon: false,
    craft: SMITH('weapons', { bar: 3 }),
  },
  {
    cls: 'dagger',
    phys: [3, 9],
    aps: 1.5,
    crit: 7,
    attrs: ['dex', 'int'],
    twoHanded: false,
    ranged: false,
    spellWeapon: false,
    craft: SMITH('weapons', { bar: 2 }),
  },
  {
    cls: 'claw',
    phys: [4, 8],
    aps: 1.6,
    crit: 6.5,
    attrs: ['dex', 'int'],
    twoHanded: false,
    ranged: false,
    spellWeapon: false,
    craft: SMITH('weapons', { bar: 2 }),
  },
  {
    cls: 'flail',
    phys: [4, 13],
    aps: 1.3,
    crit: 5,
    attrs: ['str', 'int'],
    twoHanded: false,
    ranged: false,
    spellWeapon: false,
    craft: SMITH('weapons', { bar: 3 }),
  },
  {
    cls: 'sceptre',
    phys: [5, 9],
    aps: 1.25,
    crit: 6,
    attrs: ['int', 'str'],
    twoHanded: false,
    ranged: false,
    spellWeapon: true,
    implicit: (i) => [{ stat: 'spirit', kind: 'flat', value: 8 + 3 * i }],
    craft: SMITH('weapons', { bar: 3, gem: 1 }),
  },
  {
    cls: 'bow',
    phys: [6, 16],
    aps: 1.2,
    crit: 6,
    attrs: ['dex'],
    twoHanded: true,
    ranged: true,
    spellWeapon: false,
    craft: WOOD('weapons', { plank: 4 }),
  },
  {
    cls: 'crossbow',
    phys: [10, 20],
    aps: 0.9,
    crit: 5,
    attrs: ['str', 'dex'],
    twoHanded: true,
    ranged: true,
    spellWeapon: false,
    craft: WOOD('weapons', { plank: 3, bar: 1 }),
  },
  {
    cls: 'staff',
    phys: [7, 14],
    aps: 1.15,
    crit: 7,
    attrs: ['int'],
    twoHanded: true,
    ranged: false,
    spellWeapon: true,
    implicit: spellDamage(10, 3),
    craft: WOOD('weapons', { plank: 4 }),
  },
  {
    cls: 'quarterstaff',
    phys: [6, 13],
    aps: 1.4,
    crit: 6,
    attrs: ['dex', 'int'],
    twoHanded: true,
    ranged: false,
    spellWeapon: false,
    craft: WOOD('weapons', { plank: 4 }),
  },
  {
    cls: 'wand',
    phys: [3, 6],
    aps: 1.4,
    crit: 7,
    attrs: ['int'],
    twoHanded: false,
    ranged: true,
    spellWeapon: true,
    implicit: spellDamage(6, 2),
    craft: WOOD('weapons', { plank: 2, gem: 1 }),
  },
];

type ArmourSlot = 'helmet' | 'body' | 'gloves' | 'boots';
const ARMOUR_SLOTS: ArmourSlot[] = ['helmet', 'body', 'gloves', 'boots'];
const SLOT_DEF: Record<ArmourSlot, { ar: number; ev: number; es: number; mats: number }> = {
  helmet: { ar: 12, ev: 12, es: 5, mats: 3 },
  body: { ar: 30, ev: 30, es: 12, mats: 6 },
  gloves: { ar: 8, ev: 8, es: 3, mats: 2 },
  boots: { ar: 8, ev: 8, es: 3, mats: 2 },
};
const DEFENCE_TYPES: DefenceType[] = ['ar', 'ev', 'es', 'ar_ev', 'ar_es', 'ev_es'];
const DEF_ATTR: Record<'ar' | 'ev' | 'es', Attribute> = { ar: 'str', ev: 'dex', es: 'int' };
const DEF_TAG: Record<'ar' | 'ev' | 'es', string> = {
  ar: 'armourBase',
  ev: 'evasionBase',
  es: 'esBase',
};
const DEF_MAT: Record<'ar' | 'ev' | 'es', 'bar' | 'leather' | 'cloth'> = {
  ar: 'bar',
  ev: 'leather',
  es: 'cloth',
};

function armourCraft(slot: ArmourSlot, type: DefenceType): CraftSpec {
  const parts = type.split('_') as ('ar' | 'ev' | 'es')[];
  const n = SLOT_DEF[slot].mats;
  const mats: CraftSpec['mats'] = {};
  if (parts.length === 1) mats[DEF_MAT[parts[0]!]] = n;
  else {
    mats[DEF_MAT[parts[0]!]] = Math.ceil(n / 2);
    mats[DEF_MAT[parts[1]!]] = Math.max(1, Math.floor(n / 2));
  }
  // Made by the skill of the primary defence (armour → Smithing, else Tailoring).
  const craft = parts[0] === 'ar' ? SMITH : TAILOR;
  return craft('armour', mats);
}

export const BASES: BaseItemDef[] = [];
export const BASE_CRAFT: Record<string, CraftSpec> = {};
/** baseId → material word index family for naming: 'metal' | 'wood' | 'leather' | 'cloth'. */
export const BASE_MATERIAL: Record<string, 'metal' | 'wood' | 'leather' | 'cloth'> = {};

const priceOf = (inputs: Record<string, number>) =>
  Math.ceil(
    Object.entries(inputs).reduce(
      (s, [id, q]) => s + (MATERIAL_ITEMS.find((m) => m.id === id)?.sellPrice ?? 0) * q,
      0,
    ) * 1.3,
  );

function push(
  def: Omit<BaseItemDef, 'sellPrice'>,
  craft: CraftSpec,
  material: 'metal' | 'wood' | 'leather' | 'cloth',
) {
  const i = def.tier - 1;
  BASES.push({ ...def, sellPrice: priceOf(inputsFor(craft, i)) });
  BASE_CRAFT[def.id] = craft;
  BASE_MATERIAL[def.id] = material;
}

for (const w of WEAPONS) {
  for (const i of tiers) {
    const m = DMG_MULT[i]!;
    push(
      {
        id: `base.${w.cls}_t${i + 1}`,
        class: w.cls,
        tier: i + 1,
        twoHanded: w.twoHanded || undefined,
        weapon: {
          phys: [Math.round(w.phys[0] * m), Math.round(w.phys[1] * m)],
          attacksPerSecond: w.aps,
          critChance: w.crit,
        },
        implicits: w.implicit?.(i) ?? [],
        req: req(w.attrs, i),
        tags: [
          w.cls,
          'weapon',
          'attackWeapon',
          w.ranged ? 'ranged' : 'melee',
          w.twoHanded ? 'twohand' : 'onehand',
          ...(w.spellWeapon ? ['spellWeapon'] : []),
        ],
      },
      w.craft,
      w.craft.skillId === 'skill.woodworking' ? 'wood' : 'metal',
    );
  }
}

for (const slot of ARMOUR_SLOTS) {
  for (const type of DEFENCE_TYPES) {
    const parts = type.split('_') as ('ar' | 'ev' | 'es')[];
    const scale = parts.length > 1 ? 0.6 : 1;
    const craft = armourCraft(slot, type);
    for (const i of tiers) {
      const m = DEF_MULT[i]! * scale;
      const d = SLOT_DEF[slot];
      push(
        {
          id: `base.${slot}_${type}_t${i + 1}`,
          class: slot,
          tier: i + 1,
          defence: {
            armour: parts.includes('ar') ? Math.round(d.ar * m) : undefined,
            evasion: parts.includes('ev') ? Math.round(d.ev * m) : undefined,
            energyShield: parts.includes('es') ? Math.round(d.es * m) : undefined,
          },
          defenceType: type,
          implicits: [],
          req: req(
            parts.map((p) => DEF_ATTR[p]),
            i,
          ),
          tags: [slot, 'armourPiece', ...parts.map((p) => DEF_TAG[p])],
        },
        craft,
        parts[0] === 'ar' ? 'metal' : parts[0] === 'ev' ? 'leather' : 'cloth',
      );
    }
  }
}

const OTHER: {
  cls: BaseClass;
  make: (i: number) => Partial<BaseItemDef>;
  attrs: Attribute[];
  tags: string[];
  craft: CraftSpec;
  material: 'metal' | 'wood' | 'leather' | 'cloth';
}[] = [
  {
    cls: 'shield',
    make: (i) => ({ defence: { armour: Math.round(15 * DEF_MULT[i]!), block: 20 + i } }),
    attrs: ['str'],
    tags: ['shield', 'offhand', 'armourBase'],
    craft: SMITH('shields', { bar: 4 }),
    material: 'metal',
  },
  {
    cls: 'quiver',
    make: (i) => ({ implicits: [{ stat: 'accuracy', kind: 'flat', value: 10 + 15 * i }] }),
    attrs: ['dex'],
    tags: ['quiver', 'offhand'],
    craft: WOOD('quivers', { plank: 3 }),
    material: 'wood',
  },
  {
    cls: 'focus',
    make: (i) => ({ defence: { energyShield: Math.round(8 * DEF_MULT[i]!) } }),
    attrs: ['int'],
    tags: ['focus', 'offhand', 'esBase', 'spellWeapon'],
    craft: TAILOR('foci', { cloth: 3 }),
    material: 'cloth',
  },
  {
    cls: 'belt',
    make: (i) => ({ implicits: [{ stat: 'life', kind: 'flat', value: 10 + 8 * i }] }),
    attrs: [],
    tags: ['belt'],
    craft: TAILOR('belts', { leather: 2 }),
    material: 'leather',
  },
  {
    cls: 'ring',
    make: (i) => ({
      implicits: (['fire', 'cold', 'lightning'] as const).map((r) => ({
        stat: `resist.${r}` as const,
        kind: 'flat' as const,
        value: Math.round(3 + 1.5 * i),
      })),
    }),
    attrs: [],
    tags: ['ring', 'jewellery'],
    craft: JEWEL('rings', { bar: 2, gem: 1 }),
    material: 'metal',
  },
  {
    cls: 'amulet',
    make: (i) => ({
      implicits: (['str', 'dex', 'int'] as const).map((a) => ({
        stat: a,
        kind: 'flat' as const,
        value: 5 + 2 * i,
      })),
    }),
    attrs: [],
    tags: ['amulet', 'jewellery'],
    craft: JEWEL('amulets', { bar: 3, gem: 2 }),
    material: 'metal',
  },
];

for (const o of OTHER) {
  for (const i of tiers) {
    const extraGems = o.cls === 'ring' || o.cls === 'amulet' ? Math.floor(i / 3) : 0;
    const craft: CraftSpec = {
      ...o.craft,
      mats: { ...o.craft.mats, ...(extraGems ? { gem: (o.craft.mats.gem ?? 0) + extraGems } : {}) },
    };
    push(
      {
        id: `base.${o.cls}_t${i + 1}`,
        class: o.cls,
        tier: i + 1,
        implicits: [],
        req: req(o.attrs, i),
        tags: o.tags,
        ...o.make(i),
      },
      craft,
      o.material,
    );
  }
}

export function baseInputs(baseId: string): Record<string, number> {
  const def = BASES.find((b) => b.id === baseId);
  if (!def) throw new Error(`Unknown base ${baseId}`);
  return inputsFor(BASE_CRAFT[baseId]!, def.tier - 1);
}
