# Changelog

All notable changes to Atlas of Ash. Shown in-game under "What's new".

## [0.3.0] - 2026-11-16

### Added

- Five artisan skills: Smithing (bars, weapons, shields, heavy armour), Woodworking (planks, bows, crossbows, staves, wands, quivers), Tailoring (leather, cloth, light armour, robes, belts, foci), Jewelcrafting (cut gems, rings, amulets) and Enchanting.
- About 490 equipment bases: 12 weapon types and armour in armour, evasion, energy shield and hybrid variants, each in 10 material tiers.
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
