// Endings (DESIGN §13, R1) and save/load (ARCH §3.1).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { engine, SKIP_ENGINE, fresh, act, actFails, evTypes, hasLegal, skipDay, nextDay, randomWalk, clone } from './_helpers.mjs';

const skip = SKIP_ENGINE;

describe('endings', { skip }, () => {
  const winCases = [
    ['vantage', /franchise/i], ['lantern', /made in the sump/i], ['static', /free node/i], ['sump', /heart of the stairwell/i],
  ];
  for (const [faction, re] of winCases) {
    test(`AC-ENG-417 BUY_DEED with ${faction} rep ≥ 40 ⇒ win "${re.source}"`, () => {
      const s = fresh();
      s.rep = { vantage: 0, lantern: 0, static: 0, sump: 0, [faction]: 55 };
      s.creds = s.deedPrice + 123;
      const r = act(s, { type: 'BUY_DEED' });
      assert.equal(r.state.phase, 'ended');
      assert.equal(r.state.ending.win, true);
      assert.match(r.state.ending.title, re);
      assert.equal(r.state.creds, 123, 'deed price deducted');
      assert.ok(evTypes(r.events).includes('ENDING'));
      assert.ok(r.state.ending.stats && typeof r.state.ending.stats === 'object');
    });
  }

  test('AC-ENG-417 BUY_DEED with no faction ≥ 40 ⇒ "Your Own Name on the Door"', () => {
    const s = fresh();
    s.rep = { vantage: 39, lantern: 20, static: -5, sump: 10 };
    s.creds = s.deedPrice;
    const r = act(s, { type: 'BUY_DEED' });
    assert.equal(r.state.ending.win, true);
    assert.match(r.state.ending.title, /own name/i);
  });

  test('AC-ENG-417 BUY_DEED works at night too and fails while open', () => {
    let s = fresh(); s.creds = s.deedPrice * 2;
    const n = skipDay(s);
    assert.ok(hasLegal(n, 'BUY_DEED'));
    assert.equal(act(n, { type: 'BUY_DEED' }).state.phase, 'ended');
    const o = act(s, { type: 'OPEN_SHOP' }).state;
    actFails(o, { type: 'BUY_DEED' });
  });

  test('AC-ENG-418 CONTINUE_ENDLESS after a win ⇒ next dawn, no more lease', () => {
    const s = fresh(); s.creds = s.deedPrice;
    let e = act(s, { type: 'BUY_DEED' }).state;
    assert.ok(hasLegal(e, 'CONTINUE_ENDLESS'));
    e = act(e, { type: 'CONTINUE_ENDLESS' }).state;
    assert.equal(e.phase, 'dawn');
    e.creds = 0;
    for (let d = 0; d < 8 && e.phase !== 'ended'; d++) {
      const n = skipDay(e);
      const r = act(n, { type: 'SLEEP' });
      assert.ok(!evTypes(r.events).includes('LEASE_MISSED'), 'no lease after owning the deed');
      e = r.state;
    }
    assert.ok(e.phase !== 'ended' || !/evict/i.test(e.ending.id));
  });

  test('AC-ENG-419 Underwater: creds < −2000 for 3 days ⇒ loss', () => {
    let s = fresh({ background: 'sparky' });
    s.creds = -2500;
    s.lease.nextDueDay = 50;
    let ended = null;
    for (let d = 0; d < 4; d++) {
      s.creds = Math.min(s.creds, -2500);
      const r = act(skipDay(s), { type: 'SLEEP' });
      s = r.state;
      if (s.phase === 'ended') { ended = d + 1; break; }
    }
    assert.equal(s.phase, 'ended', 'should end underwater');
    assert.match(`${s.ending.id} ${s.ending.title}`, /underwater/i);
    assert.equal(s.ending.win, false);
    assert.ok(ended >= 3, `ended after ${ended} nights (needs 3 days below −2000)`);
  });

  test('AC-ENG-419 debt −1500 for many days is not Underwater', () => {
    let s = fresh({ background: 'sparky' });
    s.lease.nextDueDay = 50;
    for (let d = 0; d < 4; d++) { s.creds = -1500; s = act(skipDay(s), { type: 'SLEEP' }).state; }
    assert.notEqual(s.phase, 'ended');
  });

  test('AC-ENG-418 ended state: no actions except CONTINUE_ENDLESS for wins', () => {
    const s = fresh(); s.creds = s.deedPrice;
    const e = act(s, { type: 'BUY_DEED' }).state;
    const t = engine.legalActions(e).map((a) => a.type);
    assert.deepEqual([...new Set(t)].filter((x) => x !== 'CHOOSE_PERK'), ['CONTINUE_ENDLESS']);
    actFails(e, { type: 'SLEEP' });
    actFails(e, { type: 'OPEN_SHOP' });
  });
});

describe('save / load', { skip }, () => {
  test('AC-ENG-116 serialize returns a string and round-trips a fresh game', () => {
    const s = fresh();
    const str = engine.serialize(s);
    assert.equal(typeof str, 'string');
    const back = engine.deserialize(str);
    assert.deepEqual(back, s);
  });

  test('AC-ENG-116 round-trips mid-game states in every phase and continues identically', () => {
    let s = fresh({ seed: 99, background: 'fence' });
    let checked = 0;
    randomWalk(s, 600, 5, (prev, a, r) => {
      if (checked > 60 || r.error) return;
      checked++;
      const back = engine.deserialize(engine.serialize(prev));
      assert.deepEqual(back, prev, `round-trip mismatch in ${prev.phase}`);
      const r2 = engine.step(back, a);
      assert.equal(engine.serialize(r2.state), engine.serialize(r.state), `diverged after load on ${a.type}`);
    });
  });

  test('AC-ENG-116 round-trips states with customer / inspection / audit / ending', () => {
    const s = act(fresh(), { type: 'OPEN_SHOP' }).state;
    const c = s.customer ? s : act(s, { type: 'NEXT_CUSTOMER' }).state;
    assert.deepEqual(engine.deserialize(engine.serialize(c)), c);
    const w = fresh(); w.creds = w.deedPrice;
    const e = act(w, { type: 'BUY_DEED' }).state;
    assert.deepEqual(engine.deserialize(engine.serialize(e)), e);
  });

  test('AC-ENG-117 deserialize returns null for unreadable input (no throw)', () => {
    for (const bad of ['', 'not json', '{', 'null', '42', '[]', '{}', JSON.stringify({ saveVersion: 999 }), undefined, null]) {
      let r;
      assert.doesNotThrow(() => { r = engine.deserialize(bad); }, `threw on ${bad}`);
      assert.equal(r, null, `expected null for ${String(bad).slice(0, 20)}`);
    }
  });

  test('AC-ENG-116 deserialized state is independent of the source (no shared references)', () => {
    const s = fresh();
    const str = engine.serialize(s);
    const a = engine.deserialize(str), b = engine.deserialize(str);
    a.creds = -1; a.inventory.push({});
    assert.notEqual(b.creds, -1);
    assert.notEqual(b.inventory.length, a.inventory.length);
  });

  test('AC-ENG-116 save carries saveVersion', () => {
    const o = JSON.parse(engine.serialize(fresh()));
    const v = o.saveVersion ?? o.v ?? o.version ?? o.state?.saveVersion;
    assert.equal(v, 1);
  });

  test('AC-ENG-116 two weeks played, saved, loaded: still playable', () => {
    let s = fresh({ background: 'line_cook' });
    for (let d = 0; d < 14 && s.phase !== 'ended'; d++) s = nextDay(engine.deserialize(engine.serialize(s)));
    assert.ok(engine.legalActions(s).length > 0);
  });
});
