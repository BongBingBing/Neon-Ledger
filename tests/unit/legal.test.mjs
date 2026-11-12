// legalActions accuracy: every listed action succeeds; unlisted action types fail.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { engine, SKIP_ENGINE, fresh, legal, completeAction, mulberry, backgroundIds } from './_helpers.mjs';

const skip = SKIP_ENGINE;

const ALL_TYPES = ['MOVE_ITEM', 'AUDIT_RESPOND', 'OPEN_SHOP', 'NEXT_CUSTOMER', 'SELECT_ITEM', 'OFFER', 'DEAL',
  'ACCEPT_CHIT', 'REJECT_CHIT', 'INSPECT', 'INSPECT_INPUT', 'INSPECT_END', 'REFUSE', 'REPORT', 'SPECIAL_CHOICE',
  'CLOSE_SHOP', 'BUY_STOCK', 'SELL_TO_MARKET', 'RUN_MACHINE', 'COLLECT_MACHINE', 'BUY_MACHINE', 'BUY_UPGRADE',
  'BUY_PERMIT', 'BUY_LICENCE', 'PAY_DUES', 'SKIP_DUES', 'NIGHT_JOB', 'CONTACT_FAVOR', 'PAY_LEASE', 'CHOOSE_PERK',
  'SLEEP', 'CONTINUE_ENDLESS', 'BUY_DEED'];

// Minimal plausible params for an unlisted type so we test the rule, not param validation.
function probeAction(s, type) {
  const anyUid = s.inventory[0]?.uid ?? 'x';
  const p = { MOVE_ITEM: { uid: anyUid, to: 'shelf' }, AUDIT_RESPOND: { choice: 'comply' }, SELECT_ITEM: { uid: anyUid },
    OFFER: { price: 50 }, INSPECT: { tool: 'serial', target: anyUid }, INSPECT_INPUT: { input: { cell: 0 } },
    SPECIAL_CHOICE: { optionId: 'x' }, BUY_STOCK: { listingIndex: 0, qty: 1 }, SELL_TO_MARKET: { uid: anyUid },
    RUN_MACHINE: { machineId: 'x', recipeId: 'y', inputUids: [] }, COLLECT_MACHINE: { machineId: 'x' },
    BUY_MACHINE: { id: 'x' }, BUY_UPGRADE: { id: 'x' }, BUY_PERMIT: { id: 'x' }, BUY_LICENCE: { id: 'x' },
    NIGHT_JOB: { jobId: 'x' }, CONTACT_FAVOR: { npcId: 'x', favorId: 'y' }, CHOOSE_PERK: { perkId: 'x' } }[type] ?? {};
  return { type, ...p };
}

describe('legalActions accuracy', { skip }, () => {
  test('descriptors are well-formed', () => {
    const s = fresh();
    for (const d of legal(s)) {
      assert.equal(typeof d.type, 'string');
      assert.ok(ALL_TYPES.includes(d.type), `unknown action type ${d.type}`);
    }
  });

  for (const bg of backgroundIds()) {
    test(`AC-ENG-111 AC-ENG-112 every listed action succeeds; unlisted types fail (${bg}, 6 walks)`, () => {
      const failures = [];
      const falseNeg = [];
      for (let w = 0; w < 6; w++) {
        let s = engine.newGame({ seed: 1000 + w, background: bg, difficulty: ['drizzle', 'acid', 'downpour'][w % 3], shopName: 'L' });
        const rnd = mulberry(w + 17);
        for (let i = 0; i < 300 && s.phase !== 'ended'; i++) {
          const opts = legal(s);
          assert.ok(opts.length > 0, `no legal actions in phase ${s.phase} day ${s.day}`);
          // check every listed action (bounded) succeeds
          for (const d of opts.slice(0, 40)) {
            const a = completeAction(s, d, rnd);
            if (!a) continue;
            const r = engine.step(s, a);
            if (r.error) failures.push(`${s.phase} d${s.day}: ${JSON.stringify(a)} -> ${r.error}`);
          }
          // a sample of unlisted types must fail
          const listed = new Set(opts.map((o) => o.type));
          const unlisted = ALL_TYPES.filter((t) => !listed.has(t));
          for (let k = 0; k < 3 && unlisted.length; k++) {
            const t = unlisted[Math.floor(rnd() * unlisted.length)];
            if (t === 'CHOOSE_PERK' || t === 'MOVE_ITEM' || t === 'INSPECT') continue; // param-dependent, checked elsewhere
            const r = engine.step(s, probeAction(s, t));
            if (!r.error) falseNeg.push(`${s.phase} d${s.day}: unlisted ${t} succeeded`);
          }
          // advance
          const prog = opts.filter((o) => ['NEXT_CUSTOMER', 'OPEN_SHOP', 'CLOSE_SHOP', 'SLEEP', 'DEAL', 'ACCEPT_CHIT', 'AUDIT_RESPOND', 'PAY_DUES'].includes(o.type));
          const pool = prog.length && rnd() < 0.4 ? prog : opts;
          const a = completeAction(s, pool[Math.floor(rnd() * pool.length)], rnd);
          if (!a) continue;
          const r = engine.step(s, a);
          if (!r.error) s = r.state;
        }
      }
      assert.deepEqual(failures.slice(0, 10), [], `${failures.length} listed actions failed`);
      assert.deepEqual(falseNeg.slice(0, 10), [], `${falseNeg.length} unlisted actions succeeded`);
    });
  }

  test('AC-ENG-418 ended (loss) state lists no actions except possibly none; CONTINUE_ENDLESS only on win', () => {
    const s = fresh();
    s.phase = 'ended';
    s.ending = { id: 'evicted', title: 'Evicted', text: '', win: false, stats: {} };
    assert.ok(!legal(s).some((a) => a.type === 'CONTINUE_ENDLESS'));
    assert.ok(engine.step(s, { type: 'CONTINUE_ENDLESS' }).error);
    assert.ok(engine.step(s, { type: 'SLEEP' }).error);
  });

  test('AC-ENG-112 AC-ENG-174 OPEN_SHOP not listed and fails while audit unresolved (R3)', () => {
    const s = fresh();
    s.audit = { found: [], fine: 0, bribeCost: 0, bribeChance: 0.5 };
    s.auditPending = true;
    assert.ok(!legal(s).some((a) => a.type === 'OPEN_SHOP'));
    assert.ok(engine.step(s, { type: 'OPEN_SHOP' }).error);
  });

  test('AC-ENG-417 BUY_DEED listed iff creds >= deedPrice (R1)', () => {
    const s = fresh();
    s.creds = s.deedPrice - 1;
    assert.ok(!legal(s).some((a) => a.type === 'BUY_DEED'));
    assert.ok(engine.step(s, { type: 'BUY_DEED' }).error);
    s.creds = s.deedPrice;
    assert.ok(legal(s).some((a) => a.type === 'BUY_DEED'));
  });

  test('AC-ENG-412 CHOOSE_PERK only listed with perkPoints > 0', () => {
    const s = fresh();
    s.perkPoints = 0;
    assert.ok(!legal(s).some((a) => a.type === 'CHOOSE_PERK'));
    s.perkPoints = 1;
    const perks = legal(s).filter((a) => a.type === 'CHOOSE_PERK');
    assert.ok(perks.length > 0, 'perk choices listed when perkPoints>0');
    for (const p of perks) assert.ok(!engine.step(s, p).error);
  });
});
