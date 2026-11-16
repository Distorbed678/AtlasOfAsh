# Changelog

All notable changes to Atlas of Ash. Shown in-game under "What's new".

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
