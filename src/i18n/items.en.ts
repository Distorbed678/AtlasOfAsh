/**
 * English names for Phase 3 content: materials, reagents, equipment bases,
 * uniques and crafting recipes. Generated from the content tables so every id
 * is covered.
 */
import { CONTENT } from '../engine/content';
import { BASE_MATERIAL } from '../engine/content/bases';
import {
  BAR_IDS,
  CLOTH_IDS,
  FIBRE_IDS,
  HIDE_IDS,
  INFUSIONS,
  LEATHER_IDS,
  PLANK_IDS,
  REAGENTS,
} from '../engine/content/materials';
import type { BaseItemDef, DefenceType } from '../engine/content/types';

const FIBRES = ['Flax', 'Hemp', 'Cotton', 'Jute', 'Silkgrass', 'Duskthread', 'Gravesilk', 'Sunfibre', 'Starthread', 'Wraithsilk'];
const HIDES = ['Rough Pelt', 'Wolf Pelt', 'Boar Hide', 'Bear Hide', 'Drake Hide', 'Duskstalker Hide', 'Gravehound Hide', 'Emberscale Hide', 'Voidbeast Hide', 'Wyrm Hide'];
const METALS = ['Copper', 'Bronze', 'Iron', 'Steel', 'Silver', 'Duskiron', 'Bloodsteel', 'Sunsteel', 'Voidforged', 'Aetherite'];
const WOODS = ['Pine', 'Oak', 'Birch', 'Maple', 'Yew', 'Gloamwood', 'Ironbark', 'Emberwood', 'Silverheart', 'Elderroot'];
const CLOTHS = ['Linen', 'Hemp Cloth', 'Cotton Cloth', 'Jute Cloth', 'Silkgrass Cloth', 'Duskweave', 'Gravesilk Cloth', 'Sunweave', 'Starweave', 'Wraithweave'];
const CLOTH_WORDS = ['Linen', 'Hempen', 'Cotton', 'Jute', 'Silkgrass', 'Duskweave', 'Gravesilk', 'Sunweave', 'Starweave', 'Wraithweave'];
const LEATHERS = ['Rough', 'Wolfhide', 'Boarhide', 'Bearhide', 'Drakeskin', 'Duskstalker', 'Gravehound', 'Emberscale', 'Voidbeast', 'Wyrmhide'];

const REAGENT_NAMES: Record<string, [string, string]> = {
  'item.spark_of_change': ['Spark of Change', 'Turns a plain item into a magic one.'],
  'item.ember_of_growth': ['Ember of Growth', 'Adds a new affix to a magic or rare item with room to spare.'],
  'item.kindled_heart': ['Kindled Heart', 'Upgrades a magic item to rare, adding an affix.'],
  'item.ashfall_powder': ['Ashfall Powder', 'Rerolls every affix on a magic or rare item.'],
  'item.tempering_oil': ['Tempering Oil', 'Rerolls the values of an item’s affixes within their tiers.'],
  'item.severing_salt': ['Severing Salt', 'Removes one random affix.'],
  'item.warding_wax': ['Warding Wax', 'Protects prefixes during a reroll.'],
  'item.binding_wax': ['Binding Wax', 'Protects suffixes during a reroll.'],
  'item.ashfire_brand': ['Ashfire Brand', 'Brands an item in Ashfire. Anything can happen, and the item can never be changed again.'],
};
const INFUSION_NAMES: Record<string, string> = {
  'item.infusion_vitality': 'Infusion of Vitality',
  'item.infusion_clarity': 'Infusion of Clarity',
  'item.infusion_fury': 'Infusion of Fury',
  'item.infusion_sorcery': 'Infusion of Sorcery',
  'item.infusion_embers': 'Infusion of Embers',
  'item.infusion_frost': 'Infusion of Frost',
  'item.infusion_storms': 'Infusion of Storms',
  'item.infusion_haste': 'Infusion of Haste',
  'item.infusion_ruin': 'Infusion of Ruin',
  'item.infusion_incantation': 'Infusion of Incantation',
};

const CLASS_NAMES: Record<string, string> = {
  mace: 'Mace', axe: 'Axe', sword: 'Sword', dagger: 'Dagger', claw: 'Claw', flail: 'Flail', sceptre: 'Sceptre',
  bow: 'Bow', crossbow: 'Crossbow', staff: 'Staff', quarterstaff: 'Quarterstaff', wand: 'Wand',
  shield: 'Shield', quiver: 'Quiver', focus: 'Focus', belt: 'Belt', ring: 'Ring', amulet: 'Amulet',
};
const ARMOUR_NAMES: Record<DefenceType, Record<'helmet' | 'body' | 'gloves' | 'boots', string>> = {
  ar: { helmet: 'Helm', body: 'Plate', gloves: 'Gauntlets', boots: 'Greaves' },
  ev: { helmet: 'Hood', body: 'Jerkin', gloves: 'Gloves', boots: 'Boots' },
  es: { helmet: 'Circlet', body: 'Robe', gloves: 'Wraps', boots: 'Slippers' },
  ar_ev: { helmet: 'Scale Helm', body: 'Scale Hauberk', gloves: 'Scale Gloves', boots: 'Scale Boots' },
  ar_es: { helmet: 'Crown', body: 'Vestment', gloves: 'Vambraces', boots: 'Sabatons' },
  ev_es: { helmet: 'Mask', body: 'Raiment', gloves: 'Bracers', boots: 'Shoes' },
};

function baseName(b: BaseItemDef): string {
  const i = b.tier - 1;
  const fam = BASE_MATERIAL[b.id];
  const word =
    fam === 'wood' ? WOODS[i] : fam === 'leather' ? LEATHERS[i] : fam === 'cloth' ? CLOTH_WORDS[i] : METALS[i];
  const kind =
    b.defenceType && (b.class === 'helmet' || b.class === 'body' || b.class === 'gloves' || b.class === 'boots')
      ? ARMOUR_NAMES[b.defenceType][b.class]
      : CLASS_NAMES[b.class];
  return `${word} ${kind}`;
}

const UNIQUE_TEXT: Record<string, [string, string]> = {
  'unique.oathbreaker': ['Oathbreaker', 'Forged to end a vow, and every bearer since has broken one.'],
  'unique.whisperwind': ['Whisperwind', 'Its string hums a note that only the target hears.'],
  'unique.shroud_last_lamp': ['Shroud of the Last Lamp', 'Woven by candlelight in the last lit house of a dead city.'],
  'unique.ring_of_cinders': ['Ring of Cinders', 'Warm on the finger. Warmer on everything you strike.'],
  'unique.bulwark_of_ash': ['Bulwark of Ash', 'The fire that made it is still trying to get out.'],
  'unique.wanderers_wraps': ['Wanderer’s Wraps', 'Patched a hundred times, and never once given up on.'],
};

const out: Record<string, string> = {};
const add = (key: string, name: string, desc?: string) => {
  out[key] = name;
  if (desc) out[`${key}.desc`] = desc;
};

FIBRE_IDS.forEach((id, i) => add(id, FIBRES[i]!, `Coarse plant fibre, ready to be woven into ${CLOTHS[i]!.toLowerCase()}.`));
HIDE_IDS.forEach((id, i) => add(id, HIDES[i]!, 'An untreated hide. Tan it before it starts to smell.'));
BAR_IDS.forEach((id, i) => add(id, `${METALS[i]} Bar`, `A bar of refined ${METALS[i]!.toLowerCase()}, ready for the forge.`));
PLANK_IDS.forEach((id, i) => add(id, `${WOODS[i]} Plank`, `Planed ${WOODS[i]!.toLowerCase()} timber, straight and true.`));
CLOTH_IDS.forEach((id, i) => add(id, CLOTHS[i]!, 'A bolt of woven cloth that holds a ward well.'));
LEATHER_IDS.forEach((id, i) => add(id, `${LEATHERS[i] === 'Rough' ? 'Rough' : LEATHERS[i]} Leather`, 'Tanned and supple; it turns a blade better than you would think.'));
add('item.cut_gem', 'Cut Gem', 'A faceted gem that catches the light. Jewellers set these into rings and amulets.');
add('item.arcane_dust', 'Arcane Dust', 'What is left of an item’s magic once it has been unmade.');
for (const r of REAGENTS) add(r.id, REAGENT_NAMES[r.id]![0], REAGENT_NAMES[r.id]![1]);
for (const r of INFUSIONS) add(r.id, INFUSION_NAMES[r.id]!, 'Makes an item rare and guarantees one specific kind of affix.');

for (const b of CONTENT.bases.all()) add(b.id, baseName(b));
for (const [id, [name, desc]] of Object.entries(UNIQUE_TEXT)) add(id, name, desc);

for (const a of CONTENT.actions.all()) {
  if (a.type !== 'craft') continue;
  const o = a.output;
  const target = o.kind === 'item' ? o.itemId : o.kind === 'gear' ? o.baseId : o.uniqueId;
  out[a.id] = out[target] ?? target;
}

export const itemsEn: Record<string, string> = {
  ...out,
  'skill.smithing': 'Smithing',
  'skill.woodworking': 'Woodworking',
  'skill.tailoring': 'Tailoring',
  'skill.jewelcrafting': 'Jewelcrafting',
  'skill.enchanting': 'Enchanting',
  'skill.smithing.desc': 'Smelt ore into bars, then forge weapons, shields and heavy armour.',
  'skill.woodworking.desc': 'Plane logs into planks, then craft bows, crossbows, staves, wands and quivers.',
  'skill.tailoring.desc': 'Tan hides and weave fibre, then sew light armour, robes, belts and foci.',
  'skill.jewelcrafting.desc': 'Cut gems and set them into rings and amulets.',
  'skill.enchanting.desc': 'Brew reagents from arcane dust, then use them to reshape the affixes on your gear.',
  ...Object.fromEntries(Object.entries(CLASS_NAMES).map(([k, v]) => [`baseclass.${k}`, v])),
  'baseclass.helmet': 'Helmet',
  'baseclass.body': 'Body armour',
  'baseclass.gloves': 'Gloves',
  'baseclass.boots': 'Boots',
  'defence.ar': 'Armour',
  'defence.ev': 'Evasion',
  'defence.es': 'Energy shield',
  'defence.ar_ev': 'Armour / Evasion',
  'defence.ar_es': 'Armour / Energy shield',
  'defence.ev_es': 'Evasion / Energy shield',
  'group.bars': 'Bars',
  'group.planks': 'Planks',
  'group.cloth': 'Cloth',
  'group.leather': 'Leather',
  'group.gems': 'Gems',
  'group.weapons': 'Weapons',
  'group.armour': 'Armour',
  'group.shields': 'Shields',
  'group.quivers': 'Quivers',
  'group.foci': 'Foci',
  'group.belts': 'Belts',
  'group.rings': 'Rings',
  'group.amulets': 'Amulets',
  'group.uniques': 'Uniques',
  'group.reagents': 'Reagents',
  'group.infusions': 'Infusions',
  'category.fibre': 'Fibre',
  'category.hide': 'Hide',
  'category.bar': 'Bar',
  'category.plank': 'Plank',
  'category.cloth': 'Cloth',
  'category.leather': 'Leather',
  'category.dust': 'Dust',
  'category.reagent': 'Reagent',
};
