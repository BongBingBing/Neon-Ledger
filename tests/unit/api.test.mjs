// Public API shape & newGame initial state (ARCHITECTURE §3.1, §3.2, DESIGN §10, §13, R1, R8).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { engine, SKIP_ENGINE, fresh, backgroundIds, DIFFICULTIES } from './_helpers.mjs';

const skip = SKIP_ENGINE;

describe('engine public API', { skip }, () => {
  test('AC-ENG-101 exports versions and functions', () => {
    assert.equal(typeof engine.ENGINE_VERSION, 'string');
    assert.equal(engine.SAVE_VERSION, 1);
    for (const fn of ['newGame', 'step', 'legalActions', 'serialize', 'deserialize']) {
      assert.equal(typeof engine[fn], 'function', `missing export ${fn}`);
    }
    assert.equal(typeof engine.selectors, 'object');
    for (const sel of ['netWorth', 'stockValue', 'daysUntilLease', 'leaseAmount', 'shelfItems', 'storageItems',
      'stashItems', 'freeSlots', 'customerCountToday', 'currentCustomer', 'duesQuote', 'marketListings',
      'availableUpgrades', 'availableMachines', 'itemDef', 'isIllegal', 'appraiseHint', 'repTier']) {
      assert.equal(typeof engine.selectors[sel], 'function', `missing selector ${sel}`);
    }
  });

  test('AC-ENG-103 newGame returns contract top-level keys with initial values', () => {
    const s = fresh();
    const keys = ['saveVersion', 'seed', 'rng', 'day', 'phase', 'difficulty', 'background', 'shopName', 'creds',
      'lease', 'deedPrice', 'heat', 'auditPending', 'audit', 'rep', 'appeal', 'capacity', 'inventory', 'machines',
      'permits', 'licences', 'perks', 'perkPoints', 'market', 'queue', 'customer', 'inspection', 'events',
      'duesPaidTonight', 'duesSkipStreak', 'nightJobDone', 'feed', 'hotList', 'stats', 'dayLog', 'ending'];
    for (const k of keys) assert.ok(k in s, `state missing key ${k}`);
    assert.equal(s.saveVersion, 1);
    assert.equal(s.day, 1);
    assert.equal(s.phase, 'dawn');
    assert.equal(s.shopName, 'Test Stall');
    assert.equal(s.heat, 0);
    assert.equal(s.auditPending, false);
    assert.equal(s.audit, null);
    assert.equal(s.customer, null);
    assert.equal(s.inspection, null);
    assert.equal(s.ending, null);
    assert.deepEqual(Object.keys(s.rep).sort(), ['lantern', 'static', 'sump', 'vantage']);
    assert.equal(s.capacity.shelf, 6);
    assert.equal(s.capacity.storage, 10);
    assert.equal(s.lease.nextDueDay, 7);
    assert.equal(s.lease.graceActive, false);
    assert.equal(s.lease.missedCount, 0);
    assert.ok(Number.isInteger(s.rng) && s.rng >= 0 && s.rng <= 0xffffffff, 'rng is uint32');
    assert.ok(Array.isArray(s.inventory) && Array.isArray(s.feed) && Array.isArray(s.hotList));
    assert.ok(Number.isInteger(s.creds));
  });

  test('AC-ENG-105 AC-ENG-416 every background x difficulty creates a valid game', () => {
    for (const background of backgroundIds()) {
      for (const difficulty of DIFFICULTIES) {
        const s = engine.newGame({ seed: 7, background, difficulty, shopName: 'X' });
        assert.equal(s.background, background);
        assert.equal(s.difficulty, difficulty);
        assert.equal(s.phase, 'dawn');
        assert.ok(engine.legalActions(s).length > 0, `${background}/${difficulty} has no legal actions`);
        const uids = s.inventory.map((i) => i.uid);
        assert.equal(new Set(uids).size, uids.length, 'inventory uids unique');
      }
    }
  });

  test('AC-ENG-103 AC-ENG-222 starting creds per background (DESIGN §10)', () => {
    const expected = { tinker: 400, shard_diver: 400, sparky: 450, line_cook: 450, fence: 350, nobody: 60 };
    for (const [bg, creds] of Object.entries(expected)) {
      const s = fresh({ background: bg });
      assert.equal(s.creds, creds, `${bg} start creds`);
    }
  });

  test('AC-ENG-222 AC-ENG-416 background kits (DESIGN §10)', () => {
    const kit = { tinker: /repair|bench/, shard_diver: /scanner|shard/, sparky: /charger|cell/, line_cook: /vat|cook/ };
    for (const [bg, re] of Object.entries(kit)) {
      const s = fresh({ background: bg });
      assert.ok(Object.keys(s.machines).some((m) => re.test(m) && s.machines[m].owned), `${bg} should own a matching machine, has ${Object.keys(s.machines)}`);
    }
    const fence = fresh({ background: 'fence' });
    assert.equal(fence.capacity.stash, 2);
    assert.equal(fence.rep.lantern, 15);
    assert.equal(fence.rep.vantage, -10);
    assert.equal(fresh({ background: 'shard_diver' }).rep.static, 5);
    assert.equal(fresh({ background: 'line_cook' }).rep.sump, 10);
    assert.equal(fresh({ background: 'tinker' }).capacity.stash, 0);
  });

  test('AC-ENG-416 deed price per difficulty (DESIGN §13)', () => {
    assert.equal(fresh({ difficulty: 'drizzle' }).deedPrice, 24000);
    assert.equal(fresh({ difficulty: 'acid' }).deedPrice, 30000);
    assert.equal(fresh({ difficulty: 'downpour' }).deedPrice, 37500);
  });

  test('AC-ENG-103 AC-ENG-196 lease starts at base 350 on Normal', () => {
    const s = fresh();
    assert.equal(s.lease.amount, 350);
    assert.equal(engine.selectors.leaseAmount(s), 350);
    assert.equal(engine.selectors.daysUntilLease(s), 6);
  });

  test('AC-ENG-133 AC-ENG-200 selectors are pure and return sane types on a fresh game', () => {
    const s = fresh();
    const before = JSON.stringify(s);
    const sel = engine.selectors;
    assert.ok(Number.isInteger(sel.netWorth(s)));
    assert.ok(Number.isInteger(sel.stockValue(s)));
    assert.ok(Array.isArray(sel.shelfItems(s)));
    assert.ok(Array.isArray(sel.storageItems(s)));
    assert.ok(Array.isArray(sel.stashItems(s)));
    assert.ok(Number.isInteger(sel.freeSlots(s, 'shelf')));
    assert.ok(Number.isInteger(sel.duesQuote(s)) && sel.duesQuote(s) >= 15, 'dues min 15');
    assert.equal(sel.currentCustomer(s), null);
    for (const f of ['vantage', 'lantern', 'static', 'sump']) {
      assert.ok(['hated', 'disliked', 'neutral', 'liked', 'trusted'].includes(sel.repTier(s, f)));
    }
    assert.equal(JSON.stringify(s), before, 'selectors mutated state');
  });

  test('AC-ENG-408 repTier ordering', () => {
    const s = fresh();
    const order = ['hated', 'disliked', 'neutral', 'liked', 'trusted'];
    let prev = -1;
    for (const v of [-100, -50, 0, 50, 100]) {
      s.rep.vantage = v;
      const idx = order.indexOf(engine.selectors.repTier(s, 'vantage'));
      assert.ok(idx >= prev, `repTier not monotone at ${v}`);
      prev = idx;
    }
    s.rep.vantage = -100; assert.equal(engine.selectors.repTier(s, 'vantage'), 'hated');
    s.rep.vantage = 100; assert.equal(engine.selectors.repTier(s, 'vantage'), 'trusted');
    s.rep.vantage = 0; assert.equal(engine.selectors.repTier(s, 'vantage'), 'neutral');
  });

  test('AC-ENG-132 freeSlots matches capacity minus occupancy', () => {
    const s = fresh();
    for (const loc of ['shelf', 'storage', 'stash']) {
      const used = s.inventory.filter((i) => i.location === loc).length;
      assert.equal(engine.selectors.freeSlots(s, loc), s.capacity[loc] - used, loc);
    }
  });
});
