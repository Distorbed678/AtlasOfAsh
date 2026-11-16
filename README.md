# Atlas of Ash

An idle game with deep ARPG buildcrafting: Melvor-style skilling and one-action-at-a-time play, combined with a giant passive tree, socketable support gems, affix crafting and full damage math.

**Play (dev builds):** https://distorbed678.github.io/AtlasOfAsh/

Status: pre-alpha. Phases 0 (foundation) and 1 (skilling, workers, Town) are done. See [docs/PLAN.md](docs/PLAN.md) for the full design and roadmap, and [CHANGELOG.md](CHANGELOG.md) for what's new.

## Development

```sh
npm ci            # install
npm run dev       # dev server → http://localhost:5173/AtlasOfAsh/
npm test          # unit + determinism tests
npm run check     # typecheck + lint + tests
npm run build     # production build into dist/
```

Dev tools (time skip, sim speed, give items) are on by default in dev builds. On the live site, enable them with `?flags=devTools`.

## Layout

| Path                  | What lives there                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `src/engine/`         | Pure TypeScript game logic (no DOM). Seeded RNG, event-driven sim, systems, commands, saves |
| `src/engine/content/` | Game data with stable ids (`category.name`); retired ids in `retiredIds.ts`                 |
| `src/worker/`         | Web Worker host: owns the state, real-time loop, offline catch-up, autosave, backups        |
| `src/ui/`             | React UI: bridge to the worker, pages, components, styles                                   |
| `src/shared/`         | Formatting, feature flags, changelog parser                                                 |
| `src/i18n/`           | All UI text (English dictionary + `t()`)                                                    |
