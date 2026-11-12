# Neon Ledger tests

Everything runs offline with the repo's bundled tools: no npm, no system packages.

| What | Command |
|---|---|
| Everything (unit + e2e) | `./tools/test` |
| Unit only | `./tools/test unit` |
| E2E only | `./tools/test e2e` |
| One unit file | `./tools/node --test tests/unit/haggle.test.mjs` |
| Filter unit tests by name / AC id | `./tools/node --test --test-name-pattern="AC-ENG-17" tests/unit/*.test.mjs` |
| One e2e test | `.venv/bin/python -m pytest -q tests/e2e/test_flow.py -k offline` |
| Balance simulator | `./tools/node tests/sim/sim.mjs --seeds 20 --days 120` |

## Layout

- `unit/`: `node:test` suites written against the contract in `docs/ARCHITECTURE.md` §3 and §6 (R1–R8) and `docs/DESIGN.md`.
  - `_helpers.mjs` holds the shared fixtures: `fresh()`, `act()`/`actFails()`, `deepFreeze`, `randomWalk`, `stockShelf`, `findCustomer`, `skipDay`, `nextDay`, `makeInv`.
  - When `src/engine/index.js` is missing, the engine suites are **skipped**. An import error is never skipped: it fails.
  - Test names carry the acceptance IDs from `docs/QA/acceptance.md` (e.g. `AC-ENG-176`), so `--test-name-pattern` and SQA can trace coverage.
  - Some tests set up state directly (for example `s.heat = 80`, or injected inventory) and then exercise the engine through `step`.
  - `qa_static.test.mjs` runs SQA's `docs/QA/checks/qa-static.mjs`. Any ERROR finding fails the test.
  - `content.test.mjs` does the content integrity checks and the originality scan. It reads the term list from `docs/QA/forbidden-terms.txt`, so no term is copied into tests/.
- `e2e/`: pytest + Playwright **Chromium** (WebKit doesn't run on this host).
  - Every test runs twice: once with the `iPhone 14` device descriptor and once at 375×667.
  - `conftest.py` starts a static server on a free port.
  - Any `console.error`, uncaught page error, failed same-origin request or HTTP ≥ 400 fails the test.
  - Failures save a screenshot to `reports/screenshots/`.
  - The tests use the hooks in ARCHITECTURE §7: `data-screen`, `data-action`, `data-ui`, and the read-only `window.__neonLedger.getState()`.
- `sim/`: the headless balance simulator. `bots.mjs` holds the policies and `sim.mjs` is the runner (it uses worker threads).
  - Bots see only public state: no `customer.hidden`, and item `known` instead of `flags`. They act only through `legalActions` + `step`.
  - Options:
    - `--seeds N`
    - `--days N`
    - `--policies cautious_legal,greedy_smuggler,random,balanced_haggler`
    - `--bgs …`, `--diffs …`
    - `--workers N`
    - `--out N` (writes `reports/balance-N.md`)
    - `--json` (raw per-run results)
- `reports/`: `bugs-<n>.md` (bug batches, in the TEAM.md format), `balance-<n>.md` (simulator reports) and `screenshots/` (gitignored).
