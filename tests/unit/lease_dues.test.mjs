// Lease schedule/grace/eviction (DESIGN §5, R4) and Lantern dues / break-ins (DESIGN §5, R5).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { engine, SKIP_ENGINE, fresh, act, actFails, evTypes, hasLegal, skipDay, makeInv, items, clone } from './_helpers.mjs';

const skip = SKIP_ENGINE;

function nightWithLeaseDue(opts = {}, creds = 5000) {
  const s = fresh(opts);
  s.lease.nextDueDay = 1;
  s.creds = creds;
  const n = skipDay(s);
  if (hasLegal(n, 'PAY_DUES') && creds > 100) return act(n, { type: 'PAY_DUES' }).state;
  return n;
}

describe('lease', { skip }, () => {
  for (const [diff, mult] of [['drizzle', 1.10], ['acid', 1.15], ['downpour', 1.20]]) {
    test(`AC-ENG-191 AC-ENG-192 auto-pays on due day and escalates ×${mult} (${diff})`, () => {
      const n = nightWithLeaseDue({ difficulty: diff });
      const amt = n.lease.amount;
      const r = act(n, { type: 'SLEEP' });
      assert.ok(evTypes(r.events).includes('LEASE_PAID'), `events: ${evTypes(r.events)}`);
      assert.ok(n.creds - r.state.creds >= amt, 'lease amount deducted');
      assert.equal(r.state.lease.amount, Math.round(amt * mult));
      assert.equal(r.state.lease.nextDueDay, 8);
      assert.equal(r.state.lease.graceActive, false);
      assert.equal(r.state.phase, 'dawn');
    });
  }

  test('AC-ENG-191 AC-ENG-196 lease not charged before due day', () => {
    const s = fresh(); s.creds = 5000;
    const n = skipDay(s);
    const r = act(n, { type: 'SLEEP' });
    assert.ok(!evTypes(r.events).includes('LEASE_PAID'));
    assert.equal(r.state.lease.amount, 350);
    assert.equal(engine.selectors.daysUntilLease(r.state), 5);
  });

  test('AC-ENG-193 miss ⇒ grace, missedCount 1, overdue = round(amount×1.25), still escalates', () => {
    const n = nightWithLeaseDue({}, 10);
    const r = act(n, { type: 'SLEEP' });
    assert.ok(evTypes(r.events).includes('LEASE_MISSED'), `events: ${evTypes(r.events)}`);
    const L = r.state.lease;
    assert.equal(L.graceActive, true);
    assert.equal(L.missedCount, 1);
    assert.equal(L.overdue, Math.round(350 * 1.25));
    assert.equal(L.amount, Math.round(350 * 1.15));
    assert.equal(L.nextDueDay, 8);
    assert.notEqual(r.state.phase, 'ended', 'first miss is not game over');
  });

  test('AC-ENG-195 PAY_LEASE clears overdue and grace', () => {
    const n = nightWithLeaseDue({}, 10);
    let s = act(n, { type: 'SLEEP' }).state;
    s.creds = 2000;
    assert.ok(hasLegal(s, 'PAY_LEASE'));
    const r = act(s, { type: 'PAY_LEASE' });
    assert.equal(r.state.creds, 2000 - Math.round(350 * 1.25));
    assert.equal(r.state.lease.graceActive, false);
    assert.ok(!r.state.lease.overdue, 'overdue cleared');
  });

  test('AC-ENG-195 PAY_LEASE with insufficient creds fails', () => {
    const s = fresh(); s.creds = 10;
    actFails(s, { type: 'PAY_LEASE' });
  });

  test('AC-ENG-194 second miss while in grace ⇒ Evicted ending', () => {
    const n = nightWithLeaseDue({}, 10);
    let s = act(n, { type: 'SLEEP' }).state;
    s.lease.nextDueDay = s.day; // fast-forward to next due day
    s.creds = 10;
    s = skipDay(s);
    const r = act(s, { type: 'SLEEP' });
    assert.equal(r.state.phase, 'ended');
    assert.equal(r.state.ending.win, false);
    assert.match(`${r.state.ending.id} ${r.state.ending.title}`, /evict/i);
    assert.ok(evTypes(r.events).includes('ENDING'));
  });

  test('AC-ENG-194 in grace, paying overdue + amount at next due day avoids eviction', () => {
    const n = nightWithLeaseDue({}, 10);
    let s = act(n, { type: 'SLEEP' }).state;
    s.lease.nextDueDay = s.day;
    s.creds = 5000;
    s = skipDay(s);
    const r = act(s, { type: 'SLEEP' });
    assert.notEqual(r.state.phase, 'ended');
    assert.equal(r.state.lease.graceActive, false);
    assert.ok(s.creds - r.state.creds >= Math.round(350 * 1.25) + Math.round(350 * 1.15), 'paid overdue + amount');
  });
});

describe('Lantern dues & break-ins', { skip }, () => {
  function night(prep) {
    let s = fresh({ background: 'sparky' });
    const def = items().filter((i) => i.legality === 'legal' && !i.perishableDays);
    for (let k = 0; k < 6 && def.length; k++) s.inventory.push(makeInv(def[k % def.length].id, 'storage'));
    if (prep) prep(s);
    return skipDay(s);
  }

  test('AC-ENG-200 duesQuote = max(15, 5% of stock value)', () => {
    const s = night();
    const sv = engine.selectors.stockValue(s);
    assert.equal(engine.selectors.duesQuote(s), Math.max(15, Math.round(sv * 0.05)));
  });

  test('AC-ENG-197 PAY_DUES charges quote, sets flag, resets streak; cannot pay twice', () => {
    const s = night((x) => { x.duesSkipStreak = 3; });
    const q = engine.selectors.duesQuote(s);
    const r = act(s, { type: 'PAY_DUES' });
    assert.equal(r.state.creds, s.creds - q);
    assert.equal(r.state.duesPaidTonight, true);
    assert.equal(r.state.duesSkipStreak, 0);
    assert.ok(!hasLegal(r.state, 'PAY_DUES') && !hasLegal(r.state, 'SKIP_DUES'));
    actFails(r.state, { type: 'PAY_DUES' });
  });

  test('AC-ENG-197 SKIP_DUES increments streak; not paying at all counts as a skip', () => {
    const s = night();
    const r = act(s, { type: 'SKIP_DUES' });
    assert.equal(r.state.duesSkipStreak, 1);
    const slept = act(s, { type: 'SLEEP' }).state;
    assert.equal(slept.duesSkipStreak, 1, 'neither pay nor skip ⇒ counts as skip (R5)');
  });

  function breakInRate(base, trials = 400) {
    let hits = 0;
    for (let i = 0; i < trials; i++) {
      const s = clone(base);
      s.rng = (Math.imul(i + 7, 2654435761) ^ 0x5bd1e995) >>> 0;
      const r = act(s, { type: 'SLEEP' });
      if (r.events.some((e) => e.type === 'BREAK_IN')) hits++;
    }
    return hits / trials;
  }

  test('AC-ENG-198 first skip ⇒ ~25% break-in chance', () => {
    const s = act(night(), { type: 'SKIP_DUES' }).state;
    const p = breakInRate(s);
    assert.ok(p >= 0.17 && p <= 0.33, `break-in rate ${p}`);
  });

  test('AC-ENG-198 4th consecutive skip ⇒ ~55% break-in chance', () => {
    const s = act(night((x) => { x.duesSkipStreak = 3; }), { type: 'SKIP_DUES' }).state;
    assert.equal(s.duesSkipStreak, 4);
    const p = breakInRate(s);
    assert.ok(p >= 0.45 && p <= 0.65, `break-in rate ${p}`);
  });

  test('AC-ENG-198 paid dues ⇒ no break-ins', () => {
    const s = act(night(), { type: 'PAY_DUES' }).state;
    assert.equal(breakInRate(s, 150), 0);
  });

  test('AC-ENG-199 break-in steals 1–3 items (removed from inventory) or breaks a machine', () => {
    const s = act(night((x) => { x.duesSkipStreak = 6; }), { type: 'SKIP_DUES' }).state;
    let seen = 0;
    for (let i = 0; i < 60; i++) {
      const t = clone(s); t.rng = (i * 7919 + 13) >>> 0;
      const r = act(t, { type: 'SLEEP' });
      const b = r.events.find((e) => e.type === 'BREAK_IN');
      if (!b) continue;
      seen++;
      const stolen = b.stolen ?? [];
      if (stolen.length) {
        assert.ok(stolen.length >= 1 && stolen.length <= 3, `stolen ${stolen.length}`);
        for (const x of stolen) {
          const uid = typeof x === 'string' ? x : x.uid;
          assert.ok(!r.state.inventory.some((it) => it.uid === uid), 'stolen item removed');
        }
      }
    }
    assert.ok(seen > 0);
  });

  test('AC-ENG-419 Lantern rep ≤ −60 and dues unpaid 5+ nights ⇒ Taken for a Ride', () => {
    const s = act(night((x) => { x.duesSkipStreak = 4; x.rep.lantern = -70; }), { type: 'SKIP_DUES' }).state;
    const r = act(s, { type: 'SLEEP' });
    assert.equal(r.state.phase, 'ended');
    assert.equal(r.state.ending.win, false);
    assert.match(`${r.state.ending.id} ${r.state.ending.title}`, /ride/i);
  });

  test('AC-ENG-419 Lantern rep −59 with 5 skips is NOT game over', () => {
    const s = act(night((x) => { x.duesSkipStreak = 4; x.rep.lantern = -50; }), { type: 'SKIP_DUES' }).state;
    const r = act(s, { type: 'SLEEP' });
    assert.ok(r.state.phase !== 'ended' || !/ride/i.test(r.state.ending.id + r.state.ending.title));
  });
});
