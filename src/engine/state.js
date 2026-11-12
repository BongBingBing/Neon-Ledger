// newGame + derived-value recalculation + day start (dawn) setup.
import { BACKGROUND, BACKGROUNDS, MACHINE, ITEM, FEED, CATEGORIES } from './content.js';
import { BAL } from './balance.js';
import { seedToRng, randInt, randRange, pick, chance } from './rng.js';
import { clamp, addFeed, fill, int } from './util.js';
import { makeItem, makeSerial, freeSlots, illegalTrue } from './items.js';
import { diff, add } from './modifiers.js';
import { computeAudit } from './audit.js';
import { assignShardContent } from './customers.js';

export const SAVE_VERSION = 1;
export const ENGINE_VERSION = '1.0.0';

export function recalc(st) {
  const bg = BACKGROUND[st.background] || {};
  const bcap = bg.capacity || {};
  const cap = BAL.capacity;
  const shelf = clamp(cap.shelf + add(st, 'shelf'), 0, cap.shelfMax);
  const storage = clamp(cap.storage + add(st, 'storage'), 0, cap.storageMax);
  let stash = clamp(cap.stash + add(st, 'stash'), 0, cap.stashMax);
  st.capacity = {
    shelf: Math.max(shelf, bcap.shelf || 0),
    storage: Math.max(storage, bcap.storage || 0),
    stash: Math.max(stash, bcap.stash || 0),
  };
  // appeal
  const shelfItems = st.inventory.filter((i) => i.location === 'shelf');
  const variety = new Set(shelfItems.map((i) => ITEM[i.itemId] && ITEM[i.itemId].category)).size;
  st.appeal = clamp(Math.round(10 + add(st, 'appeal') + Math.min(15, variety * 3) + (st.rep.sump || 0) / 5), 0, 100);
  return st;
}

function sanitizeName(s) {
  const n = String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
  return n || 'The Stall';
}

export function newGame(opts = {}) {
  opts = opts || {};
  const seed = Number.isFinite(Number(opts.seed)) ? (Number(opts.seed) >>> 0) : ((Date.now() ^ 0x5bd1e995) >>> 0);
  const background = BACKGROUND[opts.background] ? opts.background : (BACKGROUND.tinker ? 'tinker' : (BACKGROUNDS[0] && BACKGROUNDS[0].id) || 'nobody');
  const difficulty = ['drizzle', 'acid', 'downpour'].includes(opts.difficulty) ? opts.difficulty : 'acid';
  const bg = BACKGROUND[background] || { creds: BAL.startCreds, machines: [], rep: {}, startInventory: [] };
  const st = {
    saveVersion: SAVE_VERSION,
    engineVersion: ENGINE_VERSION,
    seed,
    rng: seedToRng(seed),
    day: 1,
    phase: 'dawn',
    difficulty,
    background,
    shopName: sanitizeName(opts.shopName),
    creds: int(bg.creds ?? BAL.startCreds),
    lease: { amount: 0, nextDueDay: BAL.lease.period, graceActive: false, missedCount: 0, overdue: 0, prepaid: false, owned: false },
    deedPrice: 0,
    heat: 0,
    auditPending: false,
    audit: null,
    rep: { vantage: 0, lantern: 0, static: 0, sump: 0 },
    appeal: 10,
    capacity: { ...BAL.capacity },
    inventory: [],
    machines: {},
    upgrades: [],
    permits: [],
    licences: [],
    perks: [],
    perkPoints: 0,
    market: { day: 0, listings: [], demand: {} },
    queue: [],
    customer: null,
    inspection: null,
    events: { active: [], forecast: [], pending: [] },
    duesPaidTonight: false,
    duesSkippedTonight: false,
    duesSkipStreak: 0,
    nightJobDone: false,
    nightJobsCount: 0,
    favorsUsed: [],
    feed: [],
    hotList: [],
    hotPool: [],
    hotPoolUsed: [],
    stats: {
      customersServed: 0, bestSale: 0, ghostChitsCaught: 0, auditsSurvived: 0, totalEarned: 0, totalSpent: 0,
      itemsSold: 0, itemsBought: 0, reports: 0, breakIns: 0, daysSurvived: 0, history: [],
    },
    dayLog: { day: 1, income: 0, expenses: 0, lines: [] },
    ending: null,
    endless: false,
    pending: { chits: [], returns: [], poison: [], repay: [] },
    flags: { underwaterDays: 0, injuredDay: 0, tipoffUntil: 0 },
    counters: { uid: 1, customer: 1, inspection: 1 },
  };
  const d = diff(st);
  st.lease.amount = int(d.leaseBase || BAL.lease.base);
  st.deedPrice = int(d.deedPrice || BAL.deedPrice);
  for (const [f, v] of Object.entries(bg.rep || {})) if (f in st.rep) st.rep[f] = clamp(int(v), -100, 100);
  for (const m of bg.machines || []) if (MACHINE[m]) st.machines[m] = { owned: true, broken: false, job: null };
  for (const c of CATEGORIES) st.market.demand[c] = 1;
  recalc(st);
  for (const s of bg.startInventory || []) {
    const qty = Math.max(1, int(s.qty || 1));
    for (let k = 0; k < qty; k++) {
      let loc = s.location || 'storage';
      if (freeSlots(st, loc) <= 0) loc = ['storage', 'shelf', 'stash'].find((l) => freeSlots(st, l) > 0);
      if (!loc) break;
      const flags = { ...(s.flags || {}) };
      const def = ITEM[s.itemId];
      if (def.category === 'stolen_goods') flags.stolen = true;
      if (def.tracer) flags.tracer = true;
      const it = makeItem(st, s.itemId, { location: loc, condition: s.condition ?? randInt(st, 75, 100), quality: s.quality || 'B', flags, boughtFor: 0 });
      if (def.category === 'shard' && def.tags.includes('unknown')) { assignShardContent(st, it, 'sump'); it.known = { condition: it.condition, conditionExact: true }; }
      if (flags.untested) { it.known = { condition: clamp(it.condition + randInt(st, 0, 20), 0, 100), untested: true }; }
      st.inventory.push(it);
    }
  }
  recalc(st);
  addFeed(st, 'system', bg.intro || `Welcome to ${st.shopName}.`);
  beginDay(st, []);
  return st;
}

// Dawn setup for st.day (called on day 1 and after each SLEEP / CONTINUE_ENDLESS).
export function beginDay(st, out) {
  st.phase = 'dawn';
  st.dayLog = { day: st.day, income: 0, expenses: 0, lines: [] };
  st.customer = null;
  st.queue = [];
  st.inspection = null;
  st.duesPaidTonight = false;
  st.duesSkippedTonight = false;
  st.nightJobDone = false;
  st.nightJobsCount = 0;
  st.favorsUsed = [];
  // demand random walk
  for (const c of Object.keys(st.market.demand)) {
    const v = st.market.demand[c] * randRange(st, 0.92, 1.08);
    st.market.demand[c] = Math.round(clamp(v * 0.85 + 0.15, 0.75, 1.3) * 1000) / 1000;
  }
  // hot list: some serials of stolen items you hold get reported, plus a pool for today's sellers
  const hot = [];
  for (const it of st.inventory) if (it.flags.stolen && it.serial && !st.hotList.includes(it.serial) && chance(st, BAL.hotListAddChance)) hot.push(it.serial);
  for (const it of st.inventory) if (it.flags.stolen && it.serial && st.hotList.includes(it.serial) && chance(st, 0.7)) hot.push(it.serial);
  st.hotPool = [];
  const nPool = randInt(st, 2, 4);
  for (let i = 0; i < nPool; i++) st.hotPool.push(makeSerial(st));
  st.hotPoolUsed = [];
  st.hotList = [...new Set([...hot, ...st.hotPool])];
  // feed
  if (!st.lease.owned) {
    const days = st.lease.nextDueDay - st.day;
    const L = FEED.leasehold || {};
    const amt = st.lease.graceActive ? st.lease.overdue + st.lease.amount : st.lease.prepaid ? 0 : st.lease.amount;
    if (st.lease.graceActive) addFeed(st, 'lease', fill(pickText(st, L.grace) || 'Overdue: {amount}¢ :(', { amount: amt, days }), 'LEASEHOLD');
    else if (st.lease.prepaid) addFeed(st, 'lease', `Rent for day ${st.lease.nextDueDay} is already paid. Thank you :)`, 'LEASEHOLD');
    else if (days <= 0) addFeed(st, 'lease', fill(pickText(st, L.dueToday) || 'Rent of {amount}¢ is due tonight :)', { amount: amt, days }), 'LEASEHOLD');
    else addFeed(st, 'lease', fill(pickText(st, L.countdown) || 'Rent of {amount}¢ due in {days} day(s) :)', { amount: amt, days }), 'LEASEHOLD');
  }
  addFeed(st, 'hotlist', fill(pickText(st, FEED.hotlist) || 'Vantage hot list: {count} serials.', { count: st.hotList.length, serials: st.hotList.join(', ') }));
  const news = pickText(st, FEED.news);
  if (news) addFeed(st, 'news', news);
  if (st.auditPending) {
    addFeed(st, 'warning', pickText(st, FEED.audit) || 'Inspector Halloran is coming this morning. Stash anything you would rather he not see.');
    st.audit = computeAudit(st);
    out.push({ type: 'AUDIT_INCOMING', ...st.audit, found: st.audit.found.map((i) => i.uid), text: 'Inspector Halloran is on his way.' });
  } else st.audit = null;
  if (st.flags.injuredDay === st.day) addFeed(st, 'system', 'Your injury slows you down today: one fewer customer.');
  recalc(st);
}

export function pickText(st, pool) {
  if (!pool) return '';
  if (typeof pool === 'string') return pool;
  if (Array.isArray(pool) && pool.length) {
    const p = pick(st, pool);
    return typeof p === 'string' ? p : (p && p.text) || '';
  }
  return '';
}

export { illegalTrue };
