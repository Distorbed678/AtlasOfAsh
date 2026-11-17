/** English names for Phase 4 content: zones, monsters, monster mods, flasks, uncut gems. */
import { FLASK_KINDS } from '../engine/content/flasks';

const FLASK_SIZES = [
  'Small',
  'Medium',
  'Large',
  'Greater',
  'Grand',
  'Giant',
  'Colossal',
  'Sacred',
  'Hallowed',
  'Divine',
];
const FLASK_NAMES: Record<string, string> = {
  life: 'Life Flask',
  mana: 'Mana Flask',
  granite: 'Granite Flask',
  swiftness: 'Swiftness Flask',
  warding: 'Warding Flask',
  cleansing: 'Cleansing Flask',
};

const flaskNames: Record<string, string> = {};
for (const kind of FLASK_KINDS) {
  FLASK_SIZES.forEach((size, i) => {
    const name = `${size} ${FLASK_NAMES[kind]}`;
    flaskNames[`base.${kind}_flask_t${i + 1}`] = name;
    flaskNames[`action.brew_${kind}_flask_t${i + 1}`] = name;
  });
}

const gems: Record<string, string> = {};
for (let t = 1; t <= 5; t++) {
  gems[`item.uncut_skill_gem_t${t}`] = `Uncut Skill Gem (Tier ${t})`;
  gems[`item.uncut_skill_gem_t${t}.desc`] =
    'A raw gem humming with a skill waiting to be shaped. Gemcutting can cut it (coming soon).';
  gems[`item.uncut_support_gem_t${t}`] = `Uncut Support Gem (Tier ${t})`;
  gems[`item.uncut_support_gem_t${t}.desc`] =
    'A raw gem that wants to strengthen another. Gemcutting can cut it (coming soon).';
}

export const combatEn: Record<string, string> = {
  ...flaskNames,
  ...gems,
  'skill.alchemy': 'Alchemy',
  'skill.alchemy.desc': 'Brew flasks from herbs, fish and minerals. Flasks refill as you fight.',
  'group.recoveryFlasks': 'Life & mana',
  'group.utilityFlasks': 'Utility',
  'baseclass.flask': 'Flask',

  'zone.ashfall_beach': 'Ashfall Beach',
  'zone.drowned_hamlet': 'Drowned Hamlet',
  'zone.saltmarsh': 'Saltmarsh',
  'zone.smugglers_caves': 'Smugglers’ Caves',
  'zone.blackened_woods': 'Blackened Woods',
  'zone.charcoal_ridge': 'Charcoal Ridge',
  'zone.hollow_lighthouse': 'The Hollow Lighthouse',
  'zone.ember_gate': 'The Ember Gate',
  'zone.ashfall_beach.desc': 'Grey surf washes over a beach of soot. Something still fishes here.',
  'zone.drowned_hamlet.desc': 'A village the tide took and gave back wrong.',
  'zone.saltmarsh.desc': 'Reeds, brine and things that wade.',
  'zone.smugglers_caves.desc': 'Tunnels that kept their secrets, and their smugglers.',
  'zone.blackened_woods.desc': 'A forest that burned and never quite stopped.',
  'zone.charcoal_ridge.desc': 'Wind-scoured hills of cinder and charred stone.',
  'zone.hollow_lighthouse.desc': 'The light went out long ago. The keeper did not leave.',
  'zone.ember_gate.desc': 'The way inland, guarded by whatever the fire left behind.',
  'act.1': 'Act 1 — The Cinder Coast',

  'monster.drowned_fisherman': 'Drowned Fisherman',
  'monster.sand_crawler': 'Sand Crawler',
  'monster.drowned_villager': 'Drowned Villager',
  'monster.bloated_corpse': 'Bloated Corpse',
  'monster.ash_wisp': 'Ash Wisp',
  'monster.marsh_brute': 'Marsh Brute',
  'monster.bog_crawler': 'Bog Crawler',
  'monster.cave_crawler': 'Cave Crawler',
  'monster.smuggler_ghoul': 'Smuggler Ghoul',
  'monster.tunnel_brute': 'Tunnel Brute',
  'monster.ember_wisp': 'Ember Wisp',
  'monster.cinder_wolf': 'Cinder Wolf',
  'monster.charred_stalker': 'Charred Stalker',
  'monster.ridge_brute': 'Ridge Brute',
  'monster.drowned_sailor': 'Drowned Sailor',
  'monster.storm_wisp': 'Storm Wisp',
  'monster.lighthouse_keeper': 'The Lighthouse Keeper',
  'monster.gate_brute': 'Gate Brute',

  'family.drowned': 'Drowned dead',
  'family.wisp': 'Ash wisps',
  'family.brute': 'Coastal brutes',
  'family.crawler': 'Crawlers',

  'monstermod.hulking': 'Hulking',
  'monstermod.armoured': 'Armoured',
  'monstermod.evasive': 'Evasive',
  'monstermod.hasted': 'Hasted',
  'monstermod.brutal': 'Brutal',
  'monstermod.fire_touched': 'Fire-touched',
  'monstermod.vampiric': 'Vampiric',
  'monstermod.warded': 'Warded',

  'building.waystone': 'Waystone',
  'building.waystone.desc': 'An attuned stone that sends your loot home while you fight.',
};
