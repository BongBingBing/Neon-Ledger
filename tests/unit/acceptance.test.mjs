// Additional engine acceptance criteria from docs/QA/acceptance.md not covered by the topic files.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { engine, SKIP_ENGINE, ROOT, read, fresh, act, actFails, evTypes, hasLegal, legal, skipDay, nextDay, makeInv, items,
  clone, completeAction, mulberry, stockShelf, findCustomer, selectableUids, isBuyer, isSeller, backgroundIds, DIFFICULTIES } from './_helpers.mjs';

const skip = SKIP_ENGINE;

/** Uniform fuzz per acceptance.md conventions. cb(prev, action, result). */
function fuzz({ seed, background = 'sparky', difficulty = 'acid', days = 10, maxSteps = 4000 }, cb) {
  let s = engine.newGame({ seed, background, difficulty, shopName: 'Fuzz' });
  const rnd = mulberry(seed * 31 + 7);
  for (let i = 0; i < maxSteps && s.phase !== 'ended' && s.day <= days; i++) {
    const opts = legal(s);
    if (!opts.length) break;
    const a = completeAction(s, opts[Math.floor(rnd() * opts.length)], rnd);
    if (!a) continue;
    const r = engine.step(s, a);
    cb?.(s, a, r);
    if (!r.error) s = r.state;
  }
  return s;
}

describe('AC engine extras', { skip }, () => {
  test('AC-ENG-107 different seeds give different day-1 queues or markets (≥95% of 100 pairs)', () => {
    let diff = 0;
    for (let i = 0; i < 100; i++) {
      const a = act(fresh({ seed: 2 * i + 1 }), { type: 'OPEN_SHOP' }).state;
      const b = act(fresh({ seed: 2 * i + 2 }), { type: 'OPEN_SHOP' }).state;
      const sig = (s) => JSON.stringify([s.queue.map((c) => [c.kind, c.name, c.hidden?.reservation]), s.market.listings]);
      if (sig(a) !== sig(b)) diff++;
    }
    assert.ok(diff >= 95, `${diff}/100 differ`);
  });

  test('AC-ENG-109 numeric edge params error with events [] and unchanged state', () => {
    const night = skipDay(fresh());
    const open = act(fresh(), { type: 'OPEN_SHOP' }).state;
    const cases = [
      [open, { type: 'OFFER', price: 1.5 }], [open, { type: 'OFFER', price: '100' }], [open, { type: 'OFFER', price: 1e12 }],
      [night, { type: 'BUY_STOCK', listingIndex: 0, qty: 0 }], [night, { type: 'BUY_STOCK', listingIndex: 0, qty: -1 }],
      [night, { type: 'BUY_STOCK', listingIndex: 0, qty: 1e6 }], [night, { type: 'BUY_STOCK', listingIndex: -1, qty: 1 }],
      [night, { type: 'BUY_STOCK', listingIndex: '0', qty: 1 }], [night, { type: 'BUY_STOCK' }],
    ];
    for (const [s, a] of cases) {
      const before = JSON.stringify(s);
      let r;
      assert.doesNotThrow(() => { r = engine.step(s, a); });
      assert.ok(r.error, `expected error for ${JSON.stringify(a)}`);
      assert.deepEqual(r.events, [], `events must be [] on error (${JSON.stringify(a)})`);
      assert.equal(JSON.stringify(r.state), before);
    }
  });

  test('AC-ENG-110 step on null / {} / truncated state does not throw', () => {
    const trunc = clone(fresh()); delete trunc.inventory; delete trunc.lease;
    for (const bad of [null, undefined, {}, trunc]) {
      let r;
      assert.doesNotThrow(() => { r = engine.step(bad, { type: 'OPEN_SHOP' }); }, `threw on ${JSON.stringify(bad)?.slice(0, 40)}`);
      assert.ok(r && r.error, 'error expected');
    }
  });

  test('AC-ENG-104 newGame tolerates unknown background/difficulty and missing shopName', () => {
    for (const o of [{ background: 'astronaut', difficulty: 'acid' }, { background: 'tinker', difficulty: 'hurricane' }, { background: 'tinker', difficulty: 'acid' }, {}]) {
      let s;
      assert.doesNotThrow(() => { s = engine.newGame({ seed: 1, ...o }); }, JSON.stringify(o));
      assert.ok(s && s.phase === 'dawn', 'valid state');
      assert.ok(typeof s.shopName === 'string' && s.shopName.length > 0, 'default shopName');
    }
    const long = engine.newGame({ seed: 1, background: 'tinker', difficulty: 'acid', shopName: `   ${'x'.repeat(300)}   ` });
    assert.ok(long.shopName.length < 300 && !long.shopName.startsWith(' '), 'shopName trimmed and capped');
  });

  test('AC-ENG-114 AC-ENG-115 AC-ENG-121 state JSON-safe, rng uint32, invariants (10 seeds × 10 days)', () => {
    const problems = [];
    for (let seed = 1; seed <= 10; seed++) {
      let lastDay = 1;
      fuzz({ seed, background: backgroundIds()[seed % 6], difficulty: DIFFICULTIES[seed % 3], days: 10 }, (p, a, r) => {
        if (r.error) return;
        const st = r.state;
        const w = `seed${seed} ${a.type} d${st.day}`;
        if (JSON.stringify(JSON.parse(JSON.stringify(st))) !== JSON.stringify(st)) problems.push(`${w}: not JSON-stable`);
        try { assert.deepEqual(JSON.parse(JSON.stringify(st)), st); } catch { problems.push(`${w}: not JSON-safe (undefined/NaN/Infinity/Map…)`); }
        if (!Number.isInteger(st.rng) || st.rng < 0 || st.rng > 0xffffffff) problems.push(`${w}: rng ${st.rng}`);
        if (st.day < lastDay) problems.push(`${w}: day went backwards`);
        lastDay = st.day;
        if (st.perkPoints < 0) problems.push(`${w}: perkPoints ${st.perkPoints}`);
        if (st.customer && (st.customer.patience < 0 || st.customer.patience > st.customer.patienceMax)) problems.push(`${w}: patience`);
        for (const i of st.inventory) if (!['shelf', 'storage', 'stash'].includes(i.location)) problems.push(`${w}: location ${i.location}`);
      });
    }
    assert.deepEqual([...new Set(problems)].slice(0, 10), []);
  });

  test('AC-ENG-115 a 10-day fuzz completes with Math.random/Date.now stubbed to throw', () => {
    const R = Math.random, N = Date.now;
    Math.random = () => { throw new Error('Math.random used'); };
    Date.now = () => { throw new Error('Date.now used'); };
    try {
      assert.doesNotThrow(() => fuzz({ seed: 3, days: 10 }));
      assert.doesNotThrow(() => engine.newGame({ seed: 5, background: 'fence', difficulty: 'downpour', shopName: 'R' }));
    } finally { Math.random = R; Date.now = N; }
  });

  test('AC-ENG-117 deserialize: {} and a save missing inventory ⇒ null', () => {
    const o = JSON.parse(engine.serialize(fresh()));
    const strip = (x) => { if (x && typeof x === 'object') { if ('inventory' in x) delete x.inventory; else for (const v of Object.values(x)) strip(v); } return x; };
    assert.equal(engine.deserialize(JSON.stringify(strip(o))), null);
    assert.equal(engine.deserialize('{}'), null);
  });

  test('AC-ENG-118 phase machine: only dawn→open→night→dawn|ended transitions (20 seeds × 15 days)', () => {
    const allowed = new Set(['dawn>open', 'open>night', 'night>dawn', 'night>ended', 'dawn>ended', 'ended>dawn', 'open>ended']);
    const bad = new Set();
    for (let seed = 1; seed <= 20; seed++) {
      fuzz({ seed, background: backgroundIds()[seed % 6], days: 15 }, (p, a, r) => {
        if (r.error || p.phase === r.state.phase) return;
        const t = `${p.phase}>${r.state.phase}`;
        if (!allowed.has(t)) bad.add(`${t} via ${a.type}`);
        if (t === 'night>dawn' && r.state.day !== p.day + 1) bad.add(`day ${p.day}→${r.state.day} on SLEEP`);
        if (t === 'dawn>ended' && a.type !== 'BUY_DEED' && a.type !== 'AUDIT_RESPOND') bad.add(`dawn>ended via ${a.type}`);
        if (t === 'ended>dawn' && a.type !== 'CONTINUE_ENDLESS') bad.add(`ended>dawn via ${a.type}`);
        if (t === 'open>ended') bad.add(`open>ended via ${a.type}`);
      });
    }
    assert.deepEqual([...bad], []);
  });

  test('AC-ENG-119 AC-ENG-120 every emitted event type is documented in EVENTS.md; event text valid', () => {
    const p = `${ROOT}/src/engine/EVENTS.md`;
    assert.ok(existsSync(p), 'src/engine/EVENTS.md missing');
    const doc = read(p);
    const seen = new Set();
    const badText = [];
    for (let seed = 1; seed <= 15; seed++) {
      fuzz({ seed, background: backgroundIds()[seed % 6], difficulty: DIFFICULTIES[seed % 3], days: 20 }, (_p, _a, r) => {
        for (const e of r.events) {
          seen.add(e.type);
          if ('text' in e && (typeof e.text !== 'string' || !e.text || e.text.length > 140 || /\{[a-zA-Z_]+\}/.test(e.text))) badText.push(`${e.type}: ${JSON.stringify(e.text)}`);
        }
      });
    }
    const undocumented = [...seen].filter((t) => !new RegExp(`\\b${t}\\b`).test(doc));
    assert.deepEqual(undocumented, [], 'undocumented event types');
    assert.deepEqual([...new Set(badText)].slice(0, 10), []);
    assert.ok(existsSync(`${ROOT}/src/engine/STATE.md`), 'src/engine/STATE.md missing');
  });

  test('AC-ENG-134 SLEEP emits exactly one DAY_SUMMARY reconciling with creds change', () => {
    for (let seed = 1; seed <= 8; seed++) {
      let s = stockShelf(fresh({ seed, background: 'line_cook' }));
      const dawnCreds = s.creds;
      s = skipDay(s);
      const r = act(s, { type: 'SLEEP' });
      const sums = r.events.filter((e) => e.type === 'DAY_SUMMARY');
      assert.equal(sums.length, 1, `seed ${seed}: DAY_SUMMARY count ${sums.length}`);
      const d = sums[0];
      assert.equal(d.day, s.day);
      assert.ok(Array.isArray(d.lines));
      assert.equal(d.income - d.expenses, r.state.creds - dawnCreds, `seed ${seed}: summary net ${d.income - d.expenses} vs creds Δ ${r.state.creds - dawnCreds}`);
    }
  });

  test('AC-ENG-136 dawn feed has lease entry, entries carry day, feed is bounded', () => {
    let s = fresh({ background: 'sparky' });
    s.creds = 100000;
    for (let d = 0; d < 40 && s.phase !== 'ended'; d++) s = nextDay(s);
    assert.ok(s.feed.some((f) => f.day === s.day && f.kind === 'lease'), 'lease entry today');
    for (const f of s.feed) {
      assert.ok(Number.isInteger(f.day), 'feed day');
      assert.ok(['news', 'msg', 'lease', 'hotlist', 'warning', 'system'].includes(f.kind), `feed kind ${f.kind}`);
      assert.equal(typeof f.text, 'string');
    }
    assert.ok(s.feed.length < 400, `feed unbounded: ${s.feed.length}`);
    if (s.hotList.length) assert.ok(s.feed.some((f) => f.day === s.day && f.kind === 'hotlist'));
  });

  test('AC-ENG-149 reservation never violated over many random haggles', () => {
    const bad = [];
    let deals = 0;
    for (let seed = 1; seed <= 60; seed++) {
      let s = act(stockShelf(fresh({ seed })), { type: 'OPEN_SHOP' }).state;
      const rnd = mulberry(seed);
      for (let g = 0; g < 200 && s.phase === 'open'; g++) {
        if (!s.customer) { if (!s.queue.length) break; s = act(s, { type: 'NEXT_CUSTOMER' }).state; continue; }
        const c = s.customer;
        if (c.kind === 'buyer' && !c.selectedUid) {
          const u = selectableUids(s);
          if (!u.length) { s = act(s, { type: 'REFUSE' }).state; continue; }
          s = act(s, { type: 'SELECT_ITEM', uid: u[0] }).state;
          continue;
        }
        if (c.kind !== 'buyer' && c.kind !== 'seller') { s = engine.step(s, { type: 'REFUSE' }).state; continue; }
        if (hasLegal(s, 'ACCEPT_CHIT')) { s = act(s, { type: 'REJECT_CHIT' }).state; continue; }
        const res = c.hidden.reservation;
        const price = Math.max(5, Math.round(res * (0.5 + rnd()))); // 0.5×–1.5× reservation
        s.creds = 100000;
        const r = act(s, { type: 'OFFER', price });
        if (r.events.some((e) => e.type === 'HAGGLE_ACCEPT')) {
          deals++;
          if (c.kind === 'buyer' && price > res) bad.push(`buyer accepted ${price} > ${res}`);
          if (c.kind === 'seller' && price < res) bad.push(`seller accepted ${price} < ${res}`);
          const d = engine.step(r.state, { type: 'DEAL' });
          s = d.error ? act(r.state, { type: 'REFUSE' }).state : d.state;
          if (hasLegal(s, 'REJECT_CHIT')) s = act(s, { type: 'REJECT_CHIT' }).state;
          continue;
        }
        for (const e of r.events.filter((x) => x.type === 'HAGGLE_COUNTER')) {
          if (c.kind === 'buyer' && e.price > res) bad.push(`buyer countered ${e.price} > ${res}`);
          if (c.kind === 'seller' && e.price < res) bad.push(`seller countered ${e.price} < ${res}`);
        }
        s = r.state;
      }
    }
    assert.ok(deals > 50, `only ${deals} deals`);
    assert.deepEqual(bad.slice(0, 10), []);
  });

  test('AC-ENG-154 REPORT an honest customer ⇒ −Sump, customer leaves; REPORT a ghost-chit holder ⇒ bounty', () => {
    const honest = findCustomer((c) => (c.kind === 'buyer' || c.kind === 'seller') && !c.hidden?.ghostChit && !c.hidden?.undercover && !c.item?.flags?.stolen && !c.item?.flags?.counterfeit);
    assert.ok(honest);
    const r = act(honest, { type: 'REPORT' });
    assert.equal(r.state.customer, null);
    assert.ok(r.state.rep.sump < honest.rep.sump, 'wrong report costs Sump rep');
    assert.ok(r.state.creds <= honest.creds, 'no bounty for a false report');
    const ghost = findCustomer((c, s) => isBuyer(c) && c.hidden?.ghostChit, { seeds: 400 });
    if (ghost) {
      const g = act(ghost, { type: 'REPORT' });
      assert.ok(g.state.creds > ghost.creds, 'bounty for reporting a ghost-chit holder');
      assert.ok(g.state.rep.vantage >= ghost.rep.vantage);
    }
  });

  test('AC-ENG-171 isIllegal: stolen flag and unpermitted permit items are illegal; permit makes it legal', () => {
    const s = fresh();
    const legalDef = items().find((i) => i.legality === 'legal');
    assert.equal(engine.selectors.isIllegal(s, makeInv(legalDef.id, 'shelf', { flags: { stolen: true } })), true, 'stolen ⇒ illegal');
    const pd = items().find((i) => i.legality === 'permit');
    if (pd) {
      assert.equal(engine.selectors.isIllegal(s, makeInv(pd.id)), true, 'permit item without permit');
      const s2 = clone(s); s2.permits = [pd.permit];
      assert.equal(engine.selectors.isIllegal(s2, makeInv(pd.id)), false, 'permit item with permit');
    }
  });

  test('AC-ENG-173 heat 59 after sleep ⇒ no audit; warning feed entry when pending', () => {
    let s = skipDay(fresh({ background: 'sparky' }));
    if (hasLegal(s, 'PAY_DUES')) s = act(s, { type: 'PAY_DUES' }).state;
    s.inventory = s.inventory.filter((i) => !engine.selectors.isIllegal(s, i));
    s.heat = 64; // decays to 59
    const r = act(s, { type: 'SLEEP' });
    assert.equal(r.state.heat, 59);
    assert.ok(!r.state.auditPending && !r.state.audit, 'heat 59 must not trigger an audit');
    s.heat = 80;
    const r2 = act(s, { type: 'SLEEP' });
    assert.ok(r2.state.feed.some((f) => f.day === r2.state.day && f.kind === 'warning'), 'audit warning in dawn feed');
  });

  test('AC-ENG-179 audit resolution emits AUDIT event', () => {
    let s = skipDay(fresh({ background: 'fence' }));
    if (hasLegal(s, 'PAY_DUES')) s = act(s, { type: 'PAY_DUES' }).state;
    s.heat = 80; s.auditPending = true;
    s = act(s, { type: 'SLEEP' }).state;
    assert.ok(s.audit);
    const r = act(s, { type: 'AUDIT_RESPOND', choice: 'comply' });
    assert.ok(evTypes(r.events).includes('AUDIT'), `events ${evTypes(r.events)}`);
  });

  test('AC-ENG-195 PAY_LEASE with no overdue pre-pays: no charge on due day', () => {
    let s = fresh(); s.creds = 5000; s.lease.nextDueDay = 2;
    s = act(s, { type: 'PAY_LEASE' }).state;
    assert.equal(s.creds, 5000 - 350);
    s = skipDay(s);
    if (hasLegal(s, 'PAY_DUES')) s = act(s, { type: 'PAY_DUES' }).state;
    s = act(s, { type: 'SLEEP' }).state; // day 1 -> 2
    s = skipDay(s);
    const before = s.creds;
    const r = act(s, { type: 'SLEEP' }); // due day 2
    assert.ok(!evTypes(r.events).includes('LEASE_MISSED'));
    assert.ok(before - r.state.creds < 350, 'pre-paid lease not charged again');
  });

  test('AC-ENG-211 market refreshes daily and differs across days', () => {
    let s = skipDay(fresh());
    const l1 = JSON.stringify(engine.selectors.marketListings(s));
    assert.equal(s.market.day, s.day);
    s = skipDay(nextDay(s));
    assert.equal(s.market.day, s.day);
    const l2 = JSON.stringify(engine.selectors.marketListings(s));
    assert.notEqual(l1, l2);
  });

  test('AC-ENG-220 general goods (salvage/sundry/tech) are legal and appear in the market', () => {
    const gen = items().filter((i) => ['salvage', 'sundry', 'tech'].includes(i.category));
    assert.ok(gen.length && gen.every((i) => i.legality === 'legal'), 'general goods legal');
    let seen = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = skipDay(fresh({ seed }));
      if (s.market.listings.some((l) => gen.some((g) => g.id === l.itemId))) seen++;
    }
    assert.ok(seen >= 9, `general goods in market on ${seen}/10 nights`);
  });

  test('AC-ENG-221 upgrades raise capacity to caps; owned machine cannot be bought twice', () => {
    let s = skipDay(fresh({ background: 'tinker' }));
    s.creds = 10_000_000;
    for (let k = 0; k < 40; k++) {
      const u = legal(s).find((a) => a.type === 'BUY_UPGRADE');
      if (!u) break;
      s = act(s, completeAction(s, u)).state;
    }
    assert.ok(s.capacity.shelf <= 12 && s.capacity.storage <= 30 && s.capacity.stash <= 6, JSON.stringify(s.capacity));
    assert.ok(s.capacity.shelf > 6 || s.capacity.storage > 10 || s.capacity.stash > 0, 'some upgrade raised capacity');
    const owned = Object.keys(s.machines).find((m) => s.machines[m].owned);
    if (owned) actFails(s, { type: 'BUY_MACHINE', id: owned });
    for (const m of engine.selectors.availableMachines(s)) assert.ok(!s.machines[m.id ?? m]?.owned, 'available machines exclude owned');
  });

  test('AC-ENG-135 stats: totalEarned − totalSpent reconciles with creds − startCreds', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s0 = engine.newGame({ seed, background: 'sparky', difficulty: 'acid', shopName: 'S' });
      const s = fuzz({ seed, days: 10 });
      assert.ok(Number.isInteger(s.stats.totalEarned) && Number.isInteger(s.stats.totalSpent));
      assert.equal(s.stats.totalEarned - s.stats.totalSpent, s.creds - s0.creds, `seed ${seed}`);
    }
  });

  test('AC-PERF-101 AC-PERF-102 step median < 5ms, p99 < 20ms; save < 200KB after 60 days', () => {
    const times = [];
    let s = engine.newGame({ seed: 77, background: 'sparky', difficulty: 'drizzle', shopName: 'Perf' });
    const rnd = mulberry(77);
    for (let i = 0; i < 20000 && s.phase !== 'ended' && s.day <= 60; i++) {
      const opts = legal(s);
      const prog = opts.filter((o) => ['NEXT_CUSTOMER', 'OPEN_SHOP', 'CLOSE_SHOP', 'SLEEP', 'REFUSE', 'PAY_DUES', 'AUDIT_RESPOND', 'PAY_LEASE'].includes(o.type));
      const pool = prog.length && rnd() < 0.7 ? prog : opts;
      const a = completeAction(s, pool[Math.floor(rnd() * pool.length)], rnd);
      if (!a) continue;
      if (a.type === 'SLEEP') s.creds = Math.max(s.creds, 50000);
      const t0 = performance.now();
      const r = engine.step(s, a);
      times.push(performance.now() - t0);
      if (!r.error) s = r.state;
    }
    times.sort((x, y) => x - y);
    const med = times[Math.floor(times.length / 2)], p99 = times[Math.floor(times.length * 0.99)];
    assert.ok(times.length > 1000, `only ${times.length} steps`);
    assert.ok(med < 5, `median ${med.toFixed(2)}ms`);
    assert.ok(p99 < 20, `p99 ${p99.toFixed(2)}ms`);
    const size = engine.serialize(s).length;
    assert.ok(size < 200 * 1024, `save size ${size} at day ${s.day}`);
  });
});
