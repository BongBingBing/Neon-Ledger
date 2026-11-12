# Neon Ledger — Code Standards & Review Checklist

Owner: SQA. Applies to all product code (`src/`, `index.html`, `styles/`, `sw.js`, `manifest.webmanifest`, `icons/`).
Contract: `docs/ARCHITECTURE.md` (§3 engine API/state/actions/events, §4 UI, §5 content, §6 rules R1–R8). Acceptance criteria: `docs/QA/acceptance.md`.

**Severity guide for review findings**
- **blocker** — breaks the contract, loses/corrupts saves, leaks hidden info, nondeterminism in engine, crash/uncaught error in normal play, forbidden (originality) term, offline launch broken.
- **major** — rule implemented wrongly vs DESIGN/§6, UI computes a rule, missing required feature for the milestone, iOS-only breakage, perf budget blown, a11y failure on a primary flow.
- **minor** — edge-case bug, missing documentation (STATE.md/EVENTS.md), small layout issue, warn-level static hit confirmed real.
- **polish** — naming, copy, style, nice-to-have.

---

## 1. How to run the static checks

```sh
./tools/node docs/QA/checks/qa-static.mjs          # human-readable; exit 1 on any ERROR
./tools/node docs/QA/checks/qa-static.mjs --json   # machine-readable
```
The script is read-only. Rule IDs in its output (`S-n`) are the sections below. `WARN` = SQA triages by hand. The Tester may call it from a unit test; it must stay dependency-free.

## 2. General code (all areas) — S-1

- [ ] Plain ES modules, relative imports with explicit `.js` extension, no bare specifiers, no build step, no npm deps. Every file parses as a module (S-1).
- [ ] Targets iOS Safari 16.0+: no newer syntax/APIs without a guard. OK: `structuredClone`, `findLast`, `toSorted`/`toSpliced`/`with`, `:has()`, `dvh`/`svh`, top-level `await`, private class fields. **Not OK** (Safari 17+): `Object.groupBy`/`Map.groupBy`, `Promise.withResolvers`, `Set.prototype.union` & friends, regex `v` flag, `Array.fromAsync`, CSS nesting (16.5+, relaxed syntax 17.2), `@container` style queries. When in doubt, check and add a fallback.
- [ ] No `eval`, `new Function`, `innerHTML` with interpolated non-constant strings (content text must go through `textContent` or an escaping helper).
- [ ] Small pure functions; no dead code; no `console.log` left in shipped paths (use a debug flag).
- [ ] No magic numbers for game rules outside `src/engine/balance.js` / content.

## 3. Engine — purity & determinism — S-2, S-3

- [ ] **No** `window`, `document`, `localStorage`/`sessionStorage`/`indexedDB`, `navigator`, `fetch`, timers, `requestAnimationFrame`, `performance.now`, `Date.now`/`new Date`, `Math.random`, `crypto.*`, `process`, `globalThis`/`self` in `src/engine/**` (S-2, ERROR).
- [ ] All randomness from the seeded PRNG in `state.rng` (uint32). PRNG advance is a pure function `(rng) → [value, rng']`; every random draw is written back into the new state.
- [ ] Iteration order is explicit: avoid `for…in` over objects whose key order could differ; `sort()` always with a comparator and a total order (tie-break on id/uid) (S-3, WARN).
- [ ] No dependence on object identity, `Map` insertion of external data, or floating-point accumulation across days (compute money in integers; see §5).
- [ ] Engine imports only from `src/engine/**` and `src/content/**` (S-6).
- [ ] Display text comes from content; engine fallback strings ≤ 40 chars.

## 4. Engine — contract behaviour — S-4

- [ ] **No input mutation:** `step` does `structuredClone(state)` (or equivalent) on entry and mutates only the clone. Selectors and `legalActions` never mutate. Content objects (frozen) are never mutated — clone before attaching to state.
- [ ] **Never throws** for any action/state input (AC-ENG-109/110). Pattern: validate → on failure `return { state, events: [], error: 'code' }` with the **original** state object. Wrap the dispatcher body in `try/catch` that converts unexpected exceptions into `{ state, events: [], error: 'internal:<msg>' }` (defence in depth; the test suite still treats `internal:` errors as bugs). `throw` in engine is WARN (S-4) and must be unreachable from public API.
- [ ] Error codes are short stable `snake_case` strings (e.g. `wrong_phase`, `no_space`, `insufficient_creds`, `unknown_uid`, `bad_param`) documented in EVENTS.md or STATE.md.
- [ ] Validate every param: type (`Number.isInteger` for prices/qty/indexes), range, ownership (uid exists and is in the right location), phase.
- [ ] `legalActions` and `step` share the same validation functions (no drift). Every descriptor returned must succeed (AC-ENG-111).
- [ ] State is JSON-safe (AC-ENG-114): no `undefined` in arrays, no `NaN`/`Infinity`, no class instances.
- [ ] New nested fields → documented in `src/engine/STATE.md`; new event types → `src/engine/EVENTS.md` (which carry `text`).
- [ ] `hidden` truth (`customer.hidden`, `item.flags`, `inspection.hidden`) never copied into events, `visibleTells`, `known`, `feed` text, or `text` fields except when the rules reveal it.
- [ ] §6 rules R1–R8 implemented exactly as written (audit preview recompute on every `MOVE_ITEM`, lease grace/escalation, break-in formula, spoilage removal, `BUY_STOCK` storage→shelf, canonical ids, `BUY_DEED`, `DAY_SUMMARY`).
- [ ] `SAVE_VERSION` bump ⇒ migration function `vN → vN+1` added, chained, tested with a fixture; `deserialize` never throws.

## 5. Money — S-5

- [ ] All money values are integers (¢). Every multiplication/division by a non-integer is immediately wrapped in `Math.round` (or a single documented helper, e.g. `money(x)`), not rounded later.
- [ ] No `toFixed`/`parseFloat` in engine (S-5 WARN). Formatting (thousands separators, `¢`) is UI-only.
- [ ] Prices clamped ≥ 0 where a negative price is meaningless; creds may go negative only via sanctioned paths (fines, bounced chits, lease, sleep charges) — not via `BUY_STOCK`/`DEAL`/`BUY_*`.
- [ ] Compounding values (lease escalation) computed by a documented rule so they are reproducible (AC-ENG-191).

## 6. Ownership boundaries & dev code — S-6

- [ ] Each agent edits only its own tree (TEAM.md / ARCHITECTURE §2). Reviews flag any file created outside the owner's area.
- [ ] UI imports engine **only** via `src/engine/index.js` (no deep imports). Content imports nothing from engine/UI/platform. Engine imports nothing from UI/platform.
- [ ] Dev-only code (e.g. `src/ui/dev/mockEngine.js`) must not be imported by default in shipped paths; if wired, behind an explicit `?dev` / settings flag, and excluded from the service-worker precache. It is exempt from S-8 rules but must not become the source of real behaviour.

## 7. Content — S-7

- [ ] Each module exports **frozen** data (deep-freeze entries), `snake_case` unique ids, schema per ARCHITECTURE §5.
- [ ] No logic beyond trivial data construction; no engine/UI imports; no DOM/random/time APIs.
- [ ] Placeholders only from the documented set (`{item}`, `{price}`, `{name}` …); no line > 120 chars; LEASEHOLD voice consistently polite.
- [ ] Originality scan (§9) clean.

## 8. UI — hidden info, rules, state — S-8, S-9

- [ ] **UI never reads** `customer.hidden`, `inspection.hidden`, item `flags`, or `state.rng` (S-8, ERROR). Show item truth only via `known`. To keep the grep reliable, **do not use the DOM `.hidden` property**; use `el.toggleAttribute('hidden', bool)` or a CSS class.
- [ ] **UI never mutates GameState** (no assignments, no `push/splice/sort` on state objects) (S-8). It only calls `dispatch(action)`.
- [ ] **No rules in UI:** enabling/disabling and costs come from `legalActions` and `selectors` (e.g. `duesQuote`, `leaseAmount`, `audit.bribeChance`). Hard-coded balance numbers in UI (S-9 WARN) are findings unless purely visual.
- [ ] Sleep summary is rendered from the `DAY_SUMMARY` event; toasts from event `text`.
- [ ] `dispatch` guards against re-entry/double taps (disable buttons while a dispatch/animation is in progress).
- [ ] Every engine `error` is handled (gentle toast or silent) — never an uncaught exception.
- [ ] User text (shop name) rendered with `textContent`; never `innerHTML`.
- [ ] Event listeners cleaned up on screen change (no listener leaks over a 60-day session); one `requestAnimationFrame` loop max, paused when hidden (`visibilitychange`).

## 9. Error handling & storage — S-10

- [ ] `localStorage` only in `src/platform/storage.js` (S-10). **Every** access (`getItem`, `setItem`, `removeItem`, `key`, `length`) inside `try/catch` — Safari private mode / quota / disabled storage throw.
- [ ] `save` returns a success boolean; UI shows a one-time notice when saving fails; the game remains playable in memory.
- [ ] `load` returns `null` on any failure; corrupt JSON → `deserialize` returns `null` → UI offers New Game without deleting the bad save silently (keep it as `neonledger.save.<slot>.corrupt` or ask).
- [ ] Write order is safe: serialize first, then a single `setItem` (no partial multi-key writes for one save).
- [ ] Keys prefixed `neonledger.`; settings separate from saves.
- [ ] Global `window.onerror`/`unhandledrejection` handler in `main.js` logs and shows a recoverable error screen (with "Reload" and "Export save" options).

## 10. Performance budgets — S-15

| Budget | Target | Check |
|---|---|---|
| First load, total bytes (HTML+JS+CSS+icons+manifest) | **< 1.5 MB** (aim < 500 KB) | S-15, AC-PERF-103 |
| `step()` typical | **median < 5 ms**, p99 < 20 ms (Node, dev machine) | AC-PERF-101 |
| `SLEEP` resolution | p99 < 20 ms | AC-PERF-101 |
| Save size | < 200 KB after 60 days | AC-PERF-102 |
| Animations | **60 fps**: only `transform`/`opacity`; no layout thrash; no long task > 50 ms during interactions | AC-PERF-301 |
| Time to interactive (title) | < 2 s on iPhone 14 emulation | AC-UI-101 |
| Portrait draw | < 4 ms per portrait; cache by seed | review |
| Feed / logs | bounded length (no unbounded arrays in state) | AC-ENG-136 |

## 11. Accessibility — S-14

- [ ] Body text contrast ≥ **4.5:1**, large text & UI glyphs ≥ 3:1 (neon on near-black is fine; magenta on indigo often fails — check).
- [ ] Every icon-only control has `aria-label`; inputs have labels; canvas portraits `role="img"` + `aria-label` (name + mood).
- [ ] Tap targets **≥ 44×44 pt**, ≥ 8 px apart; primary actions in the bottom third.
- [ ] `prefers-reduced-motion: reduce` honoured (rain, scanline flicker, sigil animation, transitions) plus an in-game override.
- [ ] Information never conveyed by colour alone (mood face + word; legality icon + label; tells must be visible shapes, not just hue).
- [ ] Do not disable zoom via `user-scalable=no`/`maximum-scale=1` (WARN); prevent double-tap zoom with `touch-action: manipulation` instead.
- [ ] Focus visible for keyboard users; buttons are `<button>` elements; live toasts in an `aria-live="polite"` region.
- [ ] Respects iOS text-size where feasible (rem-based type; layout survives 200% zoom).

## 12. iOS PWA checklist — S-13 (static) + manual

**Static (review / S-13):**
- [ ] `manifest.webmanifest`: `name`, `short_name` (≤ 12 chars), `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `orientation: "portrait"`, `background_color` = app background, `theme_color`, icons 192 & 512 PNG + one `maskable`; relative paths so it works under any sub-path.
- [ ] `index.html` head: `viewport` = `width=device-width, initial-scale=1, viewport-fit=cover`; `apple-mobile-web-app-capable` = `yes`; `mobile-web-app-capable` = `yes`; `apple-mobile-web-app-status-bar-style` = `black-translucent`; `apple-mobile-web-app-title`; `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">` **180×180 PNG, opaque** (iOS ignores manifest icons and SVG); `theme-color`; manifest link.
- [ ] Optional: `apple-touch-startup-image` or a splash matching `background_color` to avoid a white flash.
- [ ] Layout: root height `100dvh` (with `100vh` fallback before it); padding `env(safe-area-inset-top/bottom/left/right)`; action bar above the home indicator.
- [ ] No double-tap zoom: `touch-action: manipulation` on `html` or all controls; `-webkit-tap-highlight-color: transparent`; `-webkit-touch-callout: none` + `user-select: none` on game chrome (not on text inputs).
- [ ] No rubber-band reveal: `html, body { background: <app bg>; overscroll-behavior: none; }`; scroll only inside designated panels.
- [ ] Inputs: font-size ≥ 16 px (prevents iOS auto-zoom on focus); layout survives the on-screen keyboard (`visualViewport` aware or the input near the top).
- [ ] Audio: create/resume `AudioContext` inside the first `touchend`/`click` handler; handle `interrupted`/`suspended` state after backgrounding (resume on next gesture and on `visibilitychange`); off by default.
- [ ] `navigator.vibrate` feature-detected (absent on iOS).
- [ ] **Service worker:** registered from root (`./sw.js`) so scope covers the app; cache name includes a version constant (`neonledger-v<N>`); `install` precaches the full app shell (every file the app loads — no lazy-loaded module missing from the list); `activate` deletes caches ≠ current and calls `clients.claim()`; `fetch` is cache-first for same-origin GET with network fallback, and navigation requests fall back to cached `index.html`.
- [ ] **Update flow:** new SW waits; page detects `registration.waiting` / `updatefound` and shows "Update ready — tap to reload" (posts `SKIP_WAITING`, reloads on `controllerchange`), **after** autosave. Never `skipWaiting()` unconditionally mid-session (mixed old JS + new assets). Version constant bumped on every shipped change (review gate).
- [ ] Offline: no network requests at all at runtime (S-11).
- [ ] Persistent storage: call `navigator.storage?.persist?.()` (guarded); note iOS may evict script-writable storage for non-installed sites after 7 days of no use — installed Home Screen apps are exempt but have **separate storage from Safari** (save made in Safari won't appear in the installed app). Consider save export/import (copy text) as a safety net.

**Manual on a real iPhone (AC-PWA-111) — record device, iOS version, date, result in `docs/QA/findings/iphone-<date>.md`:**
1. Open in Safari → no console errors (Web Inspector via Mac if available) → play to Counter.
2. Share → Add to Home Screen: correct icon (no black square), correct title.
3. Launch from icon: standalone (no Safari chrome), status bar readable, nothing under notch / Dynamic Island / home indicator.
4. Play 1 day; force-quit; relaunch → resumes exact state.
5. Airplane mode; force-quit; launch → boots offline and plays.
6. Double-tap rapidly on buttons → no zoom; long-press → no callout/selection; scroll edges → no white rubber-band.
7. Shop-name input: no auto-zoom; keyboard doesn't hide the confirm button.
8. Audio: silent until first tap; toggle on → sounds; background the app and return → audio still works after a tap.
9. Rotate to landscape → usable or a clear "rotate back" message.
10. Settings → Accessibility → Reduce Motion on → rain/flicker off. Larger Text → still usable.
11. Deploy an update (bump SW version) → relaunch → update prompt/behaviour as designed; save intact.
12. iPhone SE size (or Simulator) → no clipped actions.

## 13. Originality checklist — S-12

Rule: DESIGN §0. Nothing derived from existing games: names, characters, items, places, dialogue, art, UI.

- [ ] **Hard list** (`docs/QA/forbidden-terms.txt`, any hit = blocker): the DESIGN §0 names and themes, plus franchise terms. Includes (non-exhaustive, see file): DESIGN §0 list; *ripperdoc, eddies, eurodollar, netrunner, choom, preem, gonk, Night City, Arasaka, Militech, Kang Tao, Biotechnica, Trauma Team, Tyger Claws, Voodoo Boys, Valentinos, Silverhand, braindance, Sandevistan, Kiroshi, mantis blades, nuyen, chummer, Renraku, Saeder-Krupp, Aztechnology, Sarif, Tai Yong, Hengsha, replicant, Tyrell, Voight-Kampff, Wintermute, Tessier-Ashpool, Ono-Sendai, simstim, Tachikoma, cyberbrain, Arstotzka, EZIC, Grestin, Kolechia, Karmotrine, Valenstein, Glitch City, Recettear, Moonlighter, Rynoka*, and game titles.
- [ ] **Watch list** (`docs/QA/watch-terms.txt`, WARN — SQA checks context): generic words strongly tied to franchises (*fixer, corpo, edgerunner, decker, street samurai, Afterlife, Maelstrom, Relic, nova, eddy, Jackson, Praxis, Chiba, Section 9…*). Generic genre words (chrome, implant, Heat, credchit, mesh) are fine.
- [ ] Scope scanned: `src/`, `index.html`, `styles/`, `sw.js`, `manifest.webmanifest`, `icons/`, `tests/`, `src/engine/*.md`. The two term files and `docs/DESIGN.md` §0 are the only sanctioned locations for these strings; tests needing the list must read it from the file, not copy it.
- [ ] Grep one-liner (equivalent to S-12):
  ```sh
  grep -rniwF -f <(grep -v '^#' docs/QA/forbidden-terms.txt | sed '/^$/d') src index.html styles sw.js manifest.webmanifest icons tests 2>/dev/null
  ```
- [ ] No rat breeding, water-grade/purification trade, or space-station setting; no shopkeeper-sim UI layouts copied from a specific game (review screenshots).
- [ ] Brands, NPCs, wards, corps are original names (quick web-sanity on any name that "sounds familiar"; rename if it matches a known IP).
- [ ] Art is procedural (canvas/SVG/CSS) — no bitmap assets other than generated icons; no embedded third-party sprites/fonts.

## 14. Review checklist (per pass)

1. `./tools/node docs/QA/checks/qa-static.mjs` → triage every ERROR/WARN.
2. Engine: read `index.js` exports vs §3.1; read `step` dispatcher for clone-on-entry, try/catch, validation; check R1–R8 against code; check STATE.md / EVENTS.md exist and match.
3. Quick behavioural probes with `./tools/node -e` (newGame per background, a few illegal actions, freeze-and-step, serialize round-trip, 10-day random-legal fuzz with invariants).
4. UI: screens vs §4 list; dispatch path (no mutation, re-entry guard, autosave debounce, error handling); grep for hidden/flags; render text via `textContent`; listeners cleanup.
5. Content: schema/cross-ref checks; frozen; text length; tone; originality.
6. PWA: head tags, manifest, SW lifecycle/version/precache list; size budget.
7. Write `docs/QA/findings/review-<n>.md` (TEAM.md format), message `main` with counts + blocker/major titles.
