// Determinism, purity, robustness (ARCHITECTURE §3).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { engine, SKIP_ENGINE, fresh, deepFreeze, clone, randomWalk, legal, completeAction, mulberry, backgroundIds, DIFFICULTIES } from './_helpers.mjs';

const skip = SKIP_ENGINE;

function scriptedRun(seed, background, difficulty, steps = 400, walkSeed = 99) {
  const s0 = engine.newGame({ seed, background, difficulty, shopName: 'Det' });
  const log = [];
  const s = randomWalk(s0, steps, walkSeed, (_p, a, r) => log.push([a, r.error ?? null, r.events.map((e) => e.type)]));
  return { s, log };
}

describe('determinism', { skip }, () => {
  test('AC-ENG-106 same seed + options ⇒ identical newGame', () => {
    const a = fresh({ seed: 42 }), b = fresh({ seed: 42 });
    assert.equal(engine.serialize(a), engine.serialize(b));
  });

  test('AC-ENG-107 different seeds ⇒ different games (rng/market/customers)', () => {
    const a = fresh({ seed: 1 }), b = fresh({ seed: 2 });
    assert.notEqual(a.rng, b.rng);
  });

  test('newGame without seed still produces a valid uint32 seed', () => {
    const s = engine.newGame({ background: 'tinker', difficulty: 'acid', shopName: 'X' });
    assert.ok(Number.isInteger(s.seed));
  });

  for (const bg of backgroundIds()) {
    test(`AC-ENG-106 same seed + same actions ⇒ identical serialized state & events (${bg})`, () => {
      const r1 = scriptedRun(777, bg, 'acid');
      const r2 = scriptedRun(777, bg, 'acid');
      assert.deepEqual(r1.log, r2.log);
      assert.equal(engine.serialize(r1.s), engine.serialize(r2.s));
      assert.ok(r1.s.day >= 2 || r1.s.phase === 'ended', `walk should progress past day 1 (day=${r1.s.day})`);
    });
  }

  test('AC-ENG-106 OPEN_SHOP queue depends only on state (replay twice from same snapshot)', () => {
    const s = fresh({ seed: 5 });
    const a = engine.step(s, { type: 'OPEN_SHOP' });
    const b = engine.step(s, { type: 'OPEN_SHOP' });
    assert.equal(engine.serialize(a.state), engine.serialize(b.state));
    assert.deepEqual(a.events, b.events);
  });

  test('AC-ENG-115 engine does not use Math.random / Date.now (determinism holds with them poisoned)', () => {
    const origR = Math.random, origN = Date.now;
    const ref = scriptedRun(31337, 'fence', 'downpour', 250).s;
    try {
      Math.random = () => 0.999999;
      Date.now = () => 0;
      const other = scriptedRun(31337, 'fence', 'downpour', 250).s;
      assert.equal(engine.serialize(other), engine.serialize(ref));
    } finally { Math.random = origR; Date.now = origN; }
  });
});

describe('purity: step never mutates its input', { skip }, () => {
  for (const diff of DIFFICULTIES) {
    test(`AC-ENG-108 deep-frozen input survives a 500-step walk (${diff})`, () => {
      let s = fresh({ seed: 2024, difficulty: diff, background: 'fence' });
      const rnd = mulberry(3);
      for (let i = 0; i < 500 && s.phase !== 'ended'; i++) {
        const snap = JSON.stringify(s);
        deepFreeze(s);
        const opts = legal(s);
        const a = completeAction(s, opts[Math.floor(rnd() * opts.length)], rnd);
        if (!a) continue;
        let r;
        assert.doesNotThrow(() => { r = engine.step(s, a); }, `step threw (frozen input?) on ${JSON.stringify(a)} day ${s.day} ${s.phase}`);
        assert.equal(JSON.stringify(s), snap, `input mutated by ${a.type}`);
        assert.notEqual(r.state, s, 'step should return a new state object');
        if (!r.error) s = r.state;
      }
    });
  }

  test('AC-ENG-108 legalActions / serialize / selectors do not mutate frozen state', () => {
    const s = deepFreeze(fresh());
    assert.doesNotThrow(() => engine.legalActions(s));
    assert.doesNotThrow(() => engine.serialize(s));
    const sel = engine.selectors;
    assert.doesNotThrow(() => { sel.netWorth(s); sel.stockValue(s); sel.marketListings(s); sel.availableUpgrades(s); sel.availableMachines(s); sel.duesQuote(s); });
  });
});

describe('invalid actions return error, never throw', { skip }, () => {
  const garbage = [
    null, undefined, 42, 'SLEEP', {}, { type: 'NOPE' }, { type: '' },
    { type: 'OFFER' }, { type: 'OFFER', price: -5 }, { type: 'OFFER', price: 'abc' }, { type: 'OFFER', price: NaN },
    { type: 'OFFER', price: Infinity }, { type: 'MOVE_ITEM', uid: 'nonexistent', to: 'shelf' },
    { type: 'MOVE_ITEM', uid: null, to: 'moon' }, { type: 'BUY_STOCK', listingIndex: 999, qty: 1 },
    { type: 'BUY_STOCK', listingIndex: 0, qty: -3 }, { type: 'BUY_STOCK', listingIndex: 0, qty: 1.5 },
    { type: 'BUY_MACHINE', id: 'no_such_machine' }, { type: 'CHOOSE_PERK', perkId: 'nope' },
    { type: 'SELECT_ITEM', uid: 'nope' }, { type: 'INSPECT_INPUT', input: { cell: 999 } },
    { type: 'RUN_MACHINE', machineId: 'x', recipeId: 'y', inputUids: 'notarray' },
    { type: 'NIGHT_JOB', jobId: '__proto__' }, { type: 'constructor' }, { type: 'toString' },
    { type: 'AUDIT_RESPOND', choice: 'flee' }, { type: 'SPECIAL_CHOICE', optionId: 'x' },
  ];
  const states = () => {
    const d = fresh();
    const o = engine.step(d, { type: 'OPEN_SHOP' }).state;
    const n = engine.step(o, { type: 'CLOSE_SHOP' }).state;
    return { dawn: d, open: o, night: n };
  };
  for (const [phase, s] of Object.entries(states())) {
    test(`AC-ENG-109 garbage actions in ${phase}`, () => {
      for (const g of garbage) {
        const before = JSON.stringify(s);
        let r;
        assert.doesNotThrow(() => { r = engine.step(s, g); }, `threw on ${JSON.stringify(g)}`);
        assert.ok(r && typeof r.error === 'string' && r.error, `expected error for ${JSON.stringify(g)} in ${phase}`);
        assert.ok(Array.isArray(r.events));
        assert.equal(JSON.stringify(r.state), before, `state changed on invalid action ${JSON.stringify(g)}`);
      }
    });
  }

  test('AC-ENG-109 wrong-phase actions fail', () => {
    const { dawn, open, night } = states();
    const wrong = [
      [dawn, { type: 'SLEEP' }], [dawn, { type: 'CLOSE_SHOP' }], [dawn, { type: 'NEXT_CUSTOMER' }], [dawn, { type: 'BUY_STOCK', listingIndex: 0, qty: 1 }],
      [open, { type: 'OPEN_SHOP' }], [open, { type: 'SLEEP' }], [open, { type: 'BUY_STOCK', listingIndex: 0, qty: 1 }], [open, { type: 'PAY_DUES' }],
      [night, { type: 'OPEN_SHOP' }], [night, { type: 'NEXT_CUSTOMER' }], [night, { type: 'DEAL' }], [night, { type: 'CLOSE_SHOP' }],
      [dawn, { type: 'CONTINUE_ENDLESS' }], [night, { type: 'AUDIT_RESPOND', choice: 'comply' }],
    ];
    for (const [s, a] of wrong) {
      const r = engine.step(s, a);
      assert.ok(r.error, `${a.type} should fail in ${s.phase}`);
    }
  });

});

describe('money is integer', { skip }, () => {
  test('AC-ENG-113 creds and prices stay integers through a long walk', () => {
    let s = fresh({ seed: 8, background: 'line_cook' });
    s = randomWalk(s, 800, 11, (_p, _a, r) => {
      if (r.error) return;
      const st = r.state;
      assert.ok(Number.isInteger(st.creds), `creds not integer: ${st.creds}`);
      assert.ok(Number.isInteger(st.lease.amount), `lease not integer: ${st.lease.amount}`);
      for (const l of st.market?.listings ?? []) assert.ok(Number.isInteger(l.price), `listing price ${l.price}`);
      if (st.customer && st.customer.askPrice != null) assert.ok(Number.isInteger(st.customer.askPrice), `askPrice ${st.customer.askPrice}`);
      for (const e of r.events) if (typeof e.price === 'number') assert.ok(Number.isInteger(e.price), `${e.type}.price ${e.price}`);
    });
  });
});
