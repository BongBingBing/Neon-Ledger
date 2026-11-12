# Neon Ledger — Quality Risk Register

Owner: SQA. Scored Likelihood (L) × Impact (I), 1–3 each. Reviewed every review pass; status updated in place.

| # | Risk | L | I | Score | Owner | Status |
|---|---|---|---|---|---|---|
| R-01 | Engine/UI contract drift (concurrent dev; UI built against a mock) | 3 | 3 | 9 | main / engine / ui | open |
| R-02 | iOS Safari / standalone quirks not caught by Chromium emulation | 3 | 3 | 9 | ui / main | open |
| R-03 | Hidden-info leak to UI (`hidden`, `flags`) — breaks the "spot the tell" game | 2 | 3 | 6 | ui | open |
| R-04 | Nondeterminism / input mutation in engine (breaks saves, sim, tests) | 2 | 3 | 6 | engine | open |
| R-05 | Save loss or corruption (storage eviction, migration, partial writes) | 2 | 3 | 6 | ui / engine | open |
| R-06 | Service-worker update traps users on a stale or mixed version | 2 | 3 | 6 | ui | open |
| R-07 | Balance: unwinnable or trivial; one dominant trade; lease curve too steep | 3 | 2 | 6 | engine / tester | open |
| R-08 | Ambiguous rules in DESIGN interpreted differently by engine, tests and UI | 3 | 2 | 6 | main | partly mitigated (§6 R1–R8) |
| R-09 | Originality violation (familiar names/slang slipping into content) | 2 | 3 | 6 | content | open |
| R-10 | Scope: M2 breadth (6 trades, 9 events, 4 factions, mini-games) overruns | 3 | 2 | 6 | main | open |
| R-11 | Performance on older iPhones (canvas portraits, rain, structuredClone per step) | 2 | 2 | 4 | ui / engine | open |
| R-12 | Accessibility regressions (neon contrast, tiny targets, motion) | 2 | 2 | 4 | ui | open |
| R-13 | Test oracle weakness: tests reimplement formulas and share the engine's bug | 2 | 2 | 4 | tester | open |
| R-14 | Content/engine schema mismatch (ids, missing fields, fallback content masking gaps) | 3 | 2 | 6 | engine / content | open |

---

### R-01 Engine/UI contract drift
*Why:* UI and engine are built in parallel; the UI has a dev mock engine (`src/ui/dev/mockEngine.js`) that encodes its own guesses about state shape and rules. Divergences surface late, at integration.
*Mitigation:*
- ARCHITECTURE §3 is the single contract; changes only via `main`, with a changelog line.
- Contract conformance tests in `tests/unit/` (AC-ENG-101/103/111/119) run against the real engine; the **same** shape assertions also run against the mock while it exists, so mock ≠ engine shows as a test failure.
- UI consumes only `selectors`, `legalActions`, event payloads; no deep imports (S-6). SQA greps every pass.
- Integration milestone gate: by M1 sign-off the mock must be unused in the default path (S-6 dev-code check).
- EVENTS.md / STATE.md required before M1 sign-off (AC-ENG-119).

### R-02 iOS Safari quirks not caught by Chromium
*Why:* WebKit can't run here; Playwright uses Chromium with an iPhone descriptor (viewport/UA only). Real-device-only issues: `100vh` vs toolbar, safe areas, standalone storage partition, AudioContext unlock/interrupt, input auto-zoom, double-tap zoom, rubber-band scroll, SW update behaviour, PNG-only touch icons, Safari 16 API gaps.
*Mitigation:*
- Static iOS checklist (standards §12, S-13) enforced every review.
- API allow/deny list for Safari 16 (standards §2) checked in review.
- Mandatory **manual iPhone run** (AC-PWA-111) recorded before M1 and M2 sign-off; nothing iOS-specific is "passed" on emulation alone. If no device is available, SQA marks those criteria **unverified** and the milestone is conditional-go at best.
- Defensive coding: feature-detect `vibrate`, `AudioContext`, `storage.persist`; `dvh` with `vh` fallback; inputs ≥ 16 px.

### R-03 Hidden-info leak
*Why:* `customer.hidden`, `item.flags`, `inspection.hidden` are in the same state object the UI renders; one careless template leaks the answer (also via devtools — acceptable, but not via DOM).
*Mitigation:* S-8 grep (ERROR), DOM leak e2e (AC-UI-119), engine never copies hidden truth into events/`text`/feed, Eagle Eye implemented as an engine-computed public hint.

### R-04 Nondeterminism / mutation
*Mitigation:* S-2/S-3 static checks; AC-ENG-106/108/115 (determinism, deep-freeze, Math.random/Date stubs throw); `structuredClone` on entry; comparator-always sorts.

### R-05 Save loss / corruption
*Why:* Safari may evict script-writable storage for non-installed sites after 7 days unused; Home Screen app storage is separate from Safari's; quota/private-mode throws; future `SAVE_VERSION` bumps.
*Mitigation:* storage try/catch everywhere (S-10); single-key atomic writes; corrupt-save handling (AC-UI-123); `navigator.storage.persist()`; **save export/import as text** (recommended M2 feature); fixture-based migration tests from v1 onward (AC-ENG-420); tell players to install before long play (onboarding hint).

### R-06 Service-worker update trap
*Mitigation:* versioned cache, delete old caches on activate, user-confirmed `SKIP_WAITING` after autosave, version bump enforced in review whenever shipped files change, precache list completeness check (S-13 WARN + AC-PWA-103), AC-PWA-105 update test.

### R-07 Balance
*Why:* lease compounds ×1.15/week (week 10 ≈ 1,231¢, week 20 ≈ 4,980¢); deed 30,000¢; day-45–70 target leaves little slack; multiple stochastic ruin sources (audits, break-ins, ghost chits).
*Mitigation:* Tester's sim bots (decent / reckless / all-legal / per-background) early — run at M1, not only M3; balance knobs centralised in `src/engine/balance.js`; AC-BAL-301…305 as quantitative gates; report earnings/day per trade to detect dominance.

### R-08 Ambiguous rules
Known ambiguities to settle (SQA will raise as findings if code chooses silently):
- Lease escalation compounding/rounding method (round each week vs from base) — AC-ENG-191.
- "Neither pay nor skip" counts as skip (R5 settles) — verify UI doesn't present this as "paid".
- Ghost-chit `REJECT_CHIT` on a **genuine** chit: consequence (rep loss? customer leaves?) unspecified.
- Undercover tells vs ordinary Vantage-faction customers (Vantage boots on a real Vantage officer?).
- High-Heat stash check threshold (§7.3 "at high Heat") unspecified.
- Which items Break-in can steal (stash included?) unspecified.
- Seller `DEAL` when shelf/storage full — error vs auto-place (R7 covers only `BUY_STOCK`).
- Win flavour tie-break when two factions tie ≥ 40.
- Whether contraband sale Heat +3–8 scales with value.
*Mitigation:* engine documents choices in STATE.md; `main` ratifies into ARCHITECTURE §6; acceptance updated.

### R-09 Originality
*Mitigation:* hard + watch term lists, S-12 scan each pass and in a unit test; content review for "sounds familiar" names; procedural art only.

### R-10 Scope (M2 breadth)
*Mitigation:* M1 gate strictly on M1 list; M2 features behind content data so partial delivery stays coherent; acceptance criteria let `main` cut features explicitly rather than shipping them half-done.

### R-11 Performance
*Why:* `structuredClone` of a growing state on every `step`, unbounded `feed`, per-frame portrait redraw, full re-render per dispatch.
*Mitigation:* bounded feed/history (AC-ENG-136), save-size budget (AC-PERF-102), step timing test (AC-PERF-101), portrait cache by seed, rain via CSS transform, rAF paused on `visibilitychange`.

### R-12 Accessibility
*Mitigation:* contrast e2e (AC-A11Y-301), 44 pt target e2e (AC-UI-118), reduced-motion e2e (AC-UI-128 / A11Y-303), aria-label checks; magenta/indigo palette pre-checked.

### R-13 Weak test oracles
*Why:* tests that recompute fines/bribes with the same formula as the engine catch nothing if the formula misreads DESIGN.
*Mitigation:* acceptance criteria quote literal expected numbers (e.g. bribe at vantageRep 0 with fine 1,000 → cost 200, chance 0.50); Tester uses hand-computed fixtures; SQA reviews a sample of tests against acceptance IDs.

### R-14 Content/engine schema mismatch
*Why:* engine ships a `fallbackContent.js`; if content is missing or mis-named, the engine may silently use fallback text/data and tests still pass.
*Mitigation:* a test asserting that, with real content present, no fallback entries are used (or fallback is only for strings); cross-ref checks (AC-CON-103); canonical ids R8.
