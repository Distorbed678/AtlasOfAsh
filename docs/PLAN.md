# Atlas of Ash — Game Plan

An idle/incremental game with Melvor-style skilling and one-action-at-a-time play, combined with Path of Exile-depth buildcrafting (PoE2-style gems and passive tree, PoE-style damage math and itemisation).

All names, lore, classes, items and art are **original**. We borrow *mechanical genres* (affixes, support gems, a shared passive tree), never PoE/Melvor names, assets or text.

---

## 1. Locked design decisions

### 1.1 Core
| Area | Decision |
|---|---|
| Name | **Atlas of Ash** |
| Tech | TypeScript + Vite + React UI; pure-TS simulation core; Web Worker sim |
| Distribution | Browser PWA on **GitHub Pages** (auto-deployed from `main`); Tauri desktop (Steam-ready) later |
| Repo / workflow | Public GitHub repo `Distorbed678/AtlasOfAsh`; **one branch per phase**, **one commit per feature**; Pages deploys every push to `main` |
| Saves | IndexedDB + export/import strings now; optional cloud sync later |
| Content | Fully data-driven and validated, so mod support can be added later |
| Audio | **None** |
| Lore | Light lore, strong mood: grim burned-out world, flavour text, short act intros, little dialogue |
| Onboarding | Everything open from the start, plus an **optional** step-by-step tutorial |
| Pacing | Long-haul idle: about 2–3 weeks to the Atlas, 2–3 months to char 100, 1–2 months per skill 99, about a year to max all skills |

### 1.2 Characters and modes
| Area | Decision |
|---|---|
| Account model | **Fully per-character, nothing shared.** Each character has its own skills, bank, gold, Town, workers, stash and completion log. Several characters are allowed; one is played at a time |
| Realms | Each character is created in Standard, Hardcore, or a League |
| Hardcore | Mode chosen per character at creation: **Hardcore** (on death, moves to Standard) or **Mortal** (on death, deleted; a memorial record remains) |
| Leagues | Framework built; the **first league mechanic is decided later** |
| Trade | SSF only; NPC Exchange + vendor recipes |
| Softcore death | Lose a % of current-level XP + the trip bag contents since the last bank |
| Level caps | Character 1–100. Skills 1–99 at launch, then **99 → 120** unlocked through Atlas progress |
| Completion | Completion log (items, monsters, uniques, mastery, maps). **No gameplay bonuses** |

### 1.3 Skilling and workers
| Area | Decision |
|---|---|
| Parallelism | One player action at a time, plus hired workers |
| Workers | Hired per skill for **gold per hour**, scaled by skill tier and level. Base ~30% efficiency, raised by Town upgrades. Town level limits slots. Workers **pause** when gold runs out. They grant resources + **10% of the normal XP** (Town can raise it) |
| Mastery | Melvor-like: per-action mastery 1–99 + a skill-wide mastery pool with bonuses at 10/25/50/95% |
| Skills | Gathering: Mining, Woodcutting, Herbalism, Fishing · Artisan: Smithing, Tailoring, Woodworking, Jewelcrafting, Alchemy, **Cooking**, Enchanting · Build support: Gemcutting, Runecraft, Cartography · Utility: Thieving, Farming, Agility, Astrology. **Summoning removed.** |
| Skills that boost combat | Agility (global bonuses), Astrology (rerollable constellation bonuses), Cooking (timed meal buffs) |
| Farming | Real-time plots that grow while you do other actions. Herbs go to Alchemy, crops to Cooking, rare trees to Enchanting |
| Town | List of ~15 buildings with 5–10 tiers each, bought with gold + materials |
| Automation | **Unlockable action queue** (Scribe building) whose length grows with upgrades |
| Loot filter | **Rule-based** (rarity, base, item level, mod tiers, has-mod). Actions: keep / auto-sell / auto-disenchant / ignore. Starter presets included |
| Random events | **None.** Outcomes are fully predictable to optimise |

### 1.4 Combat
| Area | Decision |
|---|---|
| Format | **Melvor-style 1v1 duel.** No AoE/chain/pierce stats. **No respawn timer:** the next monster arrives the instant the last one dies. Clear speed = time to kill |
| Hit model | Accuracy vs evasion, resolved **deterministically with an entropy counter**. Spells always hit but can be blocked or suppressed |
| Damage math | Full PoE-style model (§3.3) |
| Rotation | Priority list of up to ~5 actives with simple conditions, plus persistent buffs reserving **Spirit** |
| PoE2 systems | Spirit, endurance/frenzy/power charges, combos → finishers, minions as a build |
| Minions | **Threat-weighted targeting:** the monster picks a target weighted by threat; taunt/guardian effects raise threat |
| Sustain | **5 flask slots** (life/mana + utility); charges from kills and hits; per-flask auto-use rules; build sustain (leech, regen, recoup, ES recharge) |
| Trip bag | Limited bag (~100 stacks, upgradeable). Banks when combat stops or on the **Waystone auto-bank interval** (Town shortens it) |
| Bosses | **Scripted, telegraphed mechanics that need counters** (resist checks, specific utility flasks, phase immunities) |
| Info | **Fully transparent:** drop tables, rates and monster stats shown; the build panel predicts kills/h, death risk and loot/h for a chosen zone |

### 1.5 Build system
| Area | Decision |
|---|---|
| Classes | 6 classes, one per tree start: **Ironclad** (Str), **Vanguard** (Str/Dex), **Skirmisher** (Dex), **Adept** (Dex/Int), **Arcanist** (Int), **Zealot** (Int/Str) |
| Weapons | 2 weapon types per class, **soft lock**: any weapon can be used, but the start area, ascendancies and starting gems favour the class's two |
| Ascendancies | 4 per class (24 total). **Picked at the first trial**; swapping costs gold + re-running a trial |
| Passive tree | PoE2-style shared tree, **~1,500 nodes, 100 points total**. Attribute-choice nodes, notables, **keystones, choice notables (pick 1 of 3), cluster-style jewels, timeless-style jewels** |
| Respec | Gold per refunded point, scaling with level; a full reset costs a rare **Unmaking Shard** |
| Gems | Uncut gems drop → **Gemcutting** turns each into a chosen skill/support/spirit gem, and raises its level, quality and support slots (up to 5). Minion gem upgrades also come from Gemcutting |
| Support limits | **Each support gem may be socketed once per character** (across all skills) |
| Gear slots | Main hand, off hand, helmet, body, gloves, boots, belt, amulet, 2 rings, 5 flasks; jewels in tree sockets |
| Items | Random prefix/suffix affixes with tiers gated by item level; Normal/Magic/Rare/Unique; crafting via skills (artisan skill makes the base, **Enchanting** adds or rerolls mods) |
| Uniques | Mostly **drops** (shown in drop tables), plus some **artisan recipes** that use boss materials |
| Corruption | **Ashen Brand:** a one-shot random final-state craft (extra implicit, tier upgrade, reroll, brick, or nothing) for items **and gems**; the result can never be modified again |
| Build tool | **Codex** panel (Path of Building-style): DPS, effective HP, every modifier source, what-if previews on hover |
| Sharing | **Build codes:** export/import the tree, gems and gear summary |

### 1.6 Endgame and economy
| Area | Decision |
|---|---|
| Endgame | Atlas + dungeons + bounties (Slayer-style) |
| Atlas | **Procedural, infinite**, seeded node graph with biome regions, region bosses and special nodes; Atlas passive tree |
| Map sustain | Maps drop from maps (same or next tier) + **Cartography** crafts maps from shards and adds map mods |
| Economy | **Gold** (workers, Town, respec, Exchange) + separate crafting currencies |
| Exchange | **Prices drift** with your own buying and selling (mean-reverting) + **limited daily stock** of rare reagents |

### 1.7 UX
| Area | Decision |
|---|---|
| Style | Dark ARPG panel UI (Melvor-like sidebar), coloured-mod tooltips, zoomable canvas tree, CC-licensed placeholder icons (game-icons.net, credited) |
| Layout | **Desktop-first, mobile-friendly** (responsive; playable as a PWA on phones) |
| Notifications | Browser/desktop notifications: level up, bag full, workers paused, farm plot ready, death, queue finished |

---

## 2. Classes

| Start | Class | Weapon types | Ascendancy directions (4 each — names TBD in Phase 7) |
|---|---|---|---|
| Str | **Ironclad** | Maces, Axes | unbreakable tank · berserk rage · slam/tremor · warcry/banner |
| Str/Dex | **Vanguard** | Swords, Crossbows | bleed duelist · bolt artillery · armour-break · dual-wield tempo |
| Dex | **Skirmisher** | Bows, Daggers | crit assassin · poison · traps/ambush · beast companion (minion) |
| Dex/Int | **Adept** | Quarterstaves, Claws | combo/finisher · elemental fists · evasion/ES hybrid · charge stacker |
| Int | **Arcanist** | Staves, Wands | fire/ignite · cold/freeze · lightning/shock · arcane (mana/ES) |
| Int/Str | **Zealot** | Sceptres, Flails | necromantic minions · aura/Spirit stacker · chaos DoT · holy guardian |

---

## 3. Systems design

### 3.1 Skills

Every skill has levels 1–99 (→ 120 later), per-action mastery, and a mastery pool. All skills are per character.

- **Mining:** ores and gem fragments. **Woodcutting:** logs and resins. **Herbalism:** wild herbs and reagents. **Fishing:** fish for Cooking, oils for Alchemy and Enchanting.
- **Smithing:** armour and metal weapon bases. **Tailoring:** leather and cloth bases (evasion/ES). **Woodworking:** bows, staves, quivers, shields. **Jewelcrafting:** rings, amulets, jewels (including cluster jewels at high level).
- **Alchemy:** flasks, flask affixes, flask upgrades. **Cooking:** meals that grant timed buffs (one meal active at a time).
- **Enchanting:** applies, rerolls, upgrades and locks affixes using reagents; also performs Ashen Brand. Success chance and the tier ceiling scale with level.
- **Gemcutting:** cuts uncut gems; raises gem level and quality, adds support slots, upgrades minions.
- **Runecraft:** runes → Enchanting reagents, jewel inscriptions, Atlas keys.
- **Cartography:** makes maps from shards; adds or rerolls map mods.
- **Thieving:** gold and rare items from NPC targets (with a stun/fail mechanic).
- **Farming:** timed plots (20 min – 8 h); compost improves yield.
- **Agility:** obstacle course built from materials; each obstacle grants global modifiers.
- **Astrology:** study constellations to unlock rerollable stat bonuses.

### 3.2 Workers and Town

- `wage = baseWage(tier) × f(skillLevel)` gold/h, charged continuously. Gold reaching 0 pauses every worker.
- Worker output = action rate × efficiency. Workers give 10% XP and no mastery (Town can raise the XP share).
- **Town buildings (draft):** Guild Hall (worker slots), Workshop (worker efficiency), Training Yard (worker XP share), Vault (bank space), Waystone (auto-bank interval), Appraiser (loot filter rule count), Scribe (action queue length), Market (Exchange fees and stock), Tannery/Forge/Loom (artisan speed), Greenhouse (Farming plots), Observatory (Astrology), Course (Agility obstacle slots), Kitchen (Cooking buff duration), Archive (completion log views), Sanctum (respec discount).

### 3.3 Stat and damage engine

- A generic modifier: `Mod { stat, kind: flat | increased | more | override | convert | gainAs, tags[], conditions[], source }`.
- **Tags** filter which mods apply: Attack, Spell, Melee, Projectile, Minion, DoT, Physical/Fire/Cold/Lightning/Chaos, weapon types, Ailment, Aura, Warcry, Combo, etc.
- Pipeline for each skill: base → added → conversion (ordered, capped at 100%) → gain-as → increased (summed) → more (multiplied) → crit → hit/DoT split → ailments → enemy mitigation.
- Defences: armour (vs hit size), entropy evasion, ES + recharge delay, block, spell suppression, resists with max caps, leech, regen, recoup.
- Ailments: ignite, bleed, poison (stacking), shock, chill, freeze; plus immunities.
- Every number carries **provenance**, which the Codex panel and what-if previews read.

### 3.4 Combat

- A zone has a weighted monster pool. When a monster dies, the next one spawns immediately.
- Event queue: skill uses, monster attacks, DoT ticks, regen, flask auto-use, boss ability timers.
- Priority-list conditions: always, off cooldown, target lacks debuff X, life/mana < N%, charges ≥ N, combo ≥ N, boss phase = N.
- Threat model: player base threat 100; minions have their own base threat; taunt and guardian effects modify it.
- Monster rarities normal/magic/rare/unique, with monster mods. Boss scripts are data: `{ ability, every, damageType, telegraph, phaseAt, immunity }`.

### 3.5 Items

- Base types with implicits and attribute requirements; item level gates the affix tiers that can roll.
- Crafting route: artisan skill → base (item level from skill level + material tier) → Enchanting → optional Ashen Brand.
- Loot filter rules are evaluated on drop, before the item enters the trip bag.

### 3.6 Gems

- Uncut skill/support/spirit gems drop by tier; Gemcutting picks one gem from the pool for that tier.
- Supports are tag-matched to skills; each support may be used once per character.
- Ashen Brand works on gems (+1 level, an extra support slot, a transformed variant, or brick).

### 3.7 Passive tree

- About 1,500 nodes, **100 points** in total (the split between level-ups and campaign rewards is set in Phase 6). Ascendancy has its own small sub-tree, with points earned across 4 trials.
- Node types: small, attribute choice, notable, choice notable, keystone, jewel socket.
- Cluster-style jewels add sub-trees to outer sockets. Timeless-style jewels transform nodes within a radius (seeded).
- Built with an in-repo **tree editor** (dev route) and drawn by a canvas renderer with pan/zoom, path-to-node and search.

### 3.8 Campaign, dungeons, bounties

- **Acts:** each has 4–8 zones + an act-boss dungeon that gates the next act. The 4 ascendancy trials are spread across the acts.
- **Bounties:** kill N of X, rewarding bounty marks for a shop and unlocking bounty-only zones.
- **Pinnacle dungeons** in the endgame, entered with fragments.

### 3.9 Atlas

- A seeded procedural graph that reveals as you clear adjacent nodes. Biomes set the monster pools; special nodes include towers (local mod boosts) and citadels (region bosses → Atlas passive points).
- Map items tier 1–16+, with mods that trade difficulty for quantity and rarity.
- Atlas progress unlocks **skill levels 100–120** and their new material tiers.

### 3.10 Economy

- Gold comes from vendor sales, Thieving and drops. It is spent on workers, Town, respec and the Exchange.
- **Exchange:** each currency has a base price; your trades push it, and it reverts toward the base over time. Rare reagents have a daily stock.
- **Vendor recipes:** deterministic conversions (e.g. 3 rares of the same base → that base's reagent).

---

## 4. Technical architecture

```
AtlasOfAsh/
  src/
    engine/          # pure TS, no DOM — runs in Worker and in Node (tests, sim-cli)
      core/          # rng (seeded xoshiro128**), scheduler (event queue), time, ids
      stats/         # modifiers, tags, calculation pipeline, provenance
      combat/        # duel sim, threat, ailments, flasks, rotation, boss scripts
      skills/        # skill framework, mastery, each skill module, workers
      items/         # bases, affixes, generation, enchanting, loot filter
      gems/          # gem defs, supports, gemcutting
      tree/          # passive tree, jewels, ascendancy
      world/         # acts, zones, dungeons, bounties, atlas generator
      economy/       # gold, town, exchange, vendor recipes
      save/          # serialization, versioned migrations
    content/         # data packs (zod-validated): monsters, items, affixes, gems, tree.json …
    worker/          # Web Worker host: owns GameState, runs sim, posts snapshots
    ui/              # React app (panels, tooltips, tree canvas, Codex)
    dev/             # tree editor, debug console, time-skip, item spawner
  tools/sim-cli/     # headless balance harness
  .github/workflows/ # CI + GitHub Pages deploy
```

- **Determinism:** one seeded RNG per stream (combat, loot, each skill, Atlas generation), all stored in the save. Online and offline play run the same code path.
- **Event-driven scheduler:** each track (the player's action, each worker, combat timers, farm plots) schedules its next event, and the engine jumps to the earliest one. Isolated gathering tracks can be batch-solved in closed form.
- **Performance target:** 7 days offline (combat + 5 workers + farm) simulated in under ~10s in the Worker, with a progress bar and a "while you were away" summary.
- **State:** the Worker owns the authoritative state. The UI holds throttled snapshots (zustand) and sends commands back.
- **Saves:** IndexedDB, autosave on an interval and on visibility change, rolling backups (last 5), versioned migrations, compressed export string (fflate + base64).
- **Pages deploy:** a GitHub Actions workflow builds with Vite (`base: '/AtlasOfAsh/'`) and publishes to GitHub Pages on every push to `main`.

---

## 5. Additional recommendations (adopted unless you object)

1. **Stable content IDs:** every item, affix, node and gem gets a permanent string id that is never reused, so saves survive content changes.
2. **Golden-number tests:** the damage engine is checked against hand-calculated builds. Any change in a result fails CI until it is reviewed.
3. **Determinism test:** for the same seed, simulating 1h in small online steps must equal 1h as a single offline batch.
4. **sim-cli balance harness:** run `build × zone × hours` headlessly and report kills/h, XP/h, loot/h and death rate. It is the basis for every balance pass.
5. **Content linter:** validates the data packs on build (missing ids, unreachable tree nodes, affix tiers with no item level, drop tables summing wrong).
6. **Crash-safe saves:** an error boundary saves state and offers an export string if the UI crashes.
7. **Bug replay:** "Export debug bundle" (save + seeds + version) so issues can be reproduced exactly.
8. **Colour-blind safe affix colours** and mod-text styling not based on colour alone.
9. **Keyboard shortcuts** for panels (B = bank, P = passives, G = gems, C = Codex).
10. **Feature flags** so unfinished systems can ship hidden on `main` while Pages stays playable.
11. **i18n-ready strings:** UI text goes through a lookup from the start (English only for now).
12. **Number formatting:** one formatter (1.23k, 4.56M, full value on hover) and consistent time formatting.
13. **Changelog** shown on the title screen, pulled from `CHANGELOG.md` at build time.

---

## 6. Build phases

Each phase runs on its own branch (`phase-N-name`), with one commit per feature, and merges to `main`. Every merge deploys to Pages. Design questions are asked at the start of each phase.

| # | Phase | Deliverables |
|---|---|---|
| 0 | **Foundation** | Vite/React/TS scaffold, lint/test, seeded RNG, event scheduler, Worker host, save/load + migrations + backups, offline catch-up framework, dev console, UI shell (sidebar, dark theme, responsive), number formatting, **GitHub Pages deploy + CI**, T3 run scripts |
| 1 | **Skilling core** | Character creation (realm + mode), skill framework (XP curve, mastery + pool), bank, gold, vendor; Mining, Woodcutting, Herbalism, Fishing, Thieving; **workers** + first Town buildings |
| 2 | **Stat engine** | Modifiers, tags, damage/defence pipeline, entropy evasion, provenance; golden tests; first **Codex** panel |
| 3 | **Items and artisan skills** | Bases, affixes, rarities, uniques framework, tooltips, equipment; Smithing, Tailoring, Woodworking, Jewelcrafting; **Enchanting**; Ashen Brand |
| 4 | **Combat** | 1v1 event sim, monsters + mods, zones, trip bag + Waystone, **loot filter**, death penalty, flasks + **Alchemy**, offline combat, sim-cli |
| 5 | **Gems and rotation** | Uncut drops, **Gemcutting**, skill/support/spirit gems, once-per-character supports, priority list, Spirit, charges, combos, minions + threat |
| 6 | **Passive tree** | Tree format + editor, renderer, 6 class starts, attribute choices, notables, choice notables, keystones, jewels, cluster + timeless jewels, **Runecraft**, respec, **build codes** |
| 7 | **Campaign** | Acts, zones, boss scripts, act dungeons, 4 ascendancy trials, **24 ascendancies**, bounties |
| 8 | **Utility skills and Town** | Farming, Cooking, Agility, Astrology; full Town; **action queue**; notifications |
| 9 | **Atlas endgame** | Procedural Atlas, map items, **Cartography**, map mods, Atlas passives, pinnacle dungeons, skills 100–120 |
| 10 | **Meta and economy** | Realms, Hardcore/Mortal, League framework, Exchange (drifting prices + daily stock), vendor recipes |
| 11 | **Polish** | Completion log, optional tutorial, balance passes, accessibility, PWA install, performance |
| 12 | **Desktop and cloud** | Tauri packaging, file saves, optional cloud sync, Steam prep |

---

## 7. Open questions (to ask when each phase starts)

1. **XP curves:** the exact formulas for character levels (1–100) and skill levels (1–120).
2. **Tree points split:** how many of the 100 points come from levels versus campaign rewards.
3. **Ascendancy names** and the full 4 × 6 designs.
4. **Number of acts** and zones per act.
5. **First league mechanic.**
6. **Worker wage curve** and Town costs (tuned with sim-cli).
7. **Cluster/timeless jewel** specifics (sizes, radius, transforms).
8. **Bounty shop** contents.
9. **Gem tiers** and the support-slot progression per level.
10. **Cooking buff** stacking rules and durations.
