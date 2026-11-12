// Heat, audits, stash, fines, bribes, arrest (DESIGN §7.3, R2, R3).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { engine, SKIP_ENGINE, fresh, act, actFails, evTypes, hasLegal, skipDay, makeInv, items, clone } from './_helpers.mjs';

const skip = SKIP_ENGINE;

const contraband = () => items().filter((i) => i.legality === 'contraband' && !i.perishableDays);
const legalItems = () => items().filter((i) => i.legality === 'legal' && !i.perishableDays);

/** Build a dawn state with an audit in progress. place: list of [itemId, location]. */
function auditDawn({ place, heat = 66, vantage = 0, creds = 20000, background = 'fence' }) {
  let s = fresh({ background });
  s.inventory = [];
  for (const [id, loc] of place) s.inventory.push(makeInv(id, loc));
  s.creds = creds;
  s.rep.vantage = vantage;
  s = skipDay(s);
  if (hasLegal(s, 'PAY_DUES')) s = act(s, { type: 'PAY_DUES' }).state;
  s.heat = heat;
  s.auditPending = true;
  const r = act(s, { type: 'SLEEP' });
  return r.state;
}

describe('heat', { skip }, () => {
  test('AC-ENG-172 heat decays 5/day with no illegal activity', () => {
    let s = skipDay(fresh({ background: 'sparky' }));
    s.inventory = s.inventory.filter((i) => !engine.selectors.isIllegal(s, i));
    s.heat = 30;
    if (hasLegal(s, 'PAY_DUES')) s = act(s, { type: 'PAY_DUES' }).state;
    const r = act(s, { type: 'SLEEP' });
    assert.equal(r.state.heat, 25);
  });

  test('AC-ENG-172 heat never below 0', () => {
    let s = skipDay(fresh({ background: 'sparky' }));
    s.heat = 2;
    assert.ok(act(s, { type: 'SLEEP' }).state.heat >= 0);
  });

  test('AC-ENG-172 illegal items on shelf add heat overnight (+2 each)', () => {
    const cb = contraband();
    assert.ok(cb.length >= 1, 'content needs contraband items');
    let s = fresh({ background: 'sparky' });
    s.inventory = [];
    for (let k = 0; k < 3; k++) s.inventory.push(makeInv(cb[k % cb.length].id, 'shelf'));
    s = skipDay(s);
    // refuse everyone, so nothing sold; contraband still on shelf
    if (hasLegal(s, 'PAY_DUES')) s = act(s, { type: 'PAY_DUES' }).state;
    s.heat = 30;
    const onShelf = s.inventory.filter((i) => i.location === 'shelf' && engine.selectors.isIllegal(s, i)).length;
    const r = act(s, { type: 'SLEEP' });
    assert.equal(r.state.heat, 30 + 2 * onShelf - 5);
  });

  test('AC-ENG-171 isIllegal: contraband true, legal false', () => {
    const s = fresh();
    assert.equal(engine.selectors.isIllegal(s, makeInv(contraband()[0].id)), true);
    assert.equal(engine.selectors.isIllegal(s, makeInv(legalItems()[0].id)), false);
  });

  test('AC-ENG-173 heat ≥ 60 at sleep ⇒ auditPending', () => {
    let s = skipDay(fresh({ background: 'sparky' }));
    if (hasLegal(s, 'PAY_DUES')) s = act(s, { type: 'PAY_DUES' }).state;
    s.heat = 70;
    const r = act(s, { type: 'SLEEP' });
    assert.ok(r.state.auditPending || r.state.audit, 'audit should be pending/active at dawn');
  });

  test('AC-ENG-173 heat 40 (no crackdown) ⇒ no audit', () => {
    let s = skipDay(fresh({ background: 'sparky' }));
    if (hasLegal(s, 'PAY_DUES')) s = act(s, { type: 'PAY_DUES' }).state;
    s.heat = 40;
    s.events.active = [];
    const r = act(s, { type: 'SLEEP' });
    assert.ok(!r.state.audit && !r.state.auditPending);
  });
});

describe('audit', { skip }, () => {
  test('AC-ENG-174 AC-ENG-176 AC-ENG-177 dawn audit preview: shelf+storage found, stash not; fine = round(1.5×Σ basePrice)', () => {
    const [a, b, c] = [contraband()[0], contraband()[1] ?? contraband()[0], contraband()[2] ?? contraband()[0]];
    const s = auditDawn({ place: [[a.id, 'shelf'], [b.id, 'storage'], [c.id, 'stash'], [legalItems()[0].id, 'shelf']] });
    assert.equal(s.phase, 'dawn');
    assert.ok(s.audit, 'state.audit set at dawn start (R3)');
    assert.ok(!hasLegal(s, 'OPEN_SHOP'), 'OPEN_SHOP blocked during audit');
    actFails(s, { type: 'OPEN_SHOP' });
    const foundIds = s.audit.found.map((f) => f.itemId).sort();
    assert.deepEqual(foundIds, [a.id, b.id].sort());
    assert.equal(s.audit.fine, Math.round(1.5 * (a.basePrice + b.basePrice)));
    assert.equal(s.audit.bribeCost, Math.round(0.2 * s.audit.fine * (1 - 0 / 200)));
    assert.ok(Math.abs(s.audit.bribeChance - 0.5) < 1e-9);
  });

  test('AC-ENG-175 moving an item into the stash during dawn removes it from the audit (R3)', () => {
    const [a, b] = [contraband()[0], contraband()[1] ?? contraband()[0]];
    const s = auditDawn({ place: [[a.id, 'shelf'], [b.id, 'storage']] });
    const stor = s.inventory.find((i) => i.location === 'storage');
    const m = act(s, { type: 'MOVE_ITEM', uid: stor.uid, to: 'stash' }).state;
    assert.equal(m.audit.found.length, 1);
    assert.equal(m.audit.fine, Math.round(1.5 * a.basePrice));
    const r = act(m, { type: 'AUDIT_RESPOND', choice: 'comply' });
    assert.ok(r.state.inventory.some((i) => i.uid === stor.uid), 'stashed item survives');
    const shelfUid = s.inventory.find((i) => i.location === 'shelf').uid;
    assert.ok(!r.state.inventory.some((i) => i.uid === shelfUid), 'shelf contraband confiscated');
    assert.equal(r.state.creds, m.creds - Math.round(1.5 * a.basePrice));
  });

  test('AC-ENG-178 AC-ENG-179 comply: confiscate + fine, heat → 20, audit cleared, OPEN_SHOP legal, auditsSurvived++', () => {
    const a = contraband()[0];
    const s = auditDawn({ place: [[a.id, 'shelf'], [legalItems()[0].id, 'storage']] });
    const fine = s.audit.fine;
    const r = act(s, { type: 'AUDIT_RESPOND', choice: 'comply' });
    assert.equal(r.state.creds, s.creds - fine);
    assert.equal(r.state.heat, 20);
    assert.equal(r.state.audit, null);
    assert.equal(r.state.auditPending, false);
    assert.ok(hasLegal(r.state, 'OPEN_SHOP'));
    assert.ok(r.state.inventory.some((i) => i.itemId === legalItems()[0].id), 'legal goods untouched');
    assert.equal(r.state.stats.auditsSurvived, s.stats.auditsSurvived + 1);
  });

  test('AC-ENG-176 clean audit: zero fine', () => {
    const s = auditDawn({ place: [[legalItems()[0].id, 'shelf']] });
    if (!s.audit) return; // engine may skip empty audits
    assert.equal(s.audit.found.length, 0);
    assert.equal(s.audit.fine, 0);
    const r = act(s, { type: 'AUDIT_RESPOND', choice: 'comply' });
    assert.equal(r.state.creds, s.creds);
  });

  for (const v of [-100, -40, 0, 30, 100]) {
    test(`AC-ENG-177 bribe math at vantage ${v}`, () => {
      const a = contraband()[0];
      const s = auditDawn({ place: [[a.id, 'shelf'], [a.id, 'storage']], vantage: v });
      const fine = Math.round(1.5 * 2 * a.basePrice);
      assert.equal(s.audit.fine, fine);
      assert.equal(s.audit.bribeCost, Math.round(0.2 * fine * (1 - v / 200)));
      const chance = Math.min(0.95, Math.max(0.05, 0.5 + v / 200));
      assert.ok(Math.abs(s.audit.bribeChance - chance) < 1e-9, `bribeChance ${s.audit.bribeChance} vs ${chance}`);
    });
  }

  test('AC-ENG-178 bribe success: pay bribe only, no confiscation; failure: bribe + 2×fine, confiscate, −10 Vantage', () => {
    const a = contraband()[0];
    const base = auditDawn({ place: [[a.id, 'shelf'], [a.id, 'storage']], vantage: 0 });
    const { fine, bribeCost } = base.audit;
    let succ = 0, fail = 0;
    for (let i = 0; i < 200; i++) {
      const s = clone(base); s.rng = (Math.imul(i + 3, 2246822519) ^ 0xabcdef) >>> 0;
      const r = act(s, { type: 'AUDIT_RESPOND', choice: 'bribe' });
      const kept = r.state.inventory.filter((x) => x.itemId === a.id).length;
      if (kept === 2) {
        succ++;
        assert.equal(r.state.creds, s.creds - bribeCost);
        assert.equal(r.state.rep.vantage, s.rep.vantage);
      } else {
        fail++;
        assert.equal(kept, 0, 'failure confiscates all found');
        assert.equal(r.state.creds, s.creds - bribeCost - 2 * fine);
        assert.equal(r.state.rep.vantage, s.rep.vantage - 10);
      }
      assert.equal(r.state.audit, null);
    }
    assert.ok(succ / 200 > 0.38 && succ / 200 < 0.62, `bribe success rate ${succ / 200}`);
    assert.ok(fail > 0);
  });

  test('AC-ENG-180 unpayable fine with > 1000¢ contraband ⇒ Arrested', () => {
    const cb = contraband().sort((x, y) => y.basePrice - x.basePrice);
    const place = [];
    let sum = 0;
    for (let k = 0; sum <= 1000 && k < 16; k++) {
      const it = cb[k % cb.length];
      place.push([it.id, k < 6 ? 'shelf' : 'storage']); sum += it.basePrice;
    }
    assert.ok(sum > 1000, 'need >1000¢ of contraband in content to test arrest');
    const s = auditDawn({ place, creds: 0, background: 'tinker' });
    const r = act(s, { type: 'AUDIT_RESPOND', choice: 'comply' });
    assert.equal(r.state.phase, 'ended');
    assert.equal(r.state.ending.win, false);
    assert.match(`${r.state.ending.id} ${r.state.ending.title}`, /arrest/i);
  });

  test('AC-ENG-180 unpayable fine with small contraband ⇒ debt, not arrest', () => {
    const cheap = contraband().sort((x, y) => x.basePrice - y.basePrice)[0];
    assert.ok(cheap.basePrice * 1.5 > 5);
    const s = auditDawn({ place: [[cheap.id, 'shelf']], creds: 0, background: 'tinker' });
    const r = act(s, { type: 'AUDIT_RESPOND', choice: 'comply' });
    assert.notEqual(r.state.phase, 'ended');
    assert.ok(r.state.creds < 0, 'creds go negative (debt)');
  });

  test('AC-ENG-109 AUDIT_RESPOND without an audit fails', () => {
    actFails(fresh(), { type: 'AUDIT_RESPOND', choice: 'comply' });
  });
});
