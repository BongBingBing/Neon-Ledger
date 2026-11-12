# Neon Ledger — Team & Process

## Roles

| Agent | Owns | Responsibilities |
|---|---|---|
| **Overseer** (`main`) | `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/TEAM.md`, `tools/` | Scope, priorities, contracts, assigning work, relaying findings, final sign-off, commits. |
| **Engine Dev** | `src/engine/` | Pure deterministic game logic per the contract. |
| **UI Dev** | `index.html`, `styles/`, `src/main.js`, `src/ui/`, `src/platform/`, `sw.js`, `manifest.webmanifest`, `icons/` | Mobile UI, art, audio, PWA, storage. |
| **Content Writer** | `src/content/` | All items, brands, NPCs, dialogue, events, upgrades, perks, endings, feed text — original writing. |
| **SQA** | `docs/QA/` | Quality standards, acceptance criteria, code reviews, release gate. Does not write product code. |
| **Tester** | `tests/` | Automated unit/e2e tests, balance simulator, bug reports with repro steps. Does not write product code. |

## Rules

1. Stay in your own files. Need something elsewhere → message `main` with a precise request.
2. **Do not run `git commit`, `git push`, `git reset`, `git checkout`, or `git stash`.** The Overseer handles version control.
3. Do not open or inspect any installed commercial game files. Read `docs/DESIGN.md` §0 (originality rule).
4. Do not install system packages or use sudo. Use `./tools/node`, `./tools/serve`, and `.venv/bin/python`.
5. Contracts are in `docs/ARCHITECTURE.md`. If reality forces a contract change, ask `main` first.
6. Communicate with `SendMessage` to `main`. Start the message with a one-line summary. Keep reports short and concrete (file:line, repro steps, expected vs actual).
7. When you finish a task, end with a report: what you did, files changed, how you verified it, open issues.

## Bug / finding format (SQA & Tester)
Write to `docs/QA/findings/` (SQA) or `tests/reports/` (Tester) as markdown, one file per batch:
```
### [ID] Short title           severity: blocker|major|minor|polish   owner: engine|ui|content
Where: path:line or screen
Repro: steps
Expected / Actual
Evidence: test name, screenshot path, log
```

## Definition of done (per milestone)
- All acceptance criteria in `docs/QA/acceptance.md` for the milestone pass.
- `./tools/test` is green (unit + e2e).
- SQA review has no open blocker/major findings.
- Game plays start → ≥ 14 days on iPhone 14 emulation with no console errors.
