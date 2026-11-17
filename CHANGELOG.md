# Changelog

All notable changes to Atlas of Ash. Shown in-game under "What's new".

## [0.5.0] - 2026-11-16

### Added

- Gems! 117 of them: 60 skill gems (36 weapon attacks, 12 spells, 6 minion skills, 3 curses, 2 warcries and a guard), 45 support gems and 12 spirit gems, in five tiers.
- Gemcutting, a new skill: cut uncut gems into any gem of the same kind, of the stone's tier or lower. Polish gems up to 20% quality and open up to five support sockets. Higher tiers need a higher Gemcutting level.
- Gems page: a skill bar with up to five slots (unlocking at character levels 1, 4, 12, 24 and 38). Each action, the first skill whose rule passes is used. Rules include "life below %", "enemy lacks its debuff" and "combo points at least".
- Support gems: socket them into skills to add damage, conversion, ailments, extra hits, charges, triggers and more. Each support can be used once per character.
- Spirit: +30 at character levels 10, 30 and 50, plus sceptres. Spirit gems (auras) and permanent minions reserve it.
- Endurance, frenzy and power charges (up to 3 each, 10 seconds), combo builders and finishers, curses, warcries, guards, and spells that trigger on critical hits or when you are hit.
- Minions: permanent ones that revive after 6 seconds, and summoned ones that last a few seconds. Monsters pick their target by threat.
- Gems in use level up to 20 as you kill monsters.
- Spirit gems now drop as uncut stones too.
- The combat screen shows the skill in use, charges, combo points, guard, buffs, curses and minions. Zone predictions account for your skill bar and minions.

### Changed

- Mana regenerates at 5% of maximum per second (was 2%), so skills can be sustained.

## [0.4.1] - 2026-11-16

### Changed

- Monsters drop half as much gear (about 10–12 pieces per hour early on).

## [0.4.0] - 2026-11-16

### Added

- Combat! Fight through Act 1, the Cinder Coast: 8 zones from Ashfall Beach to the Ember Gate, 18 monsters in four families (drowned dead, ash wisps, coastal brutes, crawlers), with magic and rare monsters carrying modifiers like Hulking, Hasted or Vampiric.
- Character levels from combat XP. Your class's life, mana and accuracy grow with level, and gear now has level requirements.
- Basic Attack with your weapon, and Basic Spell when you hold a wand, staff, sceptre or focus (costs mana).
- Ailments on monsters: ignite, bleed, poison, shock, chill and freeze.
- Alchemy: brew life, mana, granite, swiftness, warding and cleansing flasks in 10 tiers. Equip up to five, set when each is used, and they refill as you fight.
- Loot: gold, gear of the zone's tier, monster hides (leather tiers 2–10), Arcane Dust, Enchanting reagents and uncut gems (cut them once Gemcutting arrives).
- Trip bag (100 stacks): bank it any time (this restarts both attack timers), or build the new Waystone in the Town to auto-bank every 60 minutes.
- Loot filter: rules that keep, auto-sell, auto-disenchant or ignore drops before they reach your bag, with three presets.
- Zone predictions: kills, XP, gold and gear per hour, and how dangerous each zone is for you right now.
- Attempt to retreat: the more life you have, the better your odds.
- Death: Standard characters lose 10% of their level's XP and the trip bag. Hardcore characters move to Standard. Mortal characters are gone, remembered in a memorial on the character screen.
- Combat log, and combat results in the "While you were away" report.

## [0.3.0] - 2026-11-16

### Added

- Five artisan skills: Smithing (bars, weapons, shields, heavy armour), Woodworking (planks, bows, crossbows, staves, wands, quivers), Tailoring (leather, cloth, light armour, robes, belts, foci), Jewelcrafting (cut gems, rings, amulets) and Enchanting.
- 420 equipment bases: 12 weapon types and armour in armour, evasion, energy shield and hybrid variants, each in 10 material tiers.
- 41 affixes with 10 tiers each, gated by item level. Crafted gear is usually normal, with a small chance to come out magic or rare.
- Stash with tabs you can buy with gold; equip gear in ten slots (two-handed weapons, dual wielding, bows with quivers, attribute requirements).
- Enchanting: disenchant gear into Arcane Dust, brew reagents, then make magic, add affixes, upgrade to rare, reroll, reroll values, remove affixes, lock prefixes or suffixes, infuse a guaranteed affix, or gamble with the Ashen Brand.
- Six craftable uniques.
- Item cards show base stats, requirements, implicits and affixes with their tiers.
- The Codex now includes your gear and shows the DPS of a Basic Attack with your equipped weapon.
- Herbalism also gathers fibre, and pickpocketing turns up rough pelts.

### Changed

- Every character now starts with 10 Strength, 10 Dexterity and 10 Intelligence.

## [0.2.0] - 2026-11-16

### Added

- The Codex: a character sheet showing life, mana, Spirit, energy shield, attributes, defences, resistances (with caps and act penalties), recovery and offence. Select any stat to see exactly where every point comes from.
- Class starting stats: each class now has its own life, mana, energy shield and Spirit, growing with level.
- The full damage and defence engine behind combat: added damage, conversion, gain-as-extra, increased vs more, crits, attack/cast speed, accuracy vs evasion, armour by hit size, resistances and penetration, leech, and threshold-based ailments (ignite, shock, chill, freeze; bleed and poison by chance).
- Dev test bench in the Codex (with `?flags=devTools`): add any modifier, choose a test skill and target dummy, and see the full calculation.

## [0.1.1] - 2026-11-16

### Added

- Icons from game-icons.net for skills, items (tinted by tier), buildings and navigation, with a Credits page.
- Action cards show XP/hour, items or gold per hour, and time to your next level.
- Mastery bonuses breakdown on every action card.
- Skill pages show your next unlock and roughly how long it will take.
- Sidebar XP bars, plus a toast and sidebar flash when a skill levels up.
- Flavour text for every item.
- Fishing spots now also catch junk (driftwood, boots, nets) and the occasional pearl.

### Changed

- Skill XP is 1.5× slower across the board (level 99 takes roughly two weeks of non-stop idling per skill).

## [0.1.0] - 2026-11-16

### Added

- Characters: create as many as you like, each with a name, class (Ironclad, Vanguard, Skirmisher, Adept, Arcanist, Zealot) and mode (Standard, Hardcore, Mortal). Every character is fully separate and catches up its own offline time when you load it.
- Five skills with 10 tiers each: Mining (veins run dry and respawn), Woodcutting, Herbalism (herb bundles), Fishing (catch tables) and Thieving (stealth vs perception; failing stuns you).
- Mastery for every action, plus a mastery pool with skill-wide bonuses at 10/25/50/95%. Pool XP can be spent to level an action you care about.
- Rare finds while gathering: gem fragments, seed pods, wild seeds and sunken caches (open them for gold and materials).
- Town: Guild Hall, Workshop, Training Yard and Vault, built with gold and gathered materials.
- Workers: hire hands to repeat any unlocked action for gold per hour. They work slower than you, share some XP, and pause if you run out of gold.
- Bank: limited slots (grow them with the Vault), search, sorting, item locks, custom tabs and a sell-quantity picker.
- The "While you were away" report now shows XP, level-ups, gold, wages and items.

### Removed

- The Phase 0 demo actions. Old demo saves are converted into a character named "Wanderer".

## [0.0.1] - 2026-11-16

### Added

- Foundation build: event-driven simulation engine that runs in a background worker.
- Full offline progress: close the game and every second you were away is simulated on return.
- Saving to your browser, compressed export/import strings, and 5 rolling automatic backups.
- Crash protection: the game saves and offers an export string if something breaks.
- Debug bundle download for bug reports.
- Two demo actions (Kindle Embers, Sift the Ash) and a bank to test the loop.
