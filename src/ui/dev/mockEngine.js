// TEMPORARY mock of the engine contract (ARCHITECTURE §3) so the UI can be built before
// src/engine/index.js exists. Not game-accurate. Used only when the real engine fails to load.

export const ENGINE_VERSION = 'mock-0.1';
export const SAVE_VERSION = 1;

const ITEMS = {
  power_cell: { id: 'power_cell', name: 'Power Cell', category: 'power', basePrice: 40, legality: 'legal' },
  noodle_cup: { id: 'noodle_cup', name: 'Vat Noodles', category: 'food', basePrice: 12, legality: 'legal', perishableDays: 2 },
  scrap_coil: { id: 'scrap_coil', name: 'Scrap Coil', category: 'salvage', basePrice: 18, legality: 'legal' },
  hot_watch: { id: 'hot_watch', name: 'Lifted Wristdeck', category: 'stolen_goods', basePrice: 160, legality: 'contraband' },
  chrome_arm: { id: 'chrome_arm', name: 'Used Grip Servo', category: 'chrome', basePrice: 220, legality: 'permit' },
  shard_x: { id: 'shard_x', name: 'Unlabelled Shard', category: 'shard', basePrice: 60, legality: 'legal' },
  silk_scarf: { id: 'silk_scarf', name: 'Aurelle Scarf', category: 'luxury', basePrice: 300, legality: 'legal', brand: 'aurelle' },
  rad_lamp: { id: 'rad_lamp', name: 'Glow Lamp', category: 'tech', basePrice: 55, legality: 'legal' },
  tape_roll: { id: 'tape_roll', name: 'Duct Tape', category: 'sundry', basePrice: 8, legality: 'legal' },
};
const FACTIONS = ['vantage', 'lantern', 'static', 'sump', 'spire', 'none'];
const NAMES = ['Kesh Varo', 'Ilsa Mott', 'Benno Quill', 'Rue Tanaka', 'Odile Fenn', 'Marek Sol', 'Tavi Rhee', 'Juno Crake'];

function rnd(s) { s.rng = (Math.imul(s.rng ^ (s.rng >>> 15), 2246822519) + 0x6d2b79f5) >>> 0; return s.rng / 4294967296; }
function ri(s, a, b) { return a + Math.floor(rnd(s) * (b - a + 1)); }
function pick(s, arr) { return arr[Math.floor(rnd(s) * arr.length)]; }
let uidc = 1;
function mkItem(s, itemId, location) {
  const def = ITEMS[itemId];
  const it = { uid: 'u' + (s.nextUid++), itemId, location, condition: ri(s, 40, 100), quality: pick(s, ['A', 'B', 'C']), flags: {}, known: {}, boughtFor: def.basePrice, acquiredDay: s.day };
  if (def.category === 'stolen_goods') { it.serial = 'SN-' + ri(s, 1000, 9999); it.flags.stolen = true; it.known.stolen = true; }
  if (def.perishableDays) it.spoilsDay = s.day + def.perishableDays;
  if (def.category === 'chrome') { it.flags.untested = true; it.known.untested = true; }
  return it;
}

export function newGame(opts = {}) {
  const s = {
    saveVersion: 1, seed: opts.seed ?? 1234, rng: (opts.seed ?? 1234) >>> 0, nextUid: 1,
    day: 1, phase: 'dawn', difficulty: opts.difficulty ?? 'acid', background: opts.background ?? 'fence', shopName: opts.shopName || 'The Stall',
    creds: 400, lease: { amount: 350, nextDueDay: 7, graceActive: false, missedCount: 0 }, deedPrice: 30000,
    heat: 12, auditPending: false, audit: null,
    rep: { vantage: -10, lantern: 15, static: 0, sump: 5 }, appeal: 10,
    capacity: { shelf: 6, storage: 10, stash: 2 }, inventory: [],
    machines: { vat_cooker: { owned: true, broken: false, job: null } }, permits: [], licences: [], perks: [], perkPoints: 0,
    market: { day: 1, listings: [] }, queue: [], customer: null, inspection: null,
    events: { active: [], forecast: [{ id: 'blackout', startDay: 3, certainty: 0.7 }] },
    duesPaidTonight: false, duesSkipStreak: 0, nightJobDone: false, feed: [], hotList: [],
    stats: { customersServed: 0, bestSale: 0, ghostChitsCaught: 0, auditsSurvived: 0, totalEarned: 0, totalSpent: 0 },
    dayLog: { income: 0, expenses: 0, lines: [] }, ending: null,
  };
  for (const id of ['power_cell', 'power_cell', 'noodle_cup', 'scrap_coil', 'hot_watch', 'rad_lamp']) s.inventory.push(mkItem(s, id, 'shelf'));
  for (const id of ['chrome_arm', 'tape_roll', 'silk_scarf']) s.inventory.push(mkItem(s, id, 'storage'));
  s.hotList = ['SN-' + ri(s, 1000, 9999), s.inventory[4].serial, 'SN-4410'];
  dawnFeed(s);
  rollMarket(s);
  return s;
}

function dawnFeed(s) {
  s.feed.push({ day: s.day, kind: 'lease', from: 'LEASEHOLD', text: `Good morning! :) Your lease of ${s.lease.amount}¢ is due in ${s.lease.nextDueDay - s.day} days. Have a productive day!` });
  s.feed.push({ day: s.day, kind: 'news', from: 'SumpWire', text: 'Grid instability reported on levels 3–9. Cell prices expected to climb.' });
  s.feed.push({ day: s.day, kind: 'msg', from: 'Mama Ostra', text: 'Saw a Vantage drone circling your stair. Keep the back room tidy, hon.' });
  s.feed.push({ day: s.day, kind: 'hotlist', from: 'Vantage Bulletin', text: 'Wanted serials: ' + s.hotList.join(', ') });
  if (s.auditPending) s.feed.push({ day: s.day, kind: 'warning', from: 'Vantage Security', text: 'Inspector Halloran will audit your premises this morning.' });
}

function rollMarket(s) {
  s.market = { day: s.day, listings: Object.values(ITEMS).slice(0, 7).map((d) => ({ itemId: d.id, price: Math.round(d.basePrice * (0.5 + rnd(s) * 0.3)), qty: ri(s, 1, 5), flags: d.category === 'stolen_goods' ? { stolen: true } : {} })) };
}

function mkCustomer(s) {
  const kind = rnd(s) < 0.55 ? 'buyer' : 'seller';
  const faction = pick(s, FACTIONS);
  const c = {
    id: 'c' + ri(s, 1, 1e6), kind, name: pick(s, NAMES), faction, homeWard: 'W-' + ri(s, 1, 9),
    portrait: { seed: ri(s, 1, 1e9), traits: { faction, vantageBoots: rnd(s) < 0.15 } },
    dialogue: { greet: kind === 'buyer' ? 'Need something to keep the lights on. What you got?' : 'Found this in a drain. Clean, mostly. Interested?' },
    askPrice: 0, patience: 4, patienceMax: 4, mood: 'neutral', visibleTells: [], hidden: { reservation: 0 },
  };
  if (kind === 'buyer') {
    c.wants = { category: pick(s, ['power', 'food', 'salvage', 'tech', 'stolen_goods']) };
    c.hidden.reservation = 0;
    if (rnd(s) < 0.5) c.chit = { name: rnd(s) < 0.5 ? c.name : c.name.replace(/a/, 'e'), ward: rnd(s) < 0.7 ? c.homeWard : 'W-0', sigilGlitch: rnd(s) < 0.3, expiryDay: s.day + ri(s, -2, 30) };
  } else {
    const it = mkItem(s, pick(s, Object.keys(ITEMS)), 'counter');
    c.item = it; c.askPrice = Math.round(ITEMS[it.itemId].basePrice * 0.8 / 5) * 5; c.hidden.reservation = Math.round(c.askPrice * 0.7);
  }
  return c;
}

const lane = (s) => s.inventory;
function log(s, label, amount) { s.dayLog.lines.push({ label, amount }); if (amount > 0) s.dayLog.income += amount; else s.dayLog.expenses -= amount; }

export function legalActions(s) {
  const a = [];
  const inv = s.inventory;
  const moves = (ph) => { for (const it of inv) for (const to of ['shelf', 'storage', 'stash']) if (to !== it.location && selectors.freeSlots(s, to) > 0) a.push({ type: 'MOVE_ITEM', uid: it.uid, to }); };
  if (s.phase === 'dawn') {
    moves();
    if (s.audit) { a.push({ type: 'AUDIT_RESPOND', choice: 'comply' }, { type: 'AUDIT_RESPOND', choice: 'bribe' }); }
    else a.push({ type: 'OPEN_SHOP' });
    a.push({ type: 'PAY_LEASE' });
    if (s.creds >= s.deedPrice) a.push({ type: 'BUY_DEED' });
  } else if (s.phase === 'open') {
    const c = s.customer;
    if (s.inspection) { a.push({ type: 'INSPECT_INPUT' }, { type: 'INSPECT_END' }); return a; }
    if (!c) { if (s.queue.length) a.push({ type: 'NEXT_CUSTOMER' }); a.push({ type: 'CLOSE_SHOP' }); return a; }
    if (c.awaitingChit) { a.push({ type: 'ACCEPT_CHIT' }, { type: 'REJECT_CHIT' }, { type: 'REPORT' }); return a; }
    if (c.kind === 'buyer') for (const it of inv.filter((i) => i.location === 'shelf')) a.push({ type: 'SELECT_ITEM', uid: it.uid });
    if (c.kind === 'seller' || c.selectedUid) { a.push({ type: 'OFFER' }, { type: 'DEAL' }); }
    if (c.kind === 'seller' && ITEMS[c.item.itemId].category === 'chrome') a.push({ type: 'INSPECT', tool: 'probe', target: 'customer' });
    if (c.kind === 'seller' && ITEMS[c.item.itemId].brand) a.push({ type: 'INSPECT', tool: 'appraise', target: 'customer' });
    if (c.kind === 'seller' && c.item.serial) a.push({ type: 'INSPECT', tool: 'serial', target: 'customer' });
    a.push({ type: 'REFUSE' }, { type: 'REPORT' }, { type: 'CLOSE_SHOP' });
  } else if (s.phase === 'night') {
    moves();
    s.market.listings.forEach((l, i) => { if (l.qty > 0 && l.price <= s.creds) a.push({ type: 'BUY_STOCK', listingIndex: i, qty: 1 }); });
    for (const it of inv) a.push({ type: 'SELL_TO_MARKET', uid: it.uid });
    if (!s.duesPaidTonight) a.push({ type: 'PAY_DUES' }, { type: 'SKIP_DUES' });
    if (!s.nightJobDone) for (const j of ['drain_dive', 'help_ostra']) a.push({ type: 'NIGHT_JOB', jobId: j });
    a.push({ type: 'BUY_UPGRADE', id: 'shelf_plus' }, { type: 'BUY_MACHINE', id: 'cell_charger' });
    a.push({ type: 'RUN_MACHINE', machineId: 'vat_cooker', recipeId: 'noodles', inputUids: [] });
    a.push({ type: 'PAY_LEASE' }, { type: 'SLEEP' });
    if (s.creds >= s.deedPrice) a.push({ type: 'BUY_DEED' });
  } else if (s.phase === 'ended') { if (s.ending?.win) a.push({ type: 'CONTINUE_ENDLESS' }); }
  return a;
}

export function step(state, action) {
  const s = structuredClone(state);
  const ev = [];
  const err = (e) => ({ state, events: [], error: e });
  const c = s.customer;
  switch (action.type) {
    case 'MOVE_ITEM': {
      const it = s.inventory.find((i) => i.uid === action.uid);
      if (!it || selectors.freeSlots(s, action.to) <= 0) return err('no_space');
      it.location = action.to; ev.push({ type: 'ITEM_MOVED', uid: it.uid, to: action.to });
      if (s.audit) s.audit = auditPreview(s);
      break;
    }
    case 'AUDIT_RESPOND': {
      if (!s.audit) return err('no_audit');
      const ids = new Set(s.audit.found.map((f) => f.uid));
      s.inventory = s.inventory.filter((i) => !ids.has(i.uid));
      s.creds -= s.audit.fine; log(s, 'Audit fine', -s.audit.fine);
      ev.push({ type: 'AUDIT', fine: s.audit.fine, confiscated: [...ids], text: `Halloran confiscated ${ids.size} item(s). Fine: ${s.audit.fine}¢.` });
      s.audit = null; s.auditPending = false; s.heat = 20; s.stats.auditsSurvived++;
      break;
    }
    case 'OPEN_SHOP':
      if (s.audit) return err('audit_pending');
      s.phase = 'open'; s.queue = Array.from({ length: 6 }, () => mkCustomer(s)); ev.push({ type: 'SHOP_OPENED', count: 6 });
      break;
    case 'NEXT_CUSTOMER':
      if (!s.queue.length) return err('empty');
      s.customer = s.queue.shift(); ev.push({ type: 'CUSTOMER_ARRIVED', kind: s.customer.kind });
      break;
    case 'SELECT_ITEM': {
      const it = s.inventory.find((i) => i.uid === action.uid && i.location === 'shelf');
      if (!c || !it) return err('bad_item');
      c.selectedUid = it.uid; c.askPrice = Math.round(ITEMS[it.itemId].basePrice * 1.2 / 5) * 5; c.hidden.reservation = Math.round(ITEMS[it.itemId].basePrice * 1.4);
      c.dialogue.line = `Hm. ${ITEMS[it.itemId].name}? What are you asking?`;
      break;
    }
    case 'OFFER': {
      if (!c) return err('no_customer');
      const p = Math.round(action.price);
      const ok = c.kind === 'buyer' ? p <= c.hidden.reservation : p >= c.hidden.reservation;
      if (ok) { c.askPrice = p; c.agreed = true; c.mood = 'happy'; c.dialogue.line = `${p}¢. Deal.`; ev.push({ type: 'HAGGLE_ACCEPT', price: p }); }
      else {
        c.patience -= 1;
        if (c.patience <= 0) { ev.push({ type: 'HAGGLE_WALK', text: `${c.name} walks off muttering.` }, { type: 'CUSTOMER_LEFT', reason: 'walk' }); s.customer = null; break; }
        c.askPrice = Math.round((c.askPrice + (c.kind === 'buyer' ? -1 : 1) * 0 + p) / 2 / 5) * 5 + (c.kind === 'buyer' ? -5 : 5);
        c.mood = c.patience <= 1 ? 'angry' : 'annoyed'; c.dialogue.line = `No way. ${c.askPrice}¢, final-ish.`;
        ev.push({ type: 'HAGGLE_COUNTER', price: c.askPrice, mood: c.mood });
      }
      break;
    }
    case 'DEAL': {
      if (!c) return err('no_customer');
      if (c.kind === 'buyer') {
        if (!c.selectedUid) return err('no_item');
        if (c.chit) { c.awaitingChit = true; ev.push({ type: 'CHIT_PRESENTED' }); break; }
        finishSale(s, ev);
      } else {
        if (s.creds < c.askPrice) return err('no_creds');
        s.creds -= c.askPrice; const it = { ...c.item, location: selectors.freeSlots(s, 'storage') > 0 ? 'storage' : 'shelf', boughtFor: c.askPrice };
        s.inventory.push(it); log(s, 'Bought ' + ITEMS[it.itemId].name, -c.askPrice);
        ev.push({ type: 'PURCHASE', uid: it.uid, price: c.askPrice }); s.customer = null; s.stats.customersServed++;
      }
      break;
    }
    case 'ACCEPT_CHIT': finishSale(s, ev); break;
    case 'REJECT_CHIT':
      ev.push({ type: 'CUSTOMER_LEFT', reason: 'chit_refused', text: `${c.name} snatches the chit back and leaves.` }); s.customer = null; break;
    case 'INSPECT': {
      if (action.tool === 'serial') { const hot = s.hotList.includes(c.item.serial); c.item.known.hotListed = hot; ev.push({ type: 'SERIAL_CHECKED', hot, text: hot ? 'Serial matches the Hot List!' : 'Serial is clean.' }); break; }
      if (action.tool === 'probe') s.inspection = { id: 'i1', tool: 'probe', targetUid: 'customer', data: { size: 4 }, inputsLeft: 5, revealed: {}, hidden: { faults: [ri(s, 0, 15), ri(s, 0, 15)] } };
      if (action.tool === 'appraise') s.inspection = { id: 'i2', tool: 'appraise', targetUid: 'customer', data: { brand: 'aurelle', marks: ['AUR-7 crest', 'gold weft', 'tag 0311'] }, inputsLeft: 1, revealed: {}, hidden: {} };
      ev.push({ type: 'INSPECT_STARTED', tool: action.tool });
      break;
    }
    case 'INSPECT_INPUT': {
      const ins = s.inspection; if (!ins) return err('none');
      if (ins.tool === 'probe') { const cell = action.input.cell; if (ins.revealed[cell] || ins.inputsLeft <= 0) return err('used'); ins.revealed[cell] = ins.hidden.faults.includes(cell) ? 'fault' : 'ok'; ins.inputsLeft--; }
      else { ins.revealed.choice = action.input.mark; ins.inputsLeft = 0; ins.revealed.result = action.input.mark === 1 ? 'correct' : 'wrong'; }
      break;
    }
    case 'INSPECT_END': s.inspection = null; if (c?.item) { c.item.known.untested = false; c.item.known.conditionEstimate = c.item.condition; } ev.push({ type: 'INSPECT_DONE' }); break;
    case 'REFUSE': ev.push({ type: 'CUSTOMER_LEFT', reason: 'refused' }); s.customer = null; break;
    case 'REPORT': ev.push({ type: 'REPORTED', correct: false, text: 'Vantage found nothing. The stairwell noticed.' }, { type: 'REP_CHANGED', faction: 'sump', delta: -3 }); s.rep.sump -= 3; s.customer = null; break;
    case 'CLOSE_SHOP': s.phase = 'night'; s.queue = []; s.customer = null; rollMarket(s); ev.push({ type: 'SHOP_CLOSED' }); break;
    case 'BUY_STOCK': {
      const l = s.market.listings[action.listingIndex]; const q = action.qty || 1;
      if (!l || l.qty < q || s.creds < l.price * q) return err('no_creds');
      for (let i = 0; i < q; i++) { const it = mkItem(s, l.itemId, selectors.freeSlots(s, 'storage') > 0 ? 'storage' : 'shelf'); it.boughtFor = l.price; s.inventory.push(it); }
      l.qty -= q; s.creds -= l.price * q; log(s, 'Market: ' + ITEMS[l.itemId].name, -l.price * q); ev.push({ type: 'PURCHASE', price: l.price * q });
      break;
    }
    case 'SELL_TO_MARKET': {
      const it = s.inventory.find((i) => i.uid === action.uid); if (!it) return err('bad');
      const p = Math.round(ITEMS[it.itemId].basePrice * 0.4); s.creds += p; s.inventory = s.inventory.filter((i) => i !== it); log(s, 'Dumped ' + ITEMS[it.itemId].name, p); ev.push({ type: 'SALE', price: p });
      break;
    }
    case 'PAY_DUES': { const q = selectors.duesQuote(s); s.creds -= q; s.duesPaidTonight = true; s.duesSkipStreak = 0; log(s, 'Lantern dues', -q); ev.push({ type: 'DUES_PAID', amount: q }); break; }
    case 'SKIP_DUES': s.duesPaidTonight = true; s.duesSkipStreak++; ev.push({ type: 'DUES_SKIPPED', text: 'Rook shrugs. "Your call, friend."' }); break;
    case 'NIGHT_JOB': s.nightJobDone = true; s.creds += 30; log(s, 'Night job', 30); ev.push({ type: 'NIGHT_JOB_DONE', jobId: action.jobId, pay: 30, text: 'You come back damp and 30¢ richer.' }); break;
    case 'BUY_UPGRADE': case 'BUY_MACHINE': ev.push({ type: 'UPGRADE_BOUGHT', id: action.id, text: 'Installed.' }); break;
    case 'RUN_MACHINE': ev.push({ type: 'MACHINE_STARTED', machineId: action.machineId }); break;
    case 'PAY_LEASE': if (s.creds < s.lease.amount) return err('no_creds'); s.creds -= s.lease.amount; s.lease.nextDueDay += 7; ev.push({ type: 'LEASE_PAID', amount: s.lease.amount }); break;
    case 'BUY_DEED': s.creds -= s.deedPrice; s.phase = 'ended'; s.ending = { id: 'own_name', title: 'Your Own Name on the Door', text: 'The deed is yours.', win: true, stats: { ...s.stats } }; ev.push({ type: 'ENDING', id: 'own_name' }); break;
    case 'SLEEP': {
      const power = 12; s.creds -= power; log(s, 'Power bill', -power);
      ev.push({ type: 'DAY_SUMMARY', day: s.day, income: s.dayLog.income, expenses: s.dayLog.expenses, lines: s.dayLog.lines.slice() });
      if (!s.duesPaidTonight && rnd(s) < 0.4) ev.push({ type: 'BREAK_IN', stolen: [], text: 'Someone jimmied the shutter. Nothing taken this time.' });
      s.day++; s.phase = 'dawn'; s.duesPaidTonight = false; s.nightJobDone = false; s.dayLog = { income: 0, expenses: 0, lines: [] };
      s.heat = Math.max(0, s.heat + s.inventory.filter((i) => ITEMS[i.itemId].legality !== 'legal' && i.location === 'shelf').length * 2 - 5) + 15;
      if (s.heat >= 60 || s.day === 3) { s.auditPending = true; s.audit = auditPreview(s); }
      s.feed = []; dawnFeed(s);
      if (s.creds < -2000) { s.phase = 'ended'; s.ending = { id: 'underwater', title: 'Underwater', text: 'The debt closed over your head.', win: false, stats: s.stats }; ev.push({ type: 'ENDING', id: 'underwater' }); }
      break;
    }
    case 'CONTINUE_ENDLESS': s.phase = 'dawn'; s.ending = null; break;
    case 'CHOOSE_PERK': break;
    default: return err('unknown_action');
  }
  return { state: s, events: ev };
}

function finishSale(s, ev) {
  const c = s.customer; const it = s.inventory.find((i) => i.uid === c.selectedUid);
  s.inventory = s.inventory.filter((i) => i !== it); s.creds += c.askPrice; log(s, 'Sold ' + ITEMS[it.itemId].name, c.askPrice);
  s.stats.customersServed++; s.stats.bestSale = Math.max(s.stats.bestSale, c.askPrice);
  ev.push({ type: 'SALE', uid: it.uid, price: c.askPrice }); s.customer = null;
}

function auditPreview(s) {
  const found = s.inventory.filter((i) => i.location !== 'stash' && ITEMS[i.itemId].legality !== 'legal');
  const fine = Math.round(1.5 * found.reduce((a, i) => a + ITEMS[i.itemId].basePrice, 0));
  return { found, fine, bribeCost: Math.round(fine * 0.2 * (1 - s.rep.vantage / 200)), bribeChance: 0.5 + s.rep.vantage / 200 };
}

export function serialize(s) { return JSON.stringify(s); }
export function deserialize(str) { try { const s = JSON.parse(str); return s && s.saveVersion ? s : null; } catch { return null; } }

export const selectors = {
  netWorth: (s) => s.creds + selectors.stockValue(s),
  stockValue: (s) => s.inventory.reduce((a, i) => a + ITEMS[i.itemId].basePrice, 0),
  daysUntilLease: (s) => s.lease.nextDueDay - s.day,
  leaseAmount: (s) => s.lease.amount,
  shelfItems: (s) => s.inventory.filter((i) => i.location === 'shelf'),
  storageItems: (s) => s.inventory.filter((i) => i.location === 'storage'),
  stashItems: (s) => s.inventory.filter((i) => i.location === 'stash'),
  freeSlots: (s, loc) => s.capacity[loc] - s.inventory.filter((i) => i.location === loc).length,
  customerCountToday: (s) => s.queue.length + (s.customer ? 1 : 0),
  currentCustomer: (s) => s.customer,
  duesQuote: (s) => Math.max(15, Math.round(selectors.stockValue(s) * 0.05)),
  marketListings: (s) => s.market.listings,
  availableUpgrades: () => [{ id: 'shelf_plus', name: 'Extra Shelf', price: 200, desc: '+2 shelf slots' }],
  availableMachines: () => [{ id: 'cell_charger', name: 'Cell Charger', price: 300, desc: 'Charge power cells overnight.' }],
  itemDef: (id) => ITEMS[id],
  isIllegal: (s, it) => ITEMS[it.itemId].legality !== 'legal',
  appraiseHint: () => null,
  repTier: (s, f) => { const r = s.rep[f]; return r <= -60 ? 'hated' : r <= -20 ? 'disliked' : r < 20 ? 'neutral' : r < 60 ? 'liked' : 'trusted'; },
};
