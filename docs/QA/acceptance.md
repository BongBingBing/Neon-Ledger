# Neon Ledger — Acceptance Criteria

Owner: SQA. Source of truth for milestone sign-off (TEAM.md "Definition of done").
Derived from `docs/DESIGN.md` (v1) and `docs/ARCHITECTURE.md` (incl. §3.4 `DAY_SUMMARY`/`text`, §6 rules R1–R8).
If a criterion conflicts with the contract, the contract wins and SQA updates this file — tell `main`.

## Conventions

- **ID scheme:** `AC-<AREA>-<M><NN>` — area `ENG` (engine), `UI`, `CON` (content), `PWA` (PWA / iOS), `BAL` (balance), `PERF`, `A11Y`; number ranges: `ENG` M1 = 100–299, M2 = 400–499; all other areas 1xx = M1, 2xx = M2, 3xx = M3. IDs are never reused; retired criteria are struck through, not deleted.
- **Verify** codes:
  - **U** unit test (`tests/unit/*.test.mjs`, `node:test`, run with `./tools/node`)
  - **E** e2e test (`tests/e2e/test_*.py`, Playwright Chromium, `iPhone 14` descriptor)
  - **S** headless simulator (`tests/sim/`), many seeds, statistical tolerance stated
  - **R** SQA review / static check (grep, import scan) per `docs/QA/standards.md`
  - **M** manual on a real iPhone (Safari 16+ and installed to Home Screen). Chromium emulation does **not** count for M.
- "Fuzz run" below = from `newGame`, repeatedly pick a uniformly random element of `legalActions(state)` (filling params from the descriptor; random ints for `OFFER`), seeded, for the stated number of days/steps.
- Numbers quoted (350¢, ×1.15, 60 Heat…) are the Normal (`acid`) values unless the criterion names a difficulty.
- Statistical criteria: N and tolerance are given; the test must use fixed seeds so it is reproducible.

---

# M1 — Core loop playable

## M1 · Engine (contract & purity)

- **AC-ENG-101** `src/engine/index.js` exports `ENGINE_VERSION` (string), `SAVE_VERSION === 1`, `newGame`, `step`, `legalActions`, `serialize`, `deserialize`, and `selectors` containing every key listed in ARCHITECTURE §3.1 as a function. — **U**
- **AC-ENG-102** Every module under `src/engine/` imports successfully in plain Node (`./tools/node`) with no DOM shims — proves no top-level `window`/`document`/`localStorage` use. — **U, R**
- **AC-ENG-103** `newGame({seed, background, difficulty, shopName})` returns a state containing every top-level key in ARCHITECTURE §3.2 with: `saveVersion 1`, `day 1`, `phase 'dawn'`, `creds` per DESIGN §10 for the background, `capacity {shelf 6, storage 10, stash 0}` (Fence: stash 2), `lease.nextDueDay 7`, `lease.amount 350`, `deedPrice 30000`, rep twists per §10, `ending null`, `audit null`. — **U**
- **AC-ENG-104** `newGame` with an unknown background/difficulty or missing `shopName` does not throw: it either falls back to documented defaults or returns a state with a documented default; `shopName` is trimmed and length-capped (documented cap). — **U**
- **AC-ENG-105** Ids are exactly R8: backgrounds `tinker, shard_diver, sparky, line_cook, fence, nobody`; difficulties `drizzle, acid, downpour`; factions `vantage, lantern, static, sump` (customer factions additionally `spire`, `none`). — **U**
- **AC-ENG-106** **Determinism:** two fuzz runs with the same seed and the same action sequence (≥ 10 days) produce deep-equal states and deep-equal event arrays at every step. — **U**
- **AC-ENG-107** Different seeds produce different day-1 queues or markets in ≥ 95% of 100 seed pairs. — **U**
- **AC-ENG-108** **No input mutation:** for every step of a 10-day fuzz run, the input state (deep-frozen with `Object.freeze` recursively) is unchanged afterwards and `step` does not throw on the frozen input. — **U**
- **AC-ENG-109** **No throws on bad input:** `step(state, x)` for `x` in {`undefined`, `null`, `{}`, `{type:'NOPE'}`, valid type in wrong phase, missing params, unknown `uid`, `price` = `NaN`/`-5`/`1.5`/`'100'`/`1e12`/`Infinity`, `qty` = 0/−1/1e6, `listingIndex` out of range} returns `{ state, events: [], error: <non-empty string> }` and `state` deep-equals the input. — **U**
- **AC-ENG-110** `step` on a `state` of `null`/`{}`/a truncated save does not throw (returns an error). — **U**
- **AC-ENG-111** **legalActions soundness:** every descriptor from `legalActions(state)` (for all phases reached in a 20-day fuzz over 20 seeds) can be passed to `step` without producing `error`. — **U**
- **AC-ENG-112** **legalActions completeness:** for each action type in §3.3 that is legal in the current phase per the table, if `step` succeeds with it then `legalActions` lists that type (checked on a fuzz run sampling candidate actions). `OPEN_SHOP` is never listed while `state.audit` is set. — **U**
- **AC-ENG-113** **Integer money:** after every step of a 30-day fuzz over 50 seeds, all of these are `Number.isInteger`: `creds`, `lease.amount`, `lease.overdue` (if present), `deedPrice`, market listing prices, `customer.askPrice`, `hidden.reservation`, `boughtFor`, `audit.fine`, `audit.bribeCost`, `duesQuote`, every `dayLog.lines[].amount`, `dayLog.income/expenses`, every money-bearing event field, every `stats` money field. — **U, S**
- **AC-ENG-114** **JSON-safe state:** `JSON.parse(JSON.stringify(state))` deep-equals `state` at every fuzz step (no `undefined` values in arrays, functions, `Date`, `Map`, `Set`, `NaN`, `Infinity`). — **U**
- **AC-ENG-115** **Seeded RNG only:** `state.rng` is a uint32 integer at every step; with `Math.random` and `Date.now` stubbed to throw, a 10-day fuzz completes. — **U, R**
- **AC-ENG-116** `serialize`→`deserialize` round-trips to a deep-equal state at day 1, mid-haggle, during an inspection, during an audit, at night, and in `ended`. — **U**
- **AC-ENG-117** `deserialize` returns `null` (no throw) for `''`, `'garbage'`, `'{}'`, `'null'`, `'[]'`, a save with `saveVersion` greater than `SAVE_VERSION`, and a save missing `inventory`. — **U**
- **AC-ENG-118** **Phase machine:** `dawn —OPEN_SHOP→ open —CLOSE_SHOP→ night —SLEEP→ dawn (day+1)` or `ended`. No other phase transitions occur in a 30-day fuzz over 50 seeds. — **U, S**
- **AC-ENG-119** `src/engine/STATE.md` documents every nested field the engine adds; `src/engine/EVENTS.md` documents every event type. Every event type emitted during a 30-day fuzz over 50 seeds appears in `EVENTS.md`; EVENTS.md states which events carry `text`. — **U, R**
- **AC-ENG-120** Any event's optional `text` is a non-empty string ≤ 140 chars with no unresolved `{placeholder}`. — **U**
- **AC-ENG-121** **Invariants** hold after every fuzz step (30 days × 50 seeds): `heat ∈ [0,100]`; each `rep ∈ [−100,100]`; `appeal ∈ [0,100]`; item counts per location ≤ capacity; inventory `uid`s unique; every item `location ∈ {shelf, storage, stash}`; `0 ≤ customer.patience ≤ patienceMax`; `phase` valid; `day` monotone non-decreasing; `perkPoints ≥ 0`. — **U, S**

## M1 · Engine (inventory, day flow, dayLog)

- **AC-ENG-131** `MOVE_ITEM {uid, to}` is legal only in `dawn`/`night`; moving into a full location (or stash with capacity 0) errors and changes nothing; moving to the current location errors or is a no-op (documented). — **U**
- **AC-ENG-132** `selectors.freeSlots(state, loc)` equals `capacity[loc] − count(loc)`; `shelfItems/storageItems/stashItems` partition `inventory`. — **U**
- **AC-ENG-133** `selectors.stockValue` and `netWorth` are integers; `netWorth = creds + stockValue (+ documented extras)`. — **U**
- **AC-ENG-134** `dayLog` is reset at dawn. `SLEEP` emits exactly one `DAY_SUMMARY {day, income, expenses, lines}` for the closing day whose `lines` include all sleep-time charges (power bill, spoilage, lease, dues consequences, break-ins), and `income − expenses` equals the change in `creds` from that day's dawn to after `SLEEP` (excluding documented non-cash lines with amount 0). — **U**
- **AC-ENG-135** `stats.customersServed`, `bestSale`, `ghostChitsCaught`, `auditsSurvived`, `totalEarned`, `totalSpent` update correctly on the relevant actions; `totalEarned − totalSpent` reconciles with `creds − startCreds` over a fuzz run. — **U**
- **AC-ENG-136** Dawn feed: each dawn appends entries of kind `lease` (countdown), `hotlist` (when hot list non-empty), and `warning` when `auditPending`; feed entries carry `day`; feed length is bounded (documented cap, e.g. last N days) so saves don't grow unbounded. — **U**

## M1 · Engine (counter: customers & haggling)

- **AC-ENG-141** `OPEN_SHOP` (dawn, no `audit`) sets `phase 'open'` and generates `queue` of length `selectors.customerCountToday(state) = min(14, 6 + floor(appeal/10))` (before M2 modifiers). — **U**
- **AC-ENG-142** `NEXT_CUSTOMER` moves the head of `queue` into `customer`; illegal while a customer is at the counter or the queue is empty. — **U**
- **AC-ENG-143** Every generated customer has all Customer fields of §3.2; `kind ∈ {buyer, seller}` in M1 (specials M2); `patience = patienceMax ∈ [3,5]` on Normal; `hidden.reservation` is a positive integer. — **U**
- **AC-ENG-144** Buyer: `SELECT_ITEM {uid}` accepts only shelf items matching the buyer's `wants` (category or itemId); storage/stash/unknown uid → error. — **U**
- **AC-ENG-145** **Haggle accept:** an `OFFER` within the hidden reservation (buyer: player's asking price ≤ buyer's max; seller: player's offer ≥ seller's min) emits `HAGGLE_ACCEPT` and the agreed price equals the offer. — **U**
- **AC-ENG-146** **Haggle counter:** an unacceptable `OFFER` emits `HAGGLE_COUNTER {price, mood}` with the counter strictly between the previous ask and the player's offer (or equal to reservation), patience −1, and mood not improved. — **U**
- **AC-ENG-147** **Outrageous offer:** an offer > 35% past the reservation costs 2 patience. — **U**
- **AC-ENG-148** **Walk-out:** patience reaching 0 emits `HAGGLE_WALK`/`CUSTOMER_LEFT {reason}`, clears `customer`, applies a small negative rep delta to the customer's faction (`REP_CHANGED`), no money moves. — **U**
- **AC-ENG-149** **Reservation is never violated:** over 10,000 random haggles, no buyer ever pays more than `hidden.reservation` and no seller ever accepts less than its `hidden.reservation`. — **U, S**
- **AC-ENG-150** `DEAL` with a seller: creds −price, item added to inventory with `boughtFor = price`, `acquiredDay = day`, `known` containing only what the player discovered; if no free slot, `DEAL` errors and nothing changes. With insufficient creds `DEAL` errors (no debt from purchases). — **U**
- **AC-ENG-151** `DEAL` with a buyer: item removed, `SALE {uid, price}` emitted; with a chit, sale completes only via `ACCEPT_CHIT` / `REJECT_CHIT` (see 161). — **U**
- **AC-ENG-152** Seller items have hidden truth: across 1,000 sellers some fraction have `flags.stolen`, damaged condition below stated, or lies; the stated condition shown via `known` never reveals hidden flags before inspection. — **U**
- **AC-ENG-153** `REFUSE` clears `customer` with no money change. — **U**
- **AC-ENG-154** `REPORT`: if the customer was doing something illegal (stolen item, ghost chit, M2 undercover rules aside) → bounty creds, +Vantage, −Lantern; otherwise −Sump and the customer leaves. Each rep change emits `REP_CHANGED`. — **U**
- **AC-ENG-155** `CLOSE_SHOP` is legal at any time in `open` (early close allowed), clears `queue` and `customer`, sets `phase 'night'`. — **U**
- **AC-ENG-156** `INSPECT {tool:'serial'}` on an item with a serial instantly sets `known` to whether the serial is on `hotList`. — **U**

## M1 · Engine (ghost chits)

- **AC-ENG-161** A buyer who agrees to pay presents `customer.chit {name, ward, sigilGlitch, expiryDay}`; `DEAL` then requires `ACCEPT_CHIT` or `REJECT_CHIT` before the customer can leave. — **U**
- **AC-ENG-162** A ghost chit (`hidden.ghostChit`) has 1–2 tells, each one of: name ≠ customer name (subtle variant, not identical), ward ≠ customer `homeWard`, `sigilGlitch === true`, `expiryDay < day`. A genuine chit has 0 tells. Verified over 2,000 chits. — **U**
- **AC-ENG-163** `ACCEPT_CHIT` on a ghost: item leaves, sale appears in counter flow, then at `SLEEP` the creds are removed with `CHIT_BOUNCED` and a dayLog line. `REJECT_CHIT` on a ghost: no sale, `stats.ghostChitsCaught += 1`. `REPORT` on a ghost-chit holder pays a bounty. — **U**
- **AC-ENG-164** Ghost-chit rate among buyers ≈ 6% on day 1 rising to ≈ 15% by day 40 on Normal (N ≥ 5,000 buyers per sample day; tolerance ±3 percentage points); higher on Downpour. — **S**

## M1 · Engine (heat, audits, stash) — R2/R3

- **AC-ENG-171** `selectors.isIllegal` is true for `legality 'contraband'`, for `flags.stolen` items, and for `legality 'permit'` items without the permit; false otherwise. — **U**
- **AC-ENG-172** Heat sources/decay per DESIGN §7.3 at `SLEEP`: +2 per illegal item on the **shelf** per day; contraband sale +3…+8 immediately; Grid Tap +4/night; natural decay −5/day; result clamped to [0,100]; each change emits `HEAT_CHANGED {delta}`. — **U**
- **AC-ENG-173** At `SLEEP`, `heat ≥ 60` (Normal, no Crackdown) sets `auditPending = true`; the next dawn feed has a `warning` entry. Heat 59 does not. — **U**
- **AC-ENG-174** **R3:** when dawn begins with `auditPending`, `state.audit` is set immediately to `{found, fine, bribeCost, bribeChance}` covering illegal items on shelf + storage (not stash). — **U**
- **AC-ENG-175** **R3:** after each `MOVE_ITEM` during that dawn, `state.audit` is recomputed: moving an illegal item to stash removes it from `found` and lowers `fine`. Behavioural test: an illegal item moved to stash before `AUDIT_RESPOND` is not confiscated. — **U, E**
- **AC-ENG-176** **R2:** `fine = round(1.5 × Σ basePrice of found)` (basePrice from content, not purchase price). — **U**
- **AC-ENG-177** **R2:** `bribeCost = round(0.20 × fine × (1 − vantageRep/200))`; `bribeChance = clamp(0.50 + vantageRep/200, 0.05, 0.95)`. Checked at vantageRep −100, −10, 0, 50, 100. — **U**
- **AC-ENG-178** **R2:** `AUDIT_RESPOND comply` → pay fine, confiscate found. `bribe` success → pay bribe only, nothing confiscated. `bribe` failure → pay bribe + 2×fine, confiscate, Vantage −10. Empirical success rate within ±3 pts of `bribeChance` over 5,000 trials. — **U, S**
- **AC-ENG-179** After an audit resolves: `heat = 20`, `auditPending = false`, `audit = null`, `stats.auditsSurvived += 1` (unless arrested), `AUDIT` event emitted. — **U**
- **AC-ENG-180** **Arrested:** if Σ basePrice found > 1000 **and** creds after fine < 0 → `phase 'ended'`, `ending.id` = arrested, `win false`, `ENDING` event. Σ ≤ 1000 with negative creds → game continues in debt. — **U**
- **AC-ENG-181** High-Heat stash check (if implemented in M1): threshold documented in STATE.md; at most 1 stash slot checked. — **U**

## M1 · Engine (lease) — R4

- **AC-ENG-191** Lease due days are 7, 14, 21…; amount escalates every due day regardless of payment: week n amount = `round(350 × 1.15^(n−1))` (compounding documented: rounding each week vs. from base — pick one, document it) plus Market Adjustment hikes (M2). Drizzle ×1.10, Downpour ×1.20. — **U**
- **AC-ENG-192** **R4 auto-pay:** at `SLEEP` on the due day with `creds ≥ amount` → creds −amount, `LEASE_PAID`, `nextDueDay += 7`. — **U**
- **AC-ENG-193** **R4 miss:** at `SLEEP` on the due day with `creds < amount` → `LEASE_MISSED`, `graceActive = true`, `missedCount += 1`, `lease.overdue = round(amount × 1.25)`, `nextDueDay += 7`, amount escalates. — **U**
- **AC-ENG-194** **R4 evict:** at the next due day, if `overdue + amount` cannot be paid, `missedCount` reaches 2 ⇒ `phase 'ended'`, ending `evicted`, `win false`. — **U**
- **AC-ENG-195** **R4 `PAY_LEASE`** (dawn/night): pays `overdue` first and clears `graceActive`; with no overdue, pre-pays the upcoming lease so auto-pay on the due day is skipped; insufficient creds → error. — **U**
- **AC-ENG-196** `selectors.daysUntilLease` and `leaseAmount` agree with what `SLEEP` actually charges on the due day. — **U**

## M1 · Engine (dues & break-ins) — R5

- **AC-ENG-200** `selectors.duesQuote = max(15, round(0.05 × stockValue))`. — **U**
- **AC-ENG-197** `PAY_DUES` deducts the quote, sets `duesPaidTonight`, resets `duesSkipStreak = 0`; second `PAY_DUES` same night errors. `SKIP_DUES` increments `duesSkipStreak`. Neither paying nor skipping before `SLEEP` counts as a skip. `duesPaidTonight` resets each night. — **U**
- **AC-ENG-198** **R5:** break-in chance = `min(0.9, (0.25 + 0.10 × (duesSkipStreak − 1)) × (shutter ? 0.5 : 1))` with the streak including tonight. Empirical rate within ±3 pts over 5,000 sleeps for streak 1, 3, and 3+shutter. — **S**
- **AC-ENG-199** A break-in emits `BREAK_IN {stolen:[…]}` and either removes 1–3 items (stash excluded unless documented) or sets one owned machine `broken: true`; a dayLog line is added. — **U**

## M1 · Engine (market, machines, upgrades, M1 trades)

- **AC-ENG-211** At night `market.day === day` and `selectors.marketListings` returns that day's listings; listings change across days (seeded). — **U**
- **AC-ENG-212** **R7 `BUY_STOCK {listingIndex, qty}`:** deducts `price × qty`, decrements listing `qty`, places items in storage first, then shelf; if both full → error `no_space` with nothing changed; insufficient creds → error. Bought items carry `boughtFor`, `acquiredDay`, `spoilsDay` (perishables). — **U**
- **AC-ENG-213** `SELL_TO_MARKET {uid}` (night) removes the item and pays an integer below the item's basePrice-derived market price (documented ratio). — **U**
- **AC-ENG-214** `RUN_MACHINE` validates: machine owned, not broken, idle, recipe belongs to machine, inputs exist and are not already in a job; sets `job {recipeId, inputUids, readyDay}`; inputs are reserved/removed per STATE.md. `COLLECT_MACHINE` before `readyDay` errors; after, produces outputs (respecting capacity, documented overflow rule). — **U**
- **AC-ENG-215** At `SLEEP`: power bill per active machine charged (dayLog line), small breakdown chance; broken machines cannot run until repaired (documented repair path). — **U**
- **AC-ENG-216** **Power Cells:** Cell Charger recipe turns empty/low cells into charged cells at power cost. **Grid Tap** (if owned) makes charging free, adds +4 Heat per night, and has a fire chance (lose stock or a machine) with an event. — **U**
- **AC-ENG-217** **Synth Kitchen:** Vat Cooker recipe makes noodle portions with `spoilsDay`; "stretch with filler" option yields more portions, sets `flags.cut`, and adds a food-poisoning risk (Sump rep hit + fine) when cut food is sold. — **U**
- **AC-ENG-218** **R6 spoilage:** at `SLEEP`, every item with `spoilsDay <= day` is removed; `SPOILED {uids, itemIds}` emitted; dayLog line with amount 0 naming the loss. — **U**
- **AC-ENG-219** **Fencing:** a share of sellers offer `stolen` items with `serial`; `hotList` is regenerated each dawn and includes some serials actually present in the world; selling a hot-listed item raises Heat (and risk); reporting a hot-list seller pays bounty and −Lantern. — **U**
- **AC-ENG-220** **General goods** (salvage, sundry, tech) are legal, low-margin, always available in the market. — **U**
- **AC-ENG-221** `BUY_UPGRADE` / `BUY_MACHINE` deduct creds, are idempotent-safe (buying an owned machine errors), and raise capacity up to the caps: shelf 12, storage 30, stash 0→2→4→6. `availableUpgrades/availableMachines` exclude owned/maxed entries. — **U**
- **AC-ENG-222** Backgrounds needed for M1 trades are fully playable: `sparky` (Cell Charger), `line_cook` (Vat Cooker, +10 Sump), `fence` (2 stash, +15 Lantern, −10 Vantage), `nobody` (60¢, nothing). — **U**

## M1 · Engine (robustness & performance)

- **AC-ENG-231** 30-day fuzz over 50 seeds × 3 difficulties: no exception, invariants (121) hold, game reaches `ended` or day 30. — **S**
- **AC-PERF-101** `step()` median < 5 ms and p99 < 20 ms over a 30-day fuzz (≥ 5,000 steps) in Node on the dev machine; `SLEEP` p99 < 20 ms; `newGame` < 20 ms. — **U, S**
- **AC-PERF-102** `serialize(state).length` < 200 KB after a 60-day fuzz run. — **S**

## M1 · UI

- **AC-UI-101** `http://localhost:8765/` loads with zero console errors/warnings of level error, zero failed requests, title screen visible < 2 s. — **E**
- **AC-UI-102** Title screen: **New Game**; **Continue** shown only when an autosave/slot exists; **Settings**. — **E**
- **AC-UI-103** New-game screen: shop name input (has default, maxlength matches engine cap), background picker (M1: at least sparky, line_cook, fence, nobody; others may show "coming soon"), difficulty picker; Start lands on Dawn day 1. — **E**
- **AC-UI-104** Dawn screen shows the feed (news, messages, LEASEHOLD countdown, hot list, audit warning when pending), stock management with shelf/storage/stash counts vs capacity, **Open Shop** in the bottom action bar. — **E**
- **AC-UI-105** Audit panel (dawn with `state.audit`): shows found items, fine, bribe cost, bribe chance (as %); updates live after moving items to stash; **Comply** / **Bribe**; Open Shop disabled until resolved. — **E**
- **AC-UI-106** Counter: canvas portrait, name, faction badge, mood face, dialogue line, item card (condition, *known* flags only, price), action bar **Deal · Haggle · Inspect · Refuse · Report**; each button's enabled state matches `legalActions`. — **E**
- **AC-UI-107** Haggle: slider snaps to 5¢; quick buttons *their price*, *+10%*, *−10%*; **Offer**; patience pips and mood update after each counter. — **E**
- **AC-UI-108** Buyer item picker lists only shelf items that match the request. — **E**
- **AC-UI-109** Chit panel: holder name, ward code, animated hologram sigil (glitch frame shown when `sigilGlitch`), expiry day; **Accept / Refuse / Report**. — **E**
- **AC-UI-110** **Close Shop** available throughout `open`; leads to Night. — **E**
- **AC-UI-111** Night screen tabs: Market, Workshop, Upgrades & Permits (Contacts / Night Job may be disabled stubs in M1); dues prompt shows the quote with **Pay / Skip**; **Sleep** in action bar. — **E**
- **AC-UI-112** Sleep summary is rendered from the `DAY_SUMMARY` event (not from `state.dayLog`): lines, income, expenses, net; matches the event data. — **E**
- **AC-UI-113** Ledger screen: creds, net worth, lease amount + days until due (+ overdue when in grace), **Pay Lease** (enabled per legalActions), key stats. — **E**
- **AC-UI-114** Settings: audio toggle (default off), reduced-motion override, save slots, delete save with confirmation. — **E**
- **AC-UI-115** Ending screen: title, text, stats (days survived, net worth, best sale, customers served, ghost chits caught, audits survived, faction standings), **New Game**. — **E**
- **AC-UI-116** Events with `text` produce a toast; toasts never block the action bar and auto-dismiss; key events (SALE, CHIT_BOUNCED, BREAK_IN, AUDIT, LEASE_MISSED) have distinct visual treatment. — **E**
- **AC-UI-117** Viewports 375×667, 390×844, 430×932: no horizontal scroll (`scrollWidth ≤ innerWidth`), no clipped primary button, primary action bar entirely in the bottom third. — **E**
- **AC-UI-118** Every interactive element (button, a, input, [role=button], slider thumb) has a bounding box ≥ 44×44 CSS px. — **E**
- **AC-UI-119** **Hidden-info leak test:** for a seller whose item has `flags.stolen && !known.stolen` (and a buyer with known `hidden.reservation`), the rendered DOM text and attributes do not contain the reservation value, nor "stolen"/"counterfeit"/"ghost"/"undercover" for undisclosed flags. — **E**
- **AC-UI-120** UI code never reads `.hidden`, `.flags` (of items/customers), or `.rng`, and never implements rules — static checks in standards.md §8 (S-8/S-9) pass. — **R**
- **AC-UI-121** **Autosave:** after each successful dispatch, the `auto` slot is written within 1 s (debounced); reloading the page and tapping Continue restores a deep-equal state (same day, phase, creds, customer, patience, inspection). — **E**
- **AC-UI-122** Manual slots 1–3: save, load, list (shopName, day, creds, savedAt), delete. — **E**
- **AC-UI-123** Corrupt save in `neonledger.save.auto` (garbage string) → title shows a non-crashing notice; New Game still works. — **E**
- **AC-UI-124** `localStorage` throwing on every access (injected init script) → game boots, is playable, shows a one-time "progress won't be saved" notice; no uncaught errors. — **E**
- **AC-UI-125** No real-time pressure: idling 60 s on the counter changes nothing in state. — **E**
- **AC-UI-126** Rapid double-tap on Deal/Offer/Buy produces at most one state change and no error toast spam. — **E**
- **AC-UI-127** Back-navigation (browser back / swipe) does not lose state or crash; reload on any screen resumes the correct phase's screen. — **E**
- **AC-UI-128** Rain + scanlines on the Counter; disabled with `prefers-reduced-motion: reduce` (emulated). — **E**
- **AC-UI-129** Item icons exist per category and quality tint is visible. — **R**
- **AC-UI-130** **DoD playthrough:** scripted e2e plays start → ≥ 14 days on iPhone 14 emulation with no console errors. — **E**

## M1 · Content

- **AC-CON-101** Every module in `src/content/` imports in Node, exports frozen data (top-level and each entry `Object.isFrozen`). — **U**
- **AC-CON-102** Ids are `snake_case` (`/^[a-z][a-z0-9_]*$/`) and unique within each file. — **U**
- **AC-CON-103** Cross-references resolve: `item.permit` ∈ permits, `item.brand` ∈ brands, recipe inputs/outputs ∈ items, recipe machine ∈ machines, background kit machines ∈ machines, NPC factions ∈ R8 factions. — **U**
- **AC-CON-104** `ITEMS` covers M1 categories `power, food, salvage, sundry, tech, stolen_goods` with ≥ 4 items each; every item: positive integer `basePrice`, `legality ∈ {legal, permit, contraband}`, `size 1`, `tags` array, non-empty `flavor`; food has `perishableDays ≥ 1`. — **U**
- **AC-CON-105** `backgrounds.js` and `difficulties.js` values match DESIGN §10 exactly (creds, kit, rep twists, lease multipliers, patience mods, heat mod, deed prices 24,000/30,000/37,500). — **U**
- **AC-CON-106** `dialogue.js` has every pool key in ARCHITECTURE §5 and each pool ≥ 3 lines; placeholders limited to the documented set; no line > 120 chars. — **U**
- **AC-CON-107** `names.js` provides name parts for each customer faction and a ward list ≥ 6 wards; generated names ≤ 24 chars. — **U**
- **AC-CON-108** `feed.js` provides LEASEHOLD lines (polite, smiley, ≥ 8 variants incl. countdown/late/eviction warning) and news-ticker lines. — **U, R**
- **AC-CON-109** **Originality:** forbidden-terms scan (standards.md §13, S-12) finds zero hits in `src/`, `index.html`, `styles/`, `sw.js`, `manifest.webmanifest`, `tests/` (except the scanner's own term file reference). No rat breeding, water purification trade or space-station setting. — **R, U**
- **AC-CON-110** Tone review: neon-noir, wry, humane; no slurs; factions not cartoon good/evil. — **R**
- **AC-CON-111** Engine contains no display text beyond short fallbacks (≤ 40 chars). — **R**

## M1 · PWA / iOS

- **AC-PWA-101** `manifest.webmanifest` is linked and valid JSON: `name`, `short_name` (≤ 12 chars), `start_url`, `scope`, `display: "standalone"`, `orientation: "portrait"`, `background_color`, `theme_color`, icons 192 and 512 PNG (one `purpose: "maskable"`), all icon files exist with the stated dimensions. — **U, E**
- **AC-PWA-102** `index.html` head: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `apple-mobile-web-app-capable=yes`, `mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-mobile-web-app-title`, `<link rel="apple-touch-icon" href=…180×180 PNG>`, `theme-color`. — **E, R**
- **AC-PWA-103** Service worker registers with scope covering the app (`./`), installs a versioned cache, precaches every same-origin file the app loads (network log ⊆ precache list), deletes old caches on `activate`. — **E**
- **AC-PWA-104** **Offline launch:** after first load + SW activation, set context offline, reload → title screen, Continue works, a full day can be played; zero failed requests that affect function. — **E**
- **AC-PWA-105** **Update flow:** changing the SW version causes the new SW to install; the user either gets an "Update ready — reload" prompt or the update applies at next launch; never mixed old/new assets; saves survive. — **E, M**
- **AC-PWA-106** Zero cross-origin requests during load and a 1-day play. — **E**
- **AC-PERF-103** First load total transferred bytes (all requests, uncompressed if served uncompressed) < 1.5 MB. — **E**
- **AC-PWA-107** Layout uses `100dvh` and `env(safe-area-inset-*)`; on iPhone with notch/Dynamic Island in standalone mode, nothing is under the status bar or home indicator. — **R, M**
- **AC-PWA-108** No double-tap zoom on buttons (`touch-action: manipulation`), no long-press callout/selection on game chrome, no rubber-band revealing white background (body background set; overscroll contained). — **E, M**
- **AC-PWA-109** Audio: no sound before first user gesture; first tap unlocks the AudioContext; toggle persists in settings; nothing throws when AudioContext is unavailable. — **E, M**
- **AC-PWA-110** Haptics: `navigator.vibrate` guarded; absence on iOS causes no error. — **E**
- **AC-PWA-111** **Manual iPhone checklist** (standards.md §12) completed and recorded: Add to Home Screen, standalone launch, airplane-mode launch, kill & relaunch resumes, keyboard on shop name doesn't break layout, landscape handled (usable or rotate prompt), 14 days played. — **M**

---

# M2 — Full game

## M2 · Engine

- **AC-ENG-401** **Chrome Refurb / Probe:** `INSPECT {tool:'probe'}` starts an inspection `{data:{size:4}, inputsLeft:5}`; `INSPECT_INPUT {cell}` (0–15, not yet probed) reveals `'ok'|'fault'`, decrements inputs; invalid/repeat cell → error without consuming a probe; `INSPECT_END` sets `known.untested=false` and a known condition estimate whose accuracy is exact when all faults found. `inspection.hidden` never leaves the engine via events. — **U**
- **AC-ENG-402** Repair at Repair Bench raises condition (documented cost/time). Selling untested chrome that is glitchy → later return: refund + rep loss, or lawsuit fine (event + dayLog). Unpermitted med-grade chrome adds Heat; grade-A chrome requires Med-Tech permit to be legal. — **U**
- **AC-ENG-403** **Data Shards:** Shard Scanner night job (costs power) reveals `junk | memory | corp`; junk can be wiped & sold legally; memories sell to collectors; corp shards: sell to Static (+Static, Heat), return to Vantage (bounty, +Vantage), or hold. Tracer shards add +5 Heat per day held. — **U**
- **AC-ENG-404** **Knock-offs:** Label Printer (requires Lantern knock-off licence) sets `flags.counterfeit/labelled`; tourists (`spire`) pay large markups; buyers with `hidden.verifier` detect fakes → refund + Heat; Gala brand raids possible. — **U**
- **AC-ENG-405** **Appraise:** `INSPECT {tool:'appraise'}` gives `data {marks:[3], brand}`; fakes have exactly 1 wrong mark; `INSPECT_INPUT {mark: i | 'genuine'}` resolves and sets `known.counterfeit`; reference marks available only with Reference Index upgrade (UI reads them from content). `selectors.appraiseHint` documented. — **U**
- **AC-ENG-406** **Undercover auditors:** only when `heat > 30`; ≈ 5% of customers (×2 during Crackdown), tolerance ±2 pts over N ≥ 5,000; each has 1–2 tells in `visibleTells`; selling illegal goods to one: +25 Heat immediately, sale confiscated (no creds). — **U, S**
- **AC-ENG-407** **Specials:** Rook (dues), Inspector Halloran, Auction Drone (Sundays: sealed blind lots), desperate neighbours (credit/charity) appear as `kind 'special'` with `SPECIAL_CHOICE` options listed in `legalActions`; each option's effects documented. — **U**
- **AC-ENG-408** **Factions:** rep clamped ±100; `repTier` thresholds documented and monotone; rep shifts reservation prices by up to ±10%; listed trade-offs (report Lantern fence → +Vantage −Lantern; corp shard to Static → +Static +Heat; charity → +Sump −creds) emit `REP_CHANGED`. High-rep benefits per DESIGN §9 table each have at least one engine effect. — **U**
- **AC-ENG-409** **Contacts:** `CONTACT_FAVOR {npcId, favorId}` — at minimum Static heat scrub (for a price) and an event tip-off; favours gated by rep tier. — **U**
- **AC-ENG-410** **Events calendar:** all nine (Blackout 2–3 d, Flood Week, Spire Gala, Crackdown, Chrome Recall, Shard Leak, Turf War, Market Adjustment, Sunday drone) roll at `SLEEP` and appear as `EVENT_STARTED`; most are forecast 1–3 days ahead in the feed; forecast lead time increases with Static/Sump rep or paid tip-off. — **U**
- **AC-ENG-411** Event effects: Blackout cell demand ×3 and machines without cells idle; Flood −30% customers, food & cell demand up; Gala knock-off demand ×2 + raid chance; Crackdown audit threshold 40 and undercover ×2; Recall refurb demand/prices up; Leak shard prices up and more tracers; Turf War dues ×2 and higher break-in if unpaid; Market Adjustment next lease +10%. — **U**
- **AC-ENG-412** **Perks:** +1 `perkPoints` at the end of each week survived; `CHOOSE_PERK` (any phase) spends one; ≈ 10 perks; Silver Tongue +1 patience, Eagle Eye highlights one suspicious chit field (via public data, not `hidden`), Low Profile −25% heat gain, Night Owl 2 night jobs, Thrifty −10% supplier prices, Good Neighbour + Sump gains, Iron Stomach documented. Can't pick a perk twice. — **U**
- **AC-ENG-413** **Night jobs:** Drain diving (salvage, injury chance → −1 customer next day), Courier run (pay, +Static, +Heat), Help at Mama Ostra's (small pay, +Sump), Collection run (needs Lantern ≥ 20; good pay, −Sump). One per night (two with Night Owl); `nightJobDone` resets nightly. — **U**
- **AC-ENG-414** **Permits** (Vantage: Med-Tech, Power Resale) make their goods legal and charge a weekly fee; **Licences** (Lantern: Knock-off, Hot Goods) require Lantern rep and improve the trade. — **U**
- **AC-ENG-415** **Appeal** from Neon Sign, cleanliness, shelf variety, Sump rep; customers/day formula holds incl. event and injury modifiers; more shelf variety raises average buyer reservation (statistically). Security Shutter halves break-in chance (R5). — **U, S**
- **AC-ENG-416** **All backgrounds & difficulties** per DESIGN §10 including `tinker` (Repair Bench) and `shard_diver` (Scanner, +5 Static); Drizzle +1 patience, Heat gain −25%, lease ×1.10, deed 24,000; Downpour −1 patience, lease ×1.20, deed 37,500, ghost chits more common. — **U**
- **AC-ENG-417** **R1 `BUY_DEED`** (dawn/night) legal iff `creds ≥ deedPrice`; deducts price, `phase 'ended'`, win ending flavoured by highest faction rep ≥ 40 (Vantage → *Franchise of the Spire*, Lantern → *Made in the Sump*, Static → *Free Node*, Sump → *Heart of the Stairwell*), else *Your Own Name on the Door*; tie-break rule documented. Not automatic: having enough creds without the action keeps playing. — **U**
- **AC-ENG-418** **R1 `CONTINUE_ENDLESS`** after a win returns to next dawn with no lease charged thereafter; illegal after a loss. — **U**
- **AC-ENG-419** **Loss endings:** *Taken for a Ride* (Lantern ≤ −60 and dues unpaid 5+ consecutive nights); *Underwater* (creds < −2,000 at 3 consecutive sleeps); plus Evicted, Arrested (M1). Each sets `ending {id, title, text, win:false, stats}` and emits `ENDING`. — **U**
- **AC-ENG-420** **Save migration:** if `SAVE_VERSION` increases, a committed v1 fixture save (`tests/fixtures/`) deserializes to a valid current state (invariants hold, playable 3 more days). — **U**
- **AC-ENG-421** M2 fuzz: 60-day fuzz over 100 seeds × 6 backgrounds × 3 difficulties: no exception, invariants hold, all event types documented. — **S**

## M2 · UI

- **AC-UI-201** Probe mini-game: 4×4 grid of ≥ 44 pt cells, probes-left counter, ok/fault reveal, skip ("buy blind") option. — **E**
- **AC-UI-202** Appraise: 3 maker's marks, "all genuine" option, Reference Index panel (from content) only when the upgrade is owned. — **E**
- **AC-UI-203** Scan results shown at dawn/night for scanned shards; corp-shard choice (Static / Vantage / hold). — **E**
- **AC-UI-204** Contacts tab lists four contacts with rep tier and available favours; Night Job tab lists jobs with requirements; disabled entries show why. — **E**
- **AC-UI-205** Perk chooser appears when `perkPoints > 0`; Eagle Eye highlight drawn on the chit panel. — **E**
- **AC-UI-206** Special customers render choice buttons from `legalActions`; Auction Drone and 0xWREN (screen-only) have distinct presentation. — **E**
- **AC-UI-207** Undercover tells are visible in the portrait/dialogue (e.g. Vantage-issue boots drawn by the portrait generator). Portrait is deterministic: same `portrait` → identical pixels. — **E, U**
- **AC-UI-208** Feed shows event forecasts and active events. — **E**
- **AC-UI-209** Audio: WebAudio synth blips (cha-ching, rain loop, buzzer); off by default; toggle in settings. — **E, M**
- **AC-UI-210** All 9 ending screens render; Buy the Deed button visible in Ledger when legal; endless-mode continue after win. — **E**
- **AC-UI-211** All six backgrounds and three difficulties selectable with their twists described. — **E**

## M2 · Content

- **AC-CON-201** `ITEMS` totals 50–70 items covering all 9 categories; chrome/shard/luxury items present. — **U**
- **AC-CON-202** `BRANDS`: each has 3 genuine `marks` and ≥ 2 `fakeMarks`, no fake equals a genuine mark of the same brand; branded items' `marks` equal their brand's. Brands are fictional. — **U, R**
- **AC-CON-203** `NPCS` includes Halloran, Rook, 0xWREN, Mama Ostra, Old Tamsin, Auction Drone, LEASEHOLD with faction, role, portraitTraits, and ≥ 5 lines each in key situations. — **U**
- **AC-CON-204** `EVENTS`: the nine events with `durationDays [min,max]`, `weight > 0`, `minDay`, `effects`, and `feedText {forecast, start, end}` non-empty. — **U**
- **AC-CON-205** `machines.js` has the 9 machines of DESIGN §8; `perks.js` ≈ 10 perks; `jobs.js` 4 jobs; `permits.js` 2; `licences.js` 2; `endings.js` all 5 win variants + 4 losses; `recipes.js` covers every machine that produces output. — **U**
- **AC-CON-206** Originality scan (AC-CON-109) and tone review repeated on full content. — **R**

---

# M3 — Balance & polish

## M3 · Balance

- **AC-BAL-301** "Decent" sim bot on Normal buys the Deed with median day in [45, 70] over ≥ 200 seeds. — **S**
- **AC-BAL-302** "Reckless" bot (sells contraband freely, skips dues, ignores Heat) ends Evicted/Arrested/Taken for a Ride in ≥ 70% of 200 seeds before day 60. — **S**
- **AC-BAL-303** "All-legal" bot can win (≥ 30% of 200 seeds by day 150) and its median win day is later than the decent bot's. — **S**
- **AC-BAL-304** Every background is viable: decent-bot win rate by day 120 ≥ 40% for each (Nobody ≥ 20%); no single trade's earnings/day exceeds 2× the median trade. — **S**
- **AC-BAL-305** Difficulty ordering: median win day Drizzle < Acid Rain < Downpour. — **S**
- **AC-BAL-306** A real day takes 3–6 minutes of play (manual timing over 5 days). — **M**

## M3 · Polish, accessibility, performance

- **AC-UI-301** First-run onboarding hints for Dawn, Counter, haggling, chits, Night, audits; dismissible; never shown again once dismissed (setting persisted). — **E**
- **AC-A11Y-301** Body text contrast ≥ 4.5:1 and large text/UI glyphs ≥ 3:1 against their backgrounds (computed in e2e for all text nodes on each screen). — **E**
- **AC-A11Y-302** Every icon-only button has an `aria-label`; every input has a label; canvas portraits have `role="img"` + `aria-label`. — **E, R**
- **AC-A11Y-303** `prefers-reduced-motion: reduce` disables rain, scanline flicker, sigil animation intensity, and screen transitions (non-essential motion). — **E**
- **AC-A11Y-304** Text remains usable with iOS Larger Text / browser zoom 200% (no overlap of action bar). — **M, E**
- **AC-A11Y-305** VoiceOver can reach and activate all counter actions in order. — **M**
- **AC-PERF-301** Counter, haggle and chit animations run at 60 fps: no long task > 50 ms during a scripted 20-interaction session (Chromium trace, 4× CPU throttle tolerated to 30 fps); animations use only `transform`/`opacity`. — **E, R**
- **AC-PERF-302** `step()` p95 < 5 ms on 60-day fuzz; total JS + CSS + HTML < 1.5 MB still; no memory growth > 20 MB over a 60-day scripted e2e session. — **U, E**
- **AC-PERF-303** Zero console errors over a 60-day scripted e2e session. — **E**
- **AC-PWA-301** Manual iPhone checklist (standards §12) re-run on the release candidate; SW update tested from the previous RC. — **M**
