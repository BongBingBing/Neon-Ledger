// Haggling & counter (DESIGN §6.3, §6.4).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { engine, SKIP_ENGINE, act, evTypes, legal, stockShelf, findCustomer, selectableUids, isBuyer, isSeller, hasLegal, clone } from './_helpers.mjs';

const skip = SKIP_ENGINE;

const servableBuyer = (c, s) => isBuyer(c) && !c.hidden?.ghostChit && !c.hidden?.undercover && selectableUids(s).length > 0;
function buyerAtCounter(opts = {}) {
  const s = findCustomer(servableBuyer, { prep: (x) => stockShelf(x), ...opts });
  assert.ok(s, 'could not find a servable buyer in 120 seeds (is the shelf stocking/customer gen working?)');
  return act(s, { type: 'SELECT_ITEM', uid: selectableUids(s)[0] }).state;
}
function sellerAtCounter(opts = {}) {
  const s = findCustomer((c) => isSeller(c) && c.item, opts);
  assert.ok(s, 'could not find a seller in 120 seeds');
  return s;
}

describe('customers', { skip }, () => {
  test('AC-ENG-142 AC-ENG-143 customer shape on NEXT_CUSTOMER', () => {
    const s = buyerAtCounter();
    const c = s.customer;
    for (const k of ['id', 'kind', 'name', 'faction', 'homeWard', 'portrait', 'dialogue', 'patience', 'patienceMax', 'mood', 'hidden']) {
      assert.ok(k in c, `customer missing ${k}`);
    }
    assert.ok(['vantage', 'lantern', 'static', 'sump', 'spire', 'none'].includes(c.faction));
    assert.ok(['happy', 'neutral', 'annoyed', 'angry'].includes(c.mood));
    assert.ok(Number.isInteger(c.hidden.reservation) && c.hidden.reservation > 0);
    assert.equal(c.patience, c.patienceMax);
    assert.equal(engine.selectors.currentCustomer(s)?.id, c.id);
  });

  test('AC-ENG-143 AC-ENG-416 patience range 3–5 on Normal; ±1 on Drizzle/Downpour', () => {
    const range = (difficulty) => {
      const seen = new Set();
      for (let seed = 1; seed <= 40; seed++) {
        const s = act(engine.newGame({ seed, background: 'sparky', difficulty, shopName: 'P' }), { type: 'OPEN_SHOP' }).state;
        for (const c of s.queue) if (c.kind !== 'special') seen.add(c.patienceMax);
      }
      return [Math.min(...seen), Math.max(...seen)];
    };
    const [lo, hi] = range('acid');
    assert.ok(lo >= 3 && hi <= 5, `acid patience ${lo}-${hi}`);
    const [dlo, dhi] = range('drizzle');
    assert.ok(dlo >= 4 && dhi <= 6, `drizzle patience ${dlo}-${dhi}`);
    const [plo, phi] = range('downpour');
    assert.ok(plo >= 2 && phi <= 4, `downpour patience ${plo}-${phi}`);
  });

  test('AC-ENG-141 customers/day = 6 + floor(appeal/10), cap 14', () => {
    for (const appeal of [0, 10, 35, 79, 100]) {
      const s0 = engine.newGame({ seed: 3, background: 'sparky', difficulty: 'acid', shopName: 'A' });
      s0.appeal = appeal;
      const s = act(s0, { type: 'OPEN_SHOP' }).state;
      const expected = Math.min(14, 6 + Math.floor(appeal / 10));
      const count = s.queue.length + (s.customer ? 1 : 0);
      // Events/injury may shift this; on a clean day-1 state the formula should hold exactly.
      assert.equal(count, expected, `appeal ${appeal}: queue ${count} vs ${expected}`);
      assert.equal(engine.selectors.customerCountToday(s), expected);
    }
  });
});

describe('haggling with buyers', { skip }, () => {
  test('AC-ENG-145 AC-ENG-151 offer at or below reservation is accepted, DEAL sells at that price', () => {
    const s = buyerAtCounter();
    const res = s.customer.hidden.reservation;
    const uid = s.customer.selectedUid;
    assert.ok(uid, 'SELECT_ITEM should set customer.selectedUid');
    const price = Math.max(5, Math.floor((res * 0.9) / 5) * 5);
    const r = act(s, { type: 'OFFER', price });
    assert.ok(evTypes(r.events).includes('HAGGLE_ACCEPT'), `expected HAGGLE_ACCEPT, got ${evTypes(r.events)}`);
    let d = act(r.state, { type: 'DEAL' });
    if (!d.events.some((e) => e.type === 'SALE') && hasLegal(d.state, 'ACCEPT_CHIT')) {
      const ev = d.events;
      d = act(d.state, { type: 'ACCEPT_CHIT' });
      d.events = [...ev, ...d.events];
    }
    const sale = d.events.find((e) => e.type === 'SALE');
    assert.ok(sale, `expected SALE, got ${evTypes(d.events)}`);
    assert.equal(sale.price, price);
    assert.equal(sale.uid, uid);
    assert.ok(!d.state.inventory.some((i) => i.uid === uid), 'sold item removed');
    assert.equal(d.state.creds, s.creds + price);
    assert.equal(d.state.customer, null);
    assert.equal(d.state.stats.customersServed, s.stats.customersServed + 1);
  });

  test('AC-ENG-146 offer above reservation ⇒ counter, patience −1, counters move toward player', () => {
    const s0 = buyerAtCounter();
    const res = s0.customer.hidden.reservation;
    const ask = Math.round(res * 1.2); // within 35% ⇒ costs 1 patience
    let s = s0, prevCounter = -Infinity;
    for (let i = 0; i < s0.customer.patienceMax - 1; i++) {
      const r = act(s, { type: 'OFFER', price: ask });
      const c = r.events.find((e) => e.type === 'HAGGLE_COUNTER');
      if (!c) { assert.ok(evTypes(r.events).includes('HAGGLE_ACCEPT'), `got ${evTypes(r.events)}`); return; }
      assert.equal(r.state.customer.patience, s.customer.patience - 1, 'counter costs 1 patience');
      assert.ok(c.price < ask, 'buyer counter is below the player ask');
      assert.ok(c.price >= prevCounter, `counter must move toward player (${prevCounter} -> ${c.price})`);
      assert.ok(['happy', 'neutral', 'annoyed', 'angry'].includes(c.mood));
      prevCounter = c.price;
      s = r.state;
    }
  });

  test('AC-ENG-147 outrageous offer (>35% over limit) costs 2 patience', () => {
    const s = buyerAtCounter();
    const res = s.customer.hidden.reservation;
    const r = act(s, { type: 'OFFER', price: Math.round(res * 2) + 5 });
    if (r.state.customer) assert.equal(r.state.customer.patience, s.customer.patience - 2);
    else assert.ok(s.customer.patience <= 2 && evTypes(r.events).includes('HAGGLE_WALK'));
  });

  test('AC-ENG-148 patience 0 ⇒ walk-out, customer gone, faction rep does not rise', () => {
    let s = buyerAtCounter();
    const faction = s.customer.faction;
    const res = s.customer.hidden.reservation;
    const repBefore = s.rep[faction];
    let walked = false;
    for (let i = 0; i < 10 && s.customer; i++) {
      const r = act(s, { type: 'OFFER', price: res * 3 + 50 });
      if (evTypes(r.events).includes('HAGGLE_WALK')) { walked = true; s = r.state; break; }
      s = r.state;
    }
    assert.ok(walked, 'customer should walk out');
    assert.equal(s.customer, null);
    if (repBefore !== undefined) assert.ok(s.rep[faction] <= repBefore, 'walk-out: small rep loss (or none)');
  });

  test('AC-ENG-144 DEAL without agreement / without selected item fails for buyer', () => {
    const s = findCustomer(servableBuyer, { prep: (x) => stockShelf(x) });
    assert.ok(s);
    assert.ok(engine.step(s, { type: 'OFFER', price: 50 }).error, 'OFFER before SELECT_ITEM should fail for buyers');
  });

  test('AC-ENG-144 SELECT_ITEM rejects non-shelf items', () => {
    const s0 = findCustomer(servableBuyer, { prep: (x) => {
      x = stockShelf(x);
      const st = x.inventory.find((i) => i.location === 'shelf');
      x.inventory.push({ ...clone(st), uid: 't_storage_copy', location: 'storage' });
      return x;
    } });
    assert.ok(s0);
    assert.ok(engine.step(s0, { type: 'SELECT_ITEM', uid: 't_storage_copy' }).error, 'storage item cannot be sold at counter');
  });

  test('AC-ENG-153 REFUSE: customer leaves, no money changes', () => {
    const s = buyerAtCounter();
    const r = act(s, { type: 'REFUSE' });
    assert.equal(r.state.customer, null);
    assert.equal(r.state.creds, s.creds);
    assert.equal(r.state.inventory.length, s.inventory.length);
  });
});

describe('haggling with sellers', { skip }, () => {
  test('AC-ENG-145 AC-ENG-150 offer >= reservation accepted; DEAL buys item, pays price', () => {
    const s = sellerAtCounter();
    const res = s.customer.hidden.reservation;
    const price = Math.ceil((res * 1.1) / 5) * 5;
    const r = act(s, { type: 'OFFER', price });
    assert.ok(evTypes(r.events).includes('HAGGLE_ACCEPT'), `got ${evTypes(r.events)}`);
    const d = act(r.state, { type: 'DEAL' });
    assert.equal(d.state.creds, s.creds - price);
    assert.equal(d.state.inventory.length, s.inventory.length + 1);
    const got = d.state.inventory.find((i) => !s.inventory.some((j) => j.uid === i.uid));
    assert.equal(got.itemId, s.customer.item.itemId);
    assert.equal(got.boughtFor, price);
    assert.ok(['storage', 'shelf'].includes(got.location));
  });

  test('AC-ENG-146 lowball offer ⇒ seller counters downward (toward player), patience −1', () => {
    const s = sellerAtCounter();
    const res = s.customer.hidden.reservation;
    const low = Math.max(5, Math.round(res * 0.85));
    const r1 = act(s, { type: 'OFFER', price: low });
    const c1 = r1.events.find((e) => e.type === 'HAGGLE_COUNTER');
    if (!c1) return; // accepted or walked—nothing to compare
    assert.ok(c1.price > low, 'seller counter above player offer');
    assert.equal(r1.state.customer.patience, s.customer.patience - 1);
    const r2 = act(r1.state, { type: 'OFFER', price: low });
    const c2 = r2.events.find((e) => e.type === 'HAGGLE_COUNTER');
    if (c2) assert.ok(c2.price <= c1.price, `seller counters must move toward player (${c1.price} -> ${c2.price})`);
  });

  test('AC-ENG-150 cannot buy from seller without creds', () => {
    const s = sellerAtCounter();
    s.creds = 0;
    const res = s.customer.hidden.reservation;
    const r = engine.step(s, { type: 'OFFER', price: res + 50 });
    if (!r.error && hasLegal(r.state, 'DEAL')) {
      assert.ok(engine.step(r.state, { type: 'DEAL' }).error, 'DEAL with insufficient creds should fail');
    }
  });

  test('no OFFER/DEAL listed when no customer', () => {
    const s = act(engine.newGame({ seed: 1, background: 'sparky', difficulty: 'acid', shopName: 'Z' }), { type: 'OPEN_SHOP' }).state;
    if (!s.customer) {
      const t = legal(s).map((a) => a.type);
      for (const x of ['OFFER', 'DEAL', 'REFUSE', 'REPORT', 'SELECT_ITEM']) assert.ok(!t.includes(x), `${x} listed with no customer`);
    }
  });
});
