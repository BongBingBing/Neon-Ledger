# Tester bug batch 1

### [T1-01] newGame falls back to Date.now() when no seed is given           severity: minor   owner: engine
Where: src/engine/state.js:40
Repro: `newGame({ background:'tinker', difficulty:'acid', shopName:'X' })` with no `seed`.
Expected: the engine never reads the wall clock (ARCH §3, AC-ENG-115, SQA S-2). If a seed is missing, the UI should supply one, or the engine should use a documented constant.
Actual: `Date.now() ^ 0x5bd1e995` is used. SQA's static check reports ERROR S-2.
Evidence: tests/unit/content.test.mjs "AC-ENG-102 AC-ENG-115 engine has no DOM / storage / Math.random / Date access"; tests/unit/qa_static.test.mjs

### [T1-02] market_adjustment event has empty feedText.end           severity: polish   owner: content
Where: src/content/events.js:100
Expected: AC-CON-204 says `feedText {forecast, start, end}` must be non-empty. An instant event could use a short "adjustment applied" line.
Actual: `end: ''`
Evidence: tests/unit/content.test.mjs "AC-CON-204 events: nine calendar events with valid fields"

### [T1-03] Engine content adapter silently swallows content import errors           severity: minor   owner: engine
Where: src/engine/content.js `tryImport` (`catch { return null; }`)
Repro: introduce a syntax error into any src/content/*.js. The engine silently uses fallbackContent.js.
Expected: a missing file falls back. A broken file should surface (console.warn, or exposed in `SOURCES`) so that content regressions don't pass unnoticed.
Evidence: code review. The unit test "engine content adapter loads real content, not fallback" checks `SOURCES` once the engine lands.
