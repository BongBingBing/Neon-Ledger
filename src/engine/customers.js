// Customer generation (queue built at OPEN_SHOP).
import { ITEMS, ITEM, NAMES, NPC, RAW_MODULES, CATEGORIES } from './content.js';
import { BAL } from './balance.js';
import { rand, randInt, randRange, pick, weighted, chance, subSeed, shuffle } from './rng.js';
import { clamp, snapUp, nextUid, line, int } from './util.js';
import { makeItem, itemValue, illegalTrue, demandMult } from './items.js';
import { activeEffects } from './events.js';
import { diff, perkAdd, perkFlag, add } from './modifiers.js';

export const FACTIONS = ['vantage', 'lantern', 'static', 'sump'];
const CAT_LABELS = (RAW_MODULES.ITEMS && RAW_MODULES.ITEMS.CATEGORY_LABELS) || {
  power: 'power cells', food: 'food', salvage: 'salvage', sundry: 'sundries', chrome: 'chrome', shard: 'data shards',
  luxury: 'luxury goods', tech: 'tech', stolen_goods: 'hot goods',
};
export function categoryLabel(cat) { return CAT_LABELS[cat] || cat; }

// ---- people ----------------------------------------------------------------
function pickFaction(st) {
  const fx = activeEffects(st);
  const w = { sump: 44, lantern: 18, static: 11, vantage: 8, spire: 9 * fx.spireMult, none: 10 };
  return weighted(st, Object.keys(w), (k) => w[k]);
}
function wardsFor(faction) { return NAMES.wards.filter((w) => w.faction === faction); }
function pickWard(st, faction) {
  const own = wardsFor(faction);
  if (own.length && chance(st, 0.85)) return pick(st, own);
  return pick(st, NAMES.wards);
}
function makeName(st, faction) {
  const firsts = (NAMES.first && (NAMES.first[faction] || NAMES.first.none)) || ['Sam'];
  const lasts = NAMES.last || ['Doe'];
  return `${pick(st, firsts)} ${pick(st, lasts)}`;
}
export function misspell(st, name) {
  const chars = name.split('');
  const idx = [];
  for (let i = 1; i < chars.length - 1; i++) if (/[a-z]/i.test(chars[i]) && /[a-z]/i.test(chars[i + 1])) idx.push(i);
  if (!idx.length) return name + 'e';
  const i = pick(st, idx);
  if (chance(st, 0.5)) { [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]]; }
  else {
    const swaps = { a: 'e', e: 'a', i: 'y', o: 'u', u: 'o', y: 'i', n: 'm', m: 'n', l: 'll', t: 'tt', s: 'z', r: 'rr' };
    const c = chars[i].toLowerCase();
    chars[i] = swaps[c] || (c + c);
  }
  const out = chars.join('');
  return out === name ? name.slice(0, -1) + 'x' : out;
}

function basePerson(st, kind, faction) {
  faction = faction || pickFaction(st);
  const ward = pickWard(st, faction);
  const patienceMax = Math.max(1, randInt(st, BAL.patience[0], BAL.patience[1]) + (diff(st).patienceMod || 0) + perkAdd(st, 'patienceBonus'));
  return {
    id: nextUid(st, 'c'),
    kind,
    name: makeName(st, faction),
    faction,
    homeWard: ward ? ward.code : 'S-00',
    portrait: { seed: subSeed(st), traits: { faction, boots: faction === 'vantage' ? 'vantage' : 'street', outfit: faction, accessory: randInt(st, 0, 7) } },
    dialogue: { greet: '' },
    askPrice: 0,
    patience: patienceMax,
    patienceMax,
    mood: 'neutral',
    visibleTells: [],
    stage: 'talk',          // 'talk' | 'chit'
    agreed: false,
    inspected: {},          // tool -> true once used on this customer
    hidden: { reservation: 0 },
  };
}

// ---- buyers ----------------------------------------------------------------
const CAT_BASE = { food: 3, power: 2.5, sundry: 2.5, salvage: 1.5, tech: 1.6, chrome: 1.1, shard: 0.8, luxury: 0.3, stolen_goods: 0.6 };
function factionCatAffinity(faction, cat) {
  const items = ITEMS.filter((i) => i.category === cat);
  if (!items.length) return 0;
  const hits = items.filter((i) => i.buyers.includes(faction)).length;
  return 0.35 + hits / items.length;
}
function sellableCats() {
  return CATEGORIES.filter((c) => ITEMS.some((i) => i.category === c && i.buyers.length > 0));
}

export function ghostChance(st) {
  const g = BAL.ghostChit;
  const t = clamp((st.day - 1) / (g.endDay - 1), 0, 1);
  return (g.start + (g.end - g.start) * t) * (diff(st).ghostChitMult || 1) * activeEffects(st).ghostMult;
}

function makeBuyer(st, opts = {}) {
  const c = basePerson(st, 'buyer', opts.faction);
  const fx = activeEffects(st);
  const shelf = st.inventory.filter((i) => i.location === 'shelf');
  let category; let itemId;
  if (opts.undercover) {
    // asks for something illegal
    const illegalShelf = shelf.filter((i) => illegalTrue(st, i));
    if (illegalShelf.length && chance(st, 0.7)) category = ITEM[pick(st, illegalShelf).itemId].category;
    else category = chance(st, 0.6) ? 'stolen_goods' : pick(st, ['chrome', 'shard', 'power']);
  } else if (c.faction === 'spire' && chance(st, 0.65)) {
    category = 'luxury';
  } else if (shelf.length && chance(st, 0.6)) {
    category = ITEM[pick(st, shelf).itemId].category;
  } else {
    const cats = sellableCats();
    category = weighted(st, cats, (k) => (CAT_BASE[k] || 1) * factionCatAffinity(c.faction, k) * (fx.demand[k] || 1));
  }
  if (!opts.undercover && chance(st, 0.15)) {
    const pool = ITEMS.filter((i) => i.category === category && i.buyers.includes(c.faction));
    const it = pool.length ? pick(st, pool) : null;
    if (it) itemId = it.id;
  }
  c.wants = { category, label: itemId ? ITEM[itemId].name : categoryLabel(category) };
  if (itemId) c.wants.itemId = itemId;
  const repShift = 1 + BAL.repPriceShift * ((st.rep[c.faction] || 0) / 100);
  c.hidden.factor = randRange(st, BAL.buyerReservation[0], BAL.buyerReservation[1]) * repShift * (c.faction === 'spire' ? 1.25 : 1);
  c.hidden.reservation = 0;
  // payment
  const ghost = !opts.undercover && chance(st, ghostChance(st));
  c.payBy = ghost || chance(st, BAL.chitShare) ? 'chit' : 'cash';
  c.chit = makeChit(st, c, ghost);
  if (ghost) {
    c.hidden.ghostChit = true;
    if (chance(st, 0.4)) c.visibleTells.push('nervous');
  }
  if (opts.undercover) {
    c.hidden.undercover = true;
    const tells = shuffle(st, ['vantage_boots', 'formal_phrasing', 'knows_too_much', 'badge_mismatch']).slice(0, randInt(st, 1, 2));
    c.visibleTells.push(...tells);
    if (tells.includes('vantage_boots')) c.portrait.traits.boots = 'vantage';
    if (tells.includes('badge_mismatch')) c.portrait.traits.outfit = pick(st, ['vantage', 'spire']);
  }
  if (c.faction === 'spire' && chance(st, BAL.verifierShare)) {
    c.hidden.verifier = true;
    if (chance(st, 0.5)) { c.visibleTells.push('verifier_wand'); c.portrait.traits.verifier = true; }
  }
  const key = opts.undercover ? 'undercover_greet' : ghost && c.visibleTells.includes('nervous') ? 'ghost_nervous' : 'buyer_greet';
  c.dialogue.greet = line(st, key, { want: c.wants.label, name: c.name }, { faction: c.faction }) || `Looking for ${c.wants.label}.`;
  if (key === 'ghost_nervous') c.dialogue.greet = `${line(st, 'buyer_greet', { want: c.wants.label, name: c.name }, { faction: c.faction })} ${c.dialogue.greet}`.trim();
  return c;
}

export function makeChit(st, c, ghost) {
  const chit = { name: c.name, ward: c.homeWard, sigilGlitch: false, expiryDay: st.day + randInt(st, 5, 240) };
  if (ghost) {
    const tells = shuffle(st, ['name', 'ward', 'sigil', 'expiry']).slice(0, chance(st, 0.6) ? 1 : 2);
    for (const t of tells) {
      if (t === 'name') chit.name = misspell(st, c.name);
      if (t === 'ward') {
        const others = NAMES.wards.filter((w) => w.code !== c.homeWard);
        chit.ward = others.length ? pick(st, others).code : 'Z-99';
      }
      if (t === 'sigil') chit.sigilGlitch = true;
      if (t === 'expiry') chit.expiryDay = st.day - randInt(st, 1, 40);
    }
    if (perkFlag(st, 'highlightChitField')) chit.highlight = tells[0];
    if (add(st, 'chitLamp') || hasLamp(st)) chit.uvMark = chance(st, 0.7) ? 'missing' : 'ok';
    c.hidden.chitTells = tells;
  } else if (hasLamp(st)) {
    chit.uvMark = 'ok';
  }
  return chit;
}
function hasLamp(st) { return (st.upgrades || []).some((u) => u === 'chit_lamp'); }

// ---- sellers ---------------------------------------------------------------
const SELL_W = {
  lantern: { stolen_goods: 5, tech: 2, chrome: 1.5, luxury: 1.2, power: 1 },
  none: { stolen_goods: 2, tech: 2, salvage: 2, sundry: 1, chrome: 0.8 },
  sump: { salvage: 3, sundry: 2, food: 0.6, power: 1.5, chrome: 1, tech: 1.5, shard: 1 },
  static: { shard: 4, tech: 3, chrome: 1 },
  spire: { luxury: 3, tech: 2, chrome: 1 },
  vantage: { tech: 2, sundry: 1, chrome: 0.5 },
};
function sellerItemPool(cat) {
  return ITEMS.filter((i) => i.category === cat && !i.tags.includes('cooked') && !i.tags.includes('memory') && !i.tags.includes('corp')
    && !i.tags.includes('blank') && i.id !== 'shard_blank' && !(i.category === 'power' && i.tags.includes('charged') && i.legality !== 'legal'));
}

export function makeSellerItem(st, faction, forceCat, opts = {}) {
  const w = SELL_W[faction] || SELL_W.none;
  const fenceMult = (st.licences || []).length ? add(st, 'hotSellerMult') || 1 : 1;
  const cats = Object.keys(w).filter((k) => sellerItemPool(k).length);
  const cat = forceCat || weighted(st, cats, (k) => w[k] * (k === 'stolen_goods' ? fenceMult : 1));
  const pool = sellerItemPool(cat);
  const def = pick(st, pool) || ITEMS[0];
  const flags = {};
  let cond = def.category === 'chrome' ? randInt(st, 10, 75) : randInt(st, 35, 100);
  if (def.category === 'stolen_goods') flags.stolen = true;
  else if (['tech', 'chrome'].includes(def.category) && ['lantern', 'none'].includes(faction) && chance(st, 0.25)) flags.stolen = true;
  if (def.category === 'luxury') {
    const p = faction === 'lantern' ? 0.7 : faction === 'spire' ? 0.15 : 0.45;
    if (chance(st, p)) { flags.counterfeit = true; cond = randInt(st, 60, 95); }
  }
  if (def.category === 'chrome') flags.untested = true;
  if (def.tracer) flags.tracer = true;
  const lie = !opts.honest && chance(st, 0.4);
  const claimed = lie ? Math.min(98, cond + randInt(st, 10, 35)) : cond;
  const item = makeItem(st, def.id, { location: 'counter', condition: cond, flags, honest: false, claimedCondition: claimed });
  if (def.category === 'shard' && def.tags.includes('unknown')) assignShardContent(st, item, faction);
  // stolen serials may be on today's hot list
  if (flags.stolen && item.serial && chance(st, 0.4)) {
    const free = (st.hotPool || []).filter((s) => !st.hotPoolUsed.includes(s));
    if (free.length) { item.serial = free[0]; st.hotPoolUsed.push(free[0]); }
  }
  return { item, lie };
}

// hidden scan result for an unscanned shard (decided at creation)
export function assignShardContent(st, item, faction) {
  // weights from the scan recipe if present
  const recipes = Object.values(RAW_MODULES.RECIPES ? {} : {});
  void recipes;
  const scan = scanOutcomes();
  if (!scan.length) return;
  const o = weighted(st, scan, (x) => (x.weight || 1) * (faction === 'static' && ITEM[x.itemId] && ITEM[x.itemId].tags.includes('corp') ? 2 : 1));
  item.flags.scanResult = o.itemId;
  if ((o.flags && o.flags.tracer) || (ITEM[o.itemId] && ITEM[o.itemId].tracer)) item.flags.tracer = true;
}
let _scanCache = null;
import { RECIPES } from './content.js';
export function scanOutcomes() {
  if (_scanCache) return _scanCache;
  const r = RECIPES.find((x) => x.kind === 'scan');
  _scanCache = r ? r.outcomes : [];
  return _scanCache;
}

function makeSeller(st, opts = {}) {
  const c = basePerson(st, 'seller', opts.faction);
  const { item, lie } = makeSellerItem(st, c.faction, opts.category, opts);
  c.item = item;
  const def = ITEM[item.itemId];
  const truth = itemValue(st, item, 'truth');
  const apparent = itemValue(st, item, 'buyer');
  let res;
  if (item.flags.counterfeit) res = apparent * randRange(st, 0.25, 0.4);
  else if (def.category === 'stolen_goods' || item.flags.stolen) res = apparent * randRange(st, 0.28, 0.45) * (fenceBuyMult(st));
  else res = truth * randRange(st, BAL.sellerReservation[0], BAL.sellerReservation[1]);
  res *= 1 - BAL.repPriceShift * ((st.rep[c.faction] || 0) / 100);
  c.hidden.reservation = Math.max(5, Math.round(res));
  c.askPrice = snapUp(c.hidden.reservation * randRange(st, BAL.sellerOpening[0], BAL.sellerOpening[1]));
  if (item.flags.stolen && chance(st, 0.35)) c.visibleTells.push('nervous');
  if (item.flags.stolen && item.serial && chance(st, 0.3)) c.visibleTells.push('scratched_serial');
  if (item.flags.counterfeit && chance(st, 0.3)) c.visibleTells.push('too_cheap');
  if (lie && chance(st, 0.3)) c.visibleTells.push('evasive');
  c.hidden.lied = lie;
  c.dialogue.greet = line(st, 'seller_greet', { item: def.name, price: c.askPrice, name: c.name }, { faction: c.faction }) || `${def.name}, ${c.askPrice}¢.`;
  return c;
}
function fenceBuyMult(st) {
  let m = 1;
  for (const l of st.licences || []) if (l && RAW_LIC(l) && typeof RAW_LIC(l).effects.fenceBuyMult === 'number') m *= RAW_LIC(l).effects.fenceBuyMult;
  return m;
}
import { LICENCE } from './content.js';
const RAW_LIC = (id) => LICENCE[id];

// ---- specials ----------------------------------------------------------------
function makeCharity(st) {
  const c = basePerson(st, 'special', 'sump');
  const amount = snapUp(randInt(st, 20, 60));
  c.special = { type: 'charity', amount, options: [{ id: 'give', label: `Give ${amount}¢`, cost: amount }, { id: 'decline', label: 'Decline' }] };
  c.askPrice = amount;
  c.hidden.repays = chance(st, 0.5);
  c.dialogue.greet = line(st, 'special_charity', { price: amount, name: c.name }, { faction: 'sump' }) || `Could you spare ${amount}¢?`;
  return c;
}

function makeAuction(st) {
  const c = basePerson(st, 'special', 'none');
  c.name = 'Auction Drone';
  c.npcId = 'auction_drone';
  c.portrait.traits = { drone: true, faction: 'none' };
  // sealed lot: 2-3 items, mixed value
  const n = randInt(st, 2, 3);
  const lot = [];
  for (let i = 0; i < n; i++) {
    const cat = weighted(st, ['tech', 'chrome', 'luxury', 'salvage', 'sundry', 'shard'], (k) => ({ tech: 3, chrome: 2, luxury: 1, salvage: 3, sundry: 3, shard: 2 })[k]);
    const { item } = makeSellerItem(st, 'spire', cat, { honest: true });
    item.flags.stolen = false; delete item.flags.stolen;
    lot.push(item);
  }
  const value = lot.reduce((s, it) => s + itemValue(st, it, 'truth'), 0);
  const price = snapUp(value * randRange(st, 0.45, 0.95));
  c.special = { type: 'auction', lotSize: n, price, options: [{ id: 'bid', label: `Bid ${price}¢`, cost: price }, { id: 'pass', label: 'Pass' }] };
  c.askPrice = price;
  c.hidden.lot = lot;
  c.dialogue.greet = line(st, 'special_auction', { lot: `#${randInt(st, 100, 999)}`, price }, {}) || `SEALED LOT. ${n} ITEMS. MINIMUM ${price}¢.`;
  return c;
}

function makeTamsin(st) {
  const npc = NPC.old_tamsin;
  const c = makeSeller(st, { faction: 'sump', category: 'salvage' });
  c.npcId = 'old_tamsin';
  c.name = (npc && npc.name) || 'Old Tamsin';
  c.portrait.traits.npc = 'old_tamsin';
  if (chance(st, 0.15)) {
    const treasures = ITEMS.filter((i) => i.tags.includes('treasure'));
    if (treasures.length) {
      const t = pick(st, treasures);
      c.item = makeItem(st, t.id, { location: 'counter', condition: randInt(st, 60, 95), honest: false });
      c.hidden.reservation = Math.round(itemValue(st, c.item, 'truth') * 0.35);
      c.askPrice = snapUp(c.hidden.reservation * 1.5);
    }
  }
  const g = npc && npc.lines && Array.isArray(npc.lines.greet) && npc.lines.greet.length ? pick(st, npc.lines.greet) : '';
  if (g) c.dialogue.greet = `${typeof g === 'string' ? g : g.text} ${c.askPrice}¢.`;
  return c;
}

// ---- queue -----------------------------------------------------------------
export function customersToday(st) {
  const fx = activeEffects(st);
  let n = BAL.customersBase + Math.floor((st.appeal || 0) / BAL.customersPerAppeal);
  n = Math.min(BAL.customersCap, n);
  let traffic = fx.traffic;
  if (traffic < 1) traffic = Math.min(1, traffic + add(st, 'floodTrafficBonus'));
  n = Math.round(n * traffic);
  if (st.flags && st.flags.injuredDay === st.day) n -= 1;
  return Math.max(3, n);
}

export function generateQueue(st) {
  const n = customersToday(st);
  const q = [];
  const fx = activeEffects(st);
  const ucBase = st.heat > (diff(st).undercoverMinHeat ?? BAL.undercover.heatMin) ? BAL.undercover.chance * fx.undercoverMult : 0;
  let specials = 0;
  if (st.day % 7 === 0) { q.push(makeAuction(st)); specials++; }
  for (let i = q.length; i < n; i++) {
    const roll = rand(st);
    const kw = BAL.kindWeights;
    const tot = kw.buyer + kw.seller + kw.special;
    if (specials === 0 && roll < kw.special / tot) {
      specials++;
      q.push(chance(st, 0.55) ? makeCharity(st) : makeTamsin(st));
    } else if (roll < (kw.special + kw.seller) / tot) {
      q.push(makeSeller(st));
    } else {
      q.push(makeBuyer(st, { undercover: ucBase > 0 && chance(st, ucBase) }));
    }
  }
  return q;
}

// reservation for a buyer given a selected item
export function buyerReservation(st, c, item) {
  const def = ITEM[item.itemId];
  let v = itemValue(st, item, 'buyer') * demandMult(st, def.category) * c.hidden.factor;
  if (c.wants.itemId && c.wants.itemId === item.itemId) v *= 1.1;
  // static pay big for known corp shards; spire pay for luxury
  if (def.tags.includes('corp') && c.faction === 'static') v *= 1.3;
  if (def.category === 'stolen_goods' || item.flags.stolen) {
    for (const l of st.licences || []) { const L = LICENCE[l]; if (L && typeof L.effects.fenceSellMult === 'number') v *= L.effects.fenceSellMult; }
  }
  return Math.max(1, int(v));
}

export function buyerOpening(st, c) {
  return Math.max(1, Math.floor(c.hidden.reservation * randRange(st, BAL.buyerOpening[0], BAL.buyerOpening[1]) / BAL.priceSnap) * BAL.priceSnap || 1);
}
