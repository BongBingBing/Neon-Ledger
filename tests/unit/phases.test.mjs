// Phase transitions, capacity, market (DESIGN §3, §8; ARCH §3.3, R7).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { engine, SKIP_ENGINE, fresh, act, actFails, hasLegal, types, skipDay, nextDay, makeInv, items, clone, randomWalk } from './_helpers.mjs';

const skip = SKIP_ENGINE;

describe('phase transitions', { skip }, () => {
  test('AC-ENG-118 AC-ENG-155 AC-ENG-211 dawn → open → night → dawn(day 2)', () => {
    let s = fresh();
    assert.equal(s.phase, 'dawn');
    assert.ok(hasLegal(s, 'OPEN_SHOP'));
    s = act(s, { type: 'OPEN_SHOP' }).state;
    assert.equal(s.phase, 'open');
    assert.ok(s.queue.length + (s.customer ? 1 : 0) >= 6, 'at least 6 customers');
    assert.ok(hasLegal(s, 'CLOSE_SHOP'));
    if (!s.customer) {
      s = act(s, { type: 'NEXT_CUSTOMER' }).state;
      assert.ok(s.customer, 'NEXT_CUSTOMER sets customer');
    }
    const r = act(s, { type: 'CLOSE_SHOP' });
    s = r.state;
    assert.equal(s.phase, 'night');
    assert.equal(s.customer, null, 'remaining customer leaves on close');
    assert.equal(s.queue.length, 0, 'remaining queue leaves on close');
    for (const t of ['SLEEP', 'BUY_STOCK']) assert.ok(types(s).includes(t), `${t} listed at night`);
    const n = act(s, { type: 'SLEEP' });
    s = n.state;
    assert.equal(s.phase, 'dawn');
    assert.equal(s.day, 2);
    assert.equal(s.duesPaidTonight, false);
    assert.equal(s.nightJobDone, false);
    assert.equal(s.market.day, 2, 'market refreshed for the new day');
  });

  test('AC-ENG-142 NEXT_CUSTOMER not allowed while a customer is at the counter, or with empty queue', () => {
    let s = act(fresh(), { type: 'OPEN_SHOP' }).state;
    if (!s.customer) s = act(s, { type: 'NEXT_CUSTOMER' }).state;
    actFails(s, { type: 'NEXT_CUSTOMER' });
    s = skipDay(fresh());
    actFails(s, { type: 'NEXT_CUSTOMER' });
  });

  test('AC-ENG-155 can close early with customers waiting', () => {
    const s = act(fresh(), { type: 'OPEN_SHOP' }).state;
    assert.ok(s.queue.length > 0);
    assert.equal(act(s, { type: 'CLOSE_SHOP' }).state.phase, 'night');
  });

  test('AC-ENG-134 dayLog resets each dawn and lines are integers', () => {
    let s = nextDay(fresh());
    assert.ok(Array.isArray(s.dayLog.lines));
    for (const l of s.dayLog.lines) assert.ok(Number.isInteger(l.amount));
    s = act(s, { type: 'OPEN_SHOP' }).state;
    s = nextDay(s);
    assert.ok(Number.isInteger(s.dayLog.income) && Number.isInteger(s.dayLog.expenses));
  });

  test('14-day survival with no actions other than refuse/sleep/pay-dues does not throw', () => {
    let s = fresh({ background: 'sparky' });
    for (let d = 0; d < 14 && s.phase !== 'ended'; d++) s = nextDay(s);
    assert.ok(s.day >= 7);
  });

  test('AC-ENG-412 perk point awarded at end of each week survived', () => {
    let s = fresh();
    s.creds = 100000; // ensure lease is paid
    for (let d = 0; d < 7 && s.phase !== 'ended'; d++) s = nextDay(s);
    assert.equal(s.day, 8);
    assert.ok(s.perkPoints + s.perks.length >= 1, 'one perk point after first week');
  });
});

describe('capacity limits', { skip }, () => {
  function fullShelf() {
    const s = fresh();
    const def = items().find((i) => i.legality === 'legal' && !i.perishableDays) ?? items()[0];
    s.inventory = s.inventory.filter((i) => i.location !== 'shelf');
    for (let k = 0; k < s.capacity.shelf; k++) s.inventory.push(makeInv(def.id, 'shelf'));
    s.inventory.push(makeInv(def.id, 'storage'));
    return s;
  }

  test('AC-ENG-131 MOVE_ITEM to a full shelf fails', () => {
    const s = fullShelf();
    const st = s.inventory.find((i) => i.location === 'storage');
    actFails(s, { type: 'MOVE_ITEM', uid: st.uid, to: 'shelf' });
  });

  test('AC-ENG-131 MOVE_ITEM to stash fails with 0 stash capacity; works with capacity', () => {
    const s = fullShelf();
    assert.equal(s.capacity.stash, 0);
    const st = s.inventory.find((i) => i.location === 'storage');
    actFails(s, { type: 'MOVE_ITEM', uid: st.uid, to: 'stash' });
    s.capacity.stash = 2;
    const r = act(s, { type: 'MOVE_ITEM', uid: st.uid, to: 'stash' });
    assert.equal(r.state.inventory.find((i) => i.uid === st.uid).location, 'stash');
  });

  test('MOVE_ITEM shelf→storage works then storage→shelf works', () => {
    const s = fullShelf();
    const sh = s.inventory.find((i) => i.location === 'shelf');
    const a = act(s, { type: 'MOVE_ITEM', uid: sh.uid, to: 'storage' }).state;
    assert.equal(a.inventory.find((i) => i.uid === sh.uid).location, 'storage');
    const b = act(a, { type: 'MOVE_ITEM', uid: sh.uid, to: 'shelf' }).state;
    assert.equal(b.inventory.find((i) => i.uid === sh.uid).location, 'shelf');
  });

  test('AC-ENG-131 MOVE_ITEM not allowed while shop is open', () => {
    let s = fullShelf();
    const sh = s.inventory.find((i) => i.location === 'shelf');
    s = act(s, { type: 'OPEN_SHOP' }).state;
    actFails(s, { type: 'MOVE_ITEM', uid: sh.uid, to: 'storage' });
  });

  test('AC-ENG-131 MOVE_ITEM to the location it is already in is not an infinite-capacity loophole', () => {
    const s = fullShelf();
    const sh = s.inventory.find((i) => i.location === 'shelf');
    const r = engine.step(s, { type: 'MOVE_ITEM', uid: sh.uid, to: 'shelf' });
    const n = (r.error ? s : r.state).inventory.filter((i) => i.location === 'shelf').length;
    assert.ok(n <= s.capacity.shelf);
  });

  test('AC-ENG-212 BUY_STOCK: storage first, then shelf, then error no_space (R7)', () => {
    let s = skipDay(fresh());
    s.creds = 1_000_000;
    s.inventory = [];
    const idx = s.market.listings.findIndex((l) => l.qty >= 1);
    assert.ok(idx >= 0, 'market has listings');
    const total = s.capacity.storage + s.capacity.shelf;
    let bought = 0;
    s.market.listings[idx].qty = total + 5;
    const firstR = act(s, { type: 'BUY_STOCK', listingIndex: idx, qty: 1 });
    assert.ok(firstR.events.some((e) => e.type === 'PURCHASE'), 'PURCHASE event');
    s = firstR.state; bought++;
    assert.equal(s.inventory[0].location, 'storage');
    while (bought < total) { s = act(s, { type: 'BUY_STOCK', listingIndex: idx, qty: 1 }).state; bought++; }
    assert.equal(s.inventory.filter((i) => i.location === 'storage').length, s.capacity.storage);
    assert.equal(s.inventory.filter((i) => i.location === 'shelf').length, s.capacity.shelf);
    const r = actFails(s, { type: 'BUY_STOCK', listingIndex: idx, qty: 1 });
    assert.match(r.error, /no_space/);
  });

  test('AC-ENG-212 BUY_STOCK charges price × qty and decrements listing qty; fails without creds', () => {
    let s = skipDay(fresh());
    s.creds = 100000;
    const idx = s.market.listings.findIndex((l) => l.qty >= 2);
    if (idx < 0) return;
    const l = s.market.listings[idx];
    const r = act(s, { type: 'BUY_STOCK', listingIndex: idx, qty: 2 });
    assert.equal(r.state.creds, s.creds - l.price * 2);
    assert.equal(r.state.market.listings[idx].qty, l.qty - 2);
    const added = r.state.inventory.filter((i) => !s.inventory.some((j) => j.uid === i.uid));
    assert.equal(added.length, 2);
    for (const a of added) { assert.equal(a.itemId, l.itemId); assert.equal(a.boughtFor, l.price); }
    const poor = clone(s); poor.creds = l.price - 1;
    actFails(poor, { type: 'BUY_STOCK', listingIndex: idx, qty: 1 });
    actFails(s, { type: 'BUY_STOCK', listingIndex: idx, qty: l.qty + 1 });
  });

  test('AC-ENG-213 SELL_TO_MARKET gives creds and removes item', () => {
    let s = skipDay(fresh());
    const def = items().find((i) => i.legality === 'legal') ?? items()[0];
    const it = makeInv(def.id, 'storage');
    s.inventory.push(it);
    const r = act(s, { type: 'SELL_TO_MARKET', uid: it.uid });
    assert.ok(r.state.creds > s.creds);
    assert.ok(r.state.creds - s.creds <= def.basePrice, 'dumping to supplier is a low price');
    assert.ok(!r.state.inventory.some((i) => i.uid === it.uid));
  });
});

describe('state invariants hold through random play', { skip }, () => {
  for (const [bg, diff] of [['tinker', 'acid'], ['fence', 'downpour'], ['nobody', 'drizzle'], ['shard_diver', 'acid'], ['line_cook', 'downpour'], ['sparky', 'drizzle']]) {
    test(`AC-ENG-121 ${bg}/${diff}`, () => {
      const problems = [];
      let s = engine.newGame({ seed: 4242, background: bg, difficulty: diff, shopName: 'Inv' });
      randomWalk(s, 1500, 9, (_p, a, r) => {
        if (r.error) return;
        const st = r.state;
        const where = `${a.type} d${st.day}`;
        if (!['dawn', 'open', 'night', 'ended'].includes(st.phase)) problems.push(`${where}: bad phase ${st.phase}`);
        for (const loc of ['shelf', 'storage', 'stash']) {
          const n = st.inventory.filter((i) => i.location === loc).length;
          if (n > st.capacity[loc]) problems.push(`${where}: ${loc} ${n}/${st.capacity[loc]}`);
        }
        const uids = st.inventory.map((i) => i.uid);
        if (new Set(uids).size !== uids.length) problems.push(`${where}: duplicate uid`);
        if (st.heat < 0 || st.heat > 100) problems.push(`${where}: heat ${st.heat}`);
        if (st.appeal < 0 || st.appeal > 100) problems.push(`${where}: appeal ${st.appeal}`);
        for (const [f, v] of Object.entries(st.rep)) if (v < -100 || v > 100) problems.push(`${where}: rep ${f} ${v}`);
        if (st.phase !== 'open' && st.customer) problems.push(`${where}: customer outside open`);
        if (!Number.isInteger(st.creds)) problems.push(`${where}: creds ${st.creds}`);
        if (st.phase === 'ended' && !st.ending) problems.push(`${where}: ended without ending`);
        for (const i of st.inventory) {
          if (i.condition < 0 || i.condition > 100) problems.push(`${where}: condition ${i.condition}`);
          if (!items().some((d) => d.id === i.itemId) && items().length) problems.push(`${where}: unknown itemId ${i.itemId}`);
        }
      });
      assert.deepEqual([...new Set(problems)].slice(0, 10), []);
    });
  }
});
