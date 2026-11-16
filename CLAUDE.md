# Atlas of Ash

Idle game (Melvor-style skilling, one action at a time + paid workers) combined with Path of Exile-depth builds (PoE2-style gems and tree, full PoE damage math).

- The full design and phase roadmap are in `docs/PLAN.md`. Read it before starting any phase.
- When a phase starts, ask the user its open questions (PLAN §7) **with the AskUserQuestion tool**, offering suggestions as options. Record each answer in PLAN §1.
- All names, lore and art must be original. Never use PoE/Melvor names, item names, text or assets.
- `src/engine` is pure TypeScript with no DOM or React imports; it must run in a Web Worker and in Node (tests).
- All randomness goes through the seeded engine RNG. Online play and offline catch-up must use the same code path.

## Git workflow
- Remote: `github.com/Distorbed678/AtlasOfAsh` (public). Push as gh account **Distorbed678**; a repo-local credential helper handles this.
- One branch per phase (`phase-N-name`), one commit per feature, then merge into `main`.
- Every push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
