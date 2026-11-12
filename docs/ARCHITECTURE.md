# Neon Ledger — Architecture & Contracts

This document is the **contract** between agents. If you need to change a contract (state shape, action, content schema), message the Overseer (`main`) first; the Overseer updates this file and notifies affected agents.

## 1. Tech constraints

- **No build step, no npm dependencies.** Plain modern JavaScript ES modules (`<script type="module">`), HTML, CSS. Must run in iOS Safari 16+.
- No Node/npm installed system-wide. A Node v26 runtime is available at `.venv/lib/python3.13/site-packages/playwright/driver/node` — use the wrapper `./tools/node` (runs that binary). Use **built-in** `node:test` + `node:assert` only.
- Python venv at `.venv/` with `playwright` + `pytest`; Playwright **Chromium** works (WebKit lacks host libs — do not try to install system deps). Use Chromium with the `iPhone 14` device descriptor for mobile emulation.
- Dev server: `./tools/serve` (python http.server on port 8765, serves repo root). Game URL: `http://localhost:8765/`.
- Everything offline: no CDNs, no external fonts, no network calls.

## 2. Layout & ownership

```
index.html                 UI dev
manifest.webmanifest       UI dev
sw.js                      UI dev   (service worker, cache-first, versioned cache name)
icons/                     UI dev   (generated PNG/SVG icons; may generate via a script in tools/)
styles/                    UI dev
src/main.js                UI dev   (bootstrap: load save or title screen, wire engine to UI)
src/ui/**                  UI dev   (screens, components, portrait generator, audio)
src/engine/**              Engine dev (pure game logic — NO DOM, NO window, NO localStorage)
src/content/**             Content writer (pure data modules, schemas in §5)
src/platform/storage.js    UI dev   (localStorage adapter implementing the Storage interface §4.4)
tests/unit/**              Tester   (node:test, *.test.mjs)
tests/e2e/**               Tester   (pytest + playwright, iPhone 14 emulation)
tests/sim/**               Tester   (headless balance simulator using the engine)
docs/QA/**                 SQA
docs/DESIGN.md, docs/ARCHITECTURE.md, docs/TEAM.md   Overseer
tools/**                   Overseer (agents may add scripts after telling the Overseer)
```

**Never edit files you don't own.** If you need a change in someone else's area, message the Overseer with the exact request.

## 3. Engine design

- The engine is a **pure, deterministic reducer**. All randomness comes from a seeded PRNG whose state lives inside the game state (`state.rng`). Same state + same action ⇒ same result, always.
- The engine never mutates its input. `step` returns a new state object (use `structuredClone` on entry, then mutate the clone).
- Content (items, NPCs, events, text) is imported from `src/content/`; the engine must never hard-code display text that belongs in content, except for short fallback strings.
- All money values are **integers** (creds, ¢). Round with `Math.round`.

### 3.1 Public API — `src/engine/index.js`

```js
export const ENGINE_VERSION = '1.0.0';
export const SAVE_VERSION = 1;

// Create a fresh game. opts: { seed?: number, background: BackgroundId, difficulty: 'drizzle'|'acid'|'downpour', shopName: string }
export function newGame(opts) -> GameState

// Apply one action. Never throws for invalid player input.
export function step(state, action) -> { state: GameState, events: GameEvent[], error?: string }

// What can the player do right now? Used by UI to enable/disable buttons and by the simulator.
export function legalActions(state) -> ActionDescriptor[]   // [{ type, ...params? , label? }]

// Serialization (versioned). deserialize runs migrations; returns null if unreadable.
export function serialize(state) -> string
export function deserialize(str) -> GameState | null

// Read-only helpers (pure). UI must use these rather than re-deriving rules.
export const selectors = {
  netWorth(state), stockValue(state), daysUntilLease(state), leaseAmount(state),
  shelfItems(state), storageItems(state), stashItems(state), freeSlots(state, location),
  customerCountToday(state), currentCustomer(state), duesQuote(state),
  marketListings(state), availableUpgrades(state), availableMachines(state),
  itemDef(itemId), isIllegal(state, invItem), appraiseHint(state, invItem),
  repTier(state, faction),  // 'hated'|'disliked'|'neutral'|'liked'|'trusted'
};
```

### 3.2 GameState (top-level keys are contract; engine may add nested fields — document them in `src/engine/STATE.md`)

```js
{
  saveVersion: 1,
  seed, rng,                       // rng: uint32 PRNG state
  day: 1,                          // day number, starts at 1
  phase: 'dawn'|'open'|'night'|'ended',
  difficulty, background, shopName,
  creds: 400,                      // may go negative (debt)
  lease: { amount, nextDueDay, graceActive: false, missedCount: 0 },
  deedPrice: 30000,
  heat: 0, auditPending: false,
  audit: null | { found: InvItem[], fine, bribeCost, bribeChance },   // set during dawn when an audit resolves
  rep: { vantage: 0, lantern: 0, static: 0, sump: 0 },
  appeal: 10,
  capacity: { shelf: 6, storage: 10, stash: 0 },
  inventory: InvItem[],
  machines: { [machineId]: { owned: true, broken: false, job: null | { recipeId, inputUids, readyDay } } },
  permits: string[], licences: string[],
  perks: string[], perkPoints: 0,
  market: { day, listings: [{ itemId, price, qty, flags }] },
  queue: Customer[],               // remaining customers today (generated at open)
  customer: Customer | null,       // the one at the counter
  inspection: null | Inspection,   // active mini-game state (see 3.5)
  events: { active: [{ id, untilDay }], forecast: [{ id, startDay, certainty }] },
  duesPaidTonight: false, duesSkipStreak: 0,
  nightJobDone: false,
  feed: [{ day, kind: 'news'|'msg'|'lease'|'hotlist'|'warning'|'system', from?, text }],
  hotList: string[],               // serials wanted today
  stats: { customersServed, bestSale, ghostChitsCaught, auditsSurvived, totalEarned, totalSpent, ... },
  dayLog: { income, expenses, lines: [{ label, amount }] },    // reset each dawn; shown in Sleep summary
  ending: null | { id, title, text, win: boolean, stats },
}
```

**InvItem:** `{ uid, itemId, location: 'shelf'|'storage'|'stash', condition: 0-100, quality: 'A'|'B'|'C', serial?, flags: { stolen?, counterfeit?, tracer?, untested?, cut?, labelled? }, known: { ...flags the player has discovered }, boughtFor, acquiredDay, spoilsDay? }`
Hidden truth lives in `flags`; what the player knows lives in `known`. UI shows only `known` (+ always-visible properties).

**Customer:** `{ id, kind: 'buyer'|'seller'|'special', npcId?, name, faction: 'vantage'|'lantern'|'static'|'sump'|'spire'|'none', homeWard, portrait: { seed, traits: {...} }, dialogue: { greet, ...}, wants?: { category?, itemId? }, item?: InvItem-like (for sellers), askPrice, patience, patienceMax, mood: 'happy'|'neutral'|'annoyed'|'angry', chit?: { name, ward, sigilGlitch: bool, expiryDay }, visibleTells: string[], hidden: { reservation, ghostChit?, undercover?, verifier? }, selectedUid?: string }`
`hidden` must never be read by UI (tests will enforce via code review / grep).

### 3.3 Actions (contract)

| type | phase | params | notes |
|---|---|---|---|
| `MOVE_ITEM` | dawn, night | `uid, to` | respects capacity |
| `AUDIT_RESPOND` | dawn (audit set) | `choice: 'comply'|'bribe'` | after stash moves |
| `OPEN_SHOP` | dawn | — | generates queue; blocked while `audit` unresolved |
| `NEXT_CUSTOMER` | open | — | pulls from queue into `customer` |
| `SELECT_ITEM` | open (buyer) | `uid` | shelf item to offer; sets askPrice suggestion |
| `OFFER` | open | `price` | haggle step → events `HAGGLE_ACCEPT`/`HAGGLE_COUNTER`/`HAGGLE_WALK` |
| `DEAL` | open | — | complete at current agreed/asked price; buyer with chit → chit must be accepted (see below) |
| `ACCEPT_CHIT` / `REJECT_CHIT` | open | — | after a buyer agrees to pay |
| `INSPECT` | open, night | `tool, target` | starts an Inspection (3.5) or instant reveal |
| `INSPECT_INPUT` | any w/ inspection | `input` | mini-game input (e.g. `{cell: 5}`, `{mark: 2}`) |
| `INSPECT_END` | any w/ inspection | — | finish/abandon |
| `REFUSE` | open | — | customer leaves |
| `REPORT` | open | — | call Vantage on the customer |
| `SPECIAL_CHOICE` | open | `optionId` | special customers' choices |
| `CLOSE_SHOP` | open | — | → night (remaining queue leaves) |
| `BUY_STOCK` | night | `listingIndex, qty` | from market |
| `SELL_TO_MARKET` | night | `uid` | dump to supplier at low price |
| `RUN_MACHINE` | night | `machineId, recipeId, inputUids` | |
| `COLLECT_MACHINE` | dawn, night | `machineId` | |
| `BUY_MACHINE` / `BUY_UPGRADE` / `BUY_PERMIT` / `BUY_LICENCE` | night | `id` | |
| `PAY_DUES` / `SKIP_DUES` | night | — | |
| `NIGHT_JOB` | night | `jobId` | |
| `CONTACT_FAVOR` | night | `npcId, favorId` | |
| `PAY_LEASE` | dawn, night | — | pay early |
| `CHOOSE_PERK` | any | `perkId` | if perkPoints > 0 |
| `SLEEP` | night | — | resolution → next day's dawn (or ending) |
| `BUY_DEED` | dawn, night | — | see §6 R1 |
| `CONTINUE_ENDLESS` | ended (win) | — | |

### 3.4 GameEvent (returned by `step`, drives UI animations/toasts/sounds)
`{ type: string, ...data }` e.g. `SALE {uid, price}`, `PURCHASE`, `HAGGLE_COUNTER {price, mood}`, `CUSTOMER_LEFT {reason}`, `CHIT_BOUNCED`, `BREAK_IN {stolen:[...]}`, `AUDIT {...}`, `LEASE_PAID`, `LEASE_MISSED`, `EVENT_STARTED {id}`, `REP_CHANGED {faction, delta}`, `HEAT_CHANGED {delta}`, `ENDING {id}`, and **`DAY_SUMMARY { day, income, expenses, lines:[{label,amount}] }`** emitted by `SLEEP` with the closing day's complete dayLog (including sleep-time charges: power bill, spoilage, lease, dues consequences, break-ins) — dayLog resets at dawn, so this event is the Sleep summary screen's source. Any event may carry an optional human-readable `text` (UI shows it as a toast when present). The engine documents all types and which carry `text` in `src/engine/EVENTS.md`.

### 3.5 Inspection
`{ id, tool: 'probe'|'appraise'|'serial'|'scan', targetUid | 'customer', data: {...public puzzle data}, hidden: {...solution}, inputsLeft, revealed: {...} }`
- **probe:** `data: { size: 4 }`, `revealed: { [cell]: 'ok'|'fault' }`, 5 probes. Ending marks `known.untested=false` and sets the known condition estimate.
- **appraise:** `data: { marks: [m1,m2,m3], brand }`, player taps the mark they think is wrong (or "all genuine"); requires Reference Index upgrade to see reference marks (UI reads reference from content).
- **serial:** instant — reveals whether the serial is on the hot list.
- **scan:** night machine job, not a live mini-game.

## 4. UI design

- Single page, screen router in `src/ui/router.js`: `title`, `newgame`, `dawn`, `counter`, `night`, `summary`, `ledger`, `settings`, `ending`. A screen is a module exporting `render(root, ctx)` where `ctx = { state, dispatch, ui }`.
- `dispatch(action)` → calls `engine.step`, stores new state, plays `events` (toasts/sfx/animations), autosaves (debounced) and re-renders. **UI never mutates GameState and never computes game rules** — it uses `selectors` and `legalActions`.
- Layout: CSS grid, `height: 100dvh`, `env(safe-area-inset-*)` padding, bottom action bar, no hover-only affordances, `touch-action: manipulation`, no double-tap zoom, `user-select: none` on game chrome.
- Portraits: `src/ui/art/portrait.js` — `drawPortrait(canvas, portrait)` deterministic from seed/traits; 32×32 or 48×48 logical pixels.
- Accessibility: visible text labels on icon buttons (aria-label), contrast ≥ 4.5:1 for body text, `prefers-reduced-motion` honoured.

### 4.4 Storage interface (`src/platform/storage.js`)
`listSlots() -> [{slot, shopName, day, creds, savedAt}]`, `save(slot, string)`, `load(slot) -> string|null`, `remove(slot)`, `loadSettings()/saveSettings(obj)`. Slots: `'auto'`, `'1'`, `'2'`, `'3'`. Keys prefixed `neonledger.`. Wrap every access in try/catch.

## 5. Content schemas (`src/content/`)

Each file is an ES module exporting a frozen array/object. Ids are `snake_case`, unique.

- `items.js` → `export const ITEMS = [{ id, name, category: 'power'|'food'|'salvage'|'sundry'|'chrome'|'shard'|'luxury'|'tech'|'stolen_goods', basePrice, legality: 'legal'|'permit'|'contraband', permit?: permitId, size: 1, perishableDays?, brand?, marks?: [3 strings] (genuine marks for branded items), tags: [], flavor }]` — target 50–70 items.
- `brands.js` → `export const BRANDS = [{ id, name, marks: [3 genuine marks], fakeMarks: [variants] }]` — fictional Upper-Spire luxury brands.
- `npcs.js` → recurring NPCs `[{ id, name, faction, role, portraitTraits, lines: { greet: [...], ... } }]`.
- `names.js` → name parts for random customers by faction; home wards list.
- `dialogue.js` → line pools keyed by situation (`buyer_greet`, `seller_greet`, `haggle_counter`, `haggle_walk`, `deal_done`, `refuse`, `report`, `undercover_greet`, `ghost_nervous`, …) with `{text, faction?, mood?}`; placeholders like `{item}`, `{price}`, `{name}`.
- `events.js` → `[{ id, name, durationDays: [min,max], weight, minDay, effects: {...}, feedText: { forecast, start, end } }]`.
- `machines.js`, `upgrades.js`, `permits.js`, `licences.js`, `perks.js`, `jobs.js`, `recipes.js`, `backgrounds.js`, `difficulties.js`, `endings.js`, `feed.js` (LEASEHOLD texts, news ticker lines).
- Numeric balance values that the engine needs (prices, multipliers) live in content where they describe content, or in `src/engine/balance.js` (engine-owned) for global tuning knobs.

The Content writer may propose additional fields; the Engine dev decides what the engine consumes and tells the Overseer.

## 6. Rules clarifications (binding; added by Overseer)

- **R1 Deed win.** New action `BUY_DEED` (phase dawn or night), legal when `creds >= deedPrice`. It deducts the price and sets `phase:'ended'` with the faction-flavoured win ending. Not automatic (player may keep grinding). `CONTINUE_ENDLESS` afterwards returns to the next dawn with the shop owned (no more lease).
- **R2 Audit math.** Value = item **basePrice** (content). Fine = `round(1.5 × Σ basePrice of illegal items found)`; found items are also confiscated (removed). Bribe cost = `round(0.20 × fine × (1 − vantageRep/200))`; success chance `0.50 + vantageRep/200` clamped to [0.05, 0.95]. Bribe success: no fine, no confiscation, pay bribe. Bribe failure: pay bribe AND fine ×2, items confiscated, −10 Vantage. "Major contraband" for Arrest = Σ basePrice found > 1000 and creds after fine < 0.
- **R3 Audit timing.** When dawn begins with `auditPending`, engine sets `state.audit` immediately with a preview `{found, fine, bribeCost, bribeChance}` and **recomputes it after every `MOVE_ITEM`** during that dawn. `AUDIT_RESPOND` finalizes using current locations. `OPEN_SHOP` is illegal while `state.audit` is set. Tests should verify behaviourally (moved to stash ⇒ not confiscated).
- **R4 Lease.** Lease auto-pays during `SLEEP` on the due day if `creds >= amount` (`LEASE_PAID`). Otherwise `LEASE_MISSED`: `graceActive=true`, `missedCount += 1`, `lease.overdue = round(amount × 1.25)`. Then the weekly amount escalates as normal and `nextDueDay += 7`. At the next due day the player owes `overdue + amount`; if unpaid ⇒ `missedCount` reaches 2 ⇒ **Evicted**. `PAY_LEASE` (dawn/night) pays `overdue` first (clearing grace), or pre-pays the upcoming lease. Escalation happens every due day regardless of payment.
- **R5 Break-in.** `duesSkipStreak` includes tonight's skip. Chance = `0.25 + 0.10 × (duesSkipStreak − 1)`, ×0.5 with Security Shutter, capped 0.9. Paying resets the streak to 0. If the player neither pays nor skips before `SLEEP`, it counts as a skip.
- **R6 Spoilage.** At `SLEEP`, items with `spoilsDay <= day` are **removed** with a `SPOILED {uids, itemIds}` event and a dayLog line (amount 0, label shows the loss).
- **R7 BUY_STOCK destination.** Storage first; if storage full, shelf; if both full ⇒ error `no_space`.
- **R8 Ids.** Backgrounds: `tinker, shard_diver, sparky, line_cook, fence, nobody`. Difficulties: `drizzle, acid, downpour`. Factions: `vantage, lantern, static, sump` (+ customer-only `spire`, `none`).

## 7. Test hooks (binding; UI)

- Every screen root has `data-screen="<name>"` (title, newgame, dawn, counter, night, summary, ledger, settings, ending).
- Every button that dispatches an engine action has `data-action="<ACTION_TYPE>"` (e.g. `OPEN_SHOP`, `NEXT_CUSTOMER`, `OFFER`, `DEAL`, `REFUSE`, `CLOSE_SHOP`, `BUY_STOCK`, `SLEEP`, `ACCEPT_CHIT`, `PAY_DUES`, …).
- Non-engine controls have `data-ui="<name>"`: `start`, `continue`, `bg-<id>`, `diff-<id>`, `shop-name`, `offer-slider`, `summary-continue`, `tab-<name>`.
- Read-only debug hook: `window.__neonLedger = { getState: () => state, engineVersion }`.
- Service worker registered from index.html as `./sw.js` with relative scope (tests run on `http://127.0.0.1:<random port>/`).
