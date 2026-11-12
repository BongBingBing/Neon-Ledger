// Ghost chits (DESIGN §7.1) and spoilage (R6).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { engine, SKIP_ENGINE, fresh, act, actFails, evTypes, hasLegal, skipDay, makeInv, items, stockShelf, findCustomer, selectableUids, isBuyer } from './_helpers.mjs';

const skip = SKIP_ENGINE;

/** Drive a buyer (already at counter) to the chit panel. Returns {state, price} or null if no chit step. */
function toChit(s) {
  s = act(s, { type: 'SELECT_ITEM', uid: selectableUids(s)[0] }).state;
  const price = Math.max(5, Math.floor((s.customer.hidden.reservation * 0.8) / 5) * 5);
  s = act(s, { type: 'OFFER', price }).state;
  const r = act(s, { type: 'DEAL' });
  return { state: r.state, price, events: r.events };
}

function chitTells(c, day) {
  const t = [];
  if (c.chit.name !== c.name) t.push('name');
  if (c.chit.ward !== c.homeWard) t.push('ward');
  if (c.chit.sigilGlitch) t.push('sigil');
  if (c.chit.expiryDay < day) t.push('expired');
  return t;
}

describe('ghost chits', { skip }, () => {
  const ghostBuyer = () => findCustomer((c, s) => isBuyer(c) && c.hidden?.ghostChit && selectableUids(s).length > 0,
    { seeds: 400, prep: (x) => stockShelf(x) });
  const honestChitBuyer = () => findCustomer((c, s) => isBuyer(c) && c.chit && !c.hidden?.ghostChit && !c.hidden?.undercover && selectableUids(s).length > 0,
    { seeds: 200, prep: (x) => stockShelf(x) });

  test('AC-ENG-161 AC-ENG-162 ghost chit buyers exist and carry a chit with 1–2 tells', () => {
    const s = ghostBuyer();
    assert.ok(s, 'no ghost-chit buyer found in 400 seeds (expected ~6% of buyers)');
    const c = s.customer;
    assert.ok(c.chit, 'ghost buyer has chit');
    for (const k of ['name', 'ward', 'sigilGlitch', 'expiryDay']) assert.ok(k in c.chit, `chit.${k}`);
    const t = chitTells(c, s.day);
    assert.ok(t.length >= 1 && t.length <= 2, `ghost chit tells: ${t}`);
  });

  test('AC-ENG-162 genuine chits have no tells (fairness)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = act(stockShelf(fresh({ seed })), { type: 'OPEN_SHOP' }).state;
      for (const c of [s.customer, ...s.queue].filter(Boolean)) {
        if (c.chit && !c.hidden?.ghostChit) {
          assert.deepEqual(chitTells(c, s.day), [], `genuine chit with tells: ${c.name}`);
          checked++;
        }
      }
    }
    assert.ok(checked > 0, 'no genuine chits observed');
  });

  test('AC-ENG-163 accepting a ghost chit: sale happens, creds bounce overnight (CHIT_BOUNCED)', () => {
    const s0 = ghostBuyer();
    assert.ok(s0);
    const { state, price } = toChit(s0);
    assert.ok(hasLegal(state, 'ACCEPT_CHIT') && hasLegal(state, 'REJECT_CHIT'), 'chit panel offered');
    const acc = act(state, { type: 'ACCEPT_CHIT' });
    const uid = s0.inventory.find((i) => selectableUids(s0).includes(i.uid)).uid;
    assert.ok(!acc.state.inventory.some((i) => i.uid === uid), 'item handed over');
    let n = act(acc.state, { type: 'CLOSE_SHOP' }).state;
    const r = act(n, { type: 'SLEEP' });
    const b = r.events.find((e) => e.type === 'CHIT_BOUNCED');
    assert.ok(b, `expected CHIT_BOUNCED, got ${evTypes(r.events)}`);
    assert.equal(acc.state.creds, state.creds + price, 'ghost sale credits at the counter');
    assert.ok(b.amount === price || r.state.dayLog.lines.some((l) => l.amount === -price), 'bounce reverses exactly the sale price');
  });

  test('AC-ENG-163 rejecting a ghost chit: item kept, no creds, ghostChitsCaught++', () => {
    const s0 = ghostBuyer();
    const { state } = toChit(s0);
    const r = act(state, { type: 'REJECT_CHIT' });
    assert.equal(r.state.creds, s0.creds);
    assert.equal(r.state.inventory.length, s0.inventory.length);
    assert.equal(r.state.stats.ghostChitsCaught, s0.stats.ghostChitsCaught + 1);
    assert.equal(r.state.customer, null);
  });

  test('AC-ENG-161 accepting a genuine chit never bounces', () => {
    const s0 = honestChitBuyer();
    if (!s0) return; // engine may use chits only for ghosts — nothing to test
    const { state, price } = toChit(s0);
    let s = hasLegal(state, 'ACCEPT_CHIT') ? act(state, { type: 'ACCEPT_CHIT' }).state : state;
    assert.equal(s.creds, s0.creds + price);
    s = act(s, { type: 'CLOSE_SHOP' }).state;
    const r = act(s, { type: 'SLEEP' });
    assert.ok(!r.events.some((e) => e.type === 'CHIT_BOUNCED'));
  });

  test('AC-ENG-161 ACCEPT_CHIT/REJECT_CHIT fail when no chit is pending', () => {
    const s = act(fresh(), { type: 'OPEN_SHOP' }).state;
    actFails(s, { type: 'ACCEPT_CHIT' });
    actFails(s, { type: 'REJECT_CHIT' });
  });

  test('AC-ENG-164 ghost chit rate rises with day (≈6% day 1 → ≈15% day 40)', () => {
    const rate = (day) => {
      let buyers = 0, ghosts = 0;
      for (let seed = 1; seed <= 150; seed++) {
        const s0 = stockShelf(fresh({ seed })); s0.day = day; s0.lease.nextDueDay = day + 3;
        const s = act(s0, { type: 'OPEN_SHOP' }).state;
        for (const c of [s.customer, ...s.queue].filter(Boolean)) if (c.kind === 'buyer') { buyers++; if (c.hidden?.ghostChit) ghosts++; }
      }
      return ghosts / buyers;
    };
    const r1 = rate(1), r40 = rate(40);
    assert.ok(r1 > 0.02 && r1 < 0.11, `day1 ghost rate ${r1}`);
    assert.ok(r40 > 0.09 && r40 < 0.22, `day40 ghost rate ${r40}`);
    assert.ok(r40 > r1);
  });
});

describe('spoilage', { skip }, () => {
  test('AC-ENG-218 perishable items with spoilsDay <= day are removed at SLEEP with SPOILED', () => {
    const food = items().filter((i) => i.perishableDays);
    assert.ok(food.length > 0, 'content needs perishable items');
    let s = skipDay(fresh({ background: 'line_cook' }));
    if (hasLegal(s, 'PAY_DUES')) s = act(s, { type: 'PAY_DUES' }).state;
    const rotten = makeInv(food[0].id, 'storage', { spoilsDay: s.day });
    const fine = makeInv(food[0].id, 'storage', { spoilsDay: s.day + 2 });
    s.inventory.push(rotten, fine);
    const r = act(s, { type: 'SLEEP' });
    const ev = r.events.find((e) => e.type === 'SPOILED');
    assert.ok(ev, `expected SPOILED, got ${evTypes(r.events)}`);
    assert.ok(ev.uids.includes(rotten.uid));
    assert.ok(!ev.uids.includes(fine.uid));
    assert.ok(!r.state.inventory.some((i) => i.uid === rotten.uid), 'spoiled removed');
    assert.ok(r.state.inventory.some((i) => i.uid === fine.uid), 'fresh food kept');
  });

  test('AC-ENG-217 bought perishables get spoilsDay = acquiredDay + perishableDays', () => {
    let s = skipDay(fresh());
    s.creds = 100000;
    const idx = s.market.listings.findIndex((l) => engine.selectors.itemDef(l.itemId)?.perishableDays && l.qty > 0);
    if (idx < 0) return;
    const r = act(s, { type: 'BUY_STOCK', listingIndex: idx, qty: 1 });
    const added = r.state.inventory.find((i) => !s.inventory.some((j) => j.uid === i.uid));
    const def = engine.selectors.itemDef(added.itemId);
    assert.equal(added.spoilsDay, added.acquiredDay + def.perishableDays);
  });
});
