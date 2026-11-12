// OPEN phase: the counter (customers, haggling, deals, chits, reports, specials).
import { ITEM } from './content.js';
import { BAL } from './balance.js';
import { randInt, randRange, chance } from './rng.js';
import { clamp, snapUp, earn, spend, line, int } from './util.js';
import { illegalTrue, isContrabandDef, itemValue, placeLocation, totalFree } from './items.js';
import { generateQueue, buyerReservation, buyerOpening } from './customers.js';
import { changeRep, changeHeat } from './rep.js';
import { generateMarket } from './night.js';
import { perkFlag, perkMult } from './modifiers.js';

export function setMood(c) {
  const r = c.patienceMax > 0 ? c.patience / c.patienceMax : 0;
  c.mood = r > 0.8 ? 'happy' : r > 0.5 ? 'neutral' : r > 0.2 ? 'annoyed' : 'angry';
}

function leave(st, reason, out, text) {
  const c = st.customer;
  if (!c) return;
  out.push({ type: 'CUSTOMER_LEFT', id: c.id, reason, ...(text ? { text } : {}) });
  st.customer = null;
}

export function openShop(st, a, out) {
  if (st.audit) return 'audit_unresolved';
  st.queue = generateQueue(st);
  st.phase = 'open';
  out.push({ type: 'SHOP_OPENED', count: st.queue.length, text: `Shutters up. ${st.queue.length} customers in the stairwell.` });
}

export function nextCustomer(st, a, out) {
  if (st.customer) return 'customer_present';
  if (!st.queue.length) return 'queue_empty';
  const c = st.queue.shift();
  setMood(c);
  if (perkFlag(st, 'showReservationHint') && c.kind === 'seller') c.hint = hintBand(c.hidden.reservation);
  st.customer = c;
  out.push({ type: 'CUSTOMER_ARRIVED', id: c.id, kind: c.kind, name: c.name, faction: c.faction, text: c.dialogue.greet });
}

function hintBand(v) { return { low: Math.max(1, Math.round(v * 0.85 / 5) * 5), high: Math.round(v * 1.15 / 5) * 5 }; }

export function itemMatchesWant(c, item) {
  const def = ITEM[item.itemId];
  if (!def || !c.wants) return false;
  if (c.wants.itemId) return item.itemId === c.wants.itemId;
  return def.category === c.wants.category;
}

export function selectItem(st, a, out) {
  const c = st.customer;
  if (!c || c.kind !== 'buyer') return 'no_buyer';
  if (c.stage !== 'talk') return 'wrong_stage';
  if (c.agreed) return 'already_agreed';
  const item = st.inventory.find((i) => i.uid === a.uid);
  if (!item) return 'no_such_item';
  if (item.location !== 'shelf') return 'not_on_shelf';
  if (!itemMatchesWant(c, item)) return 'not_wanted';
  c.selectedUid = item.uid;
  c.hidden.reservation = buyerReservation(st, c, item);
  c.askPrice = buyerOpening(st, c);
  if (perkFlag(st, 'showReservationHint')) c.hint = hintBand(c.hidden.reservation);
  const def = ITEM[item.itemId];
  c.dialogue.offer = line(st, 'haggle_counter', { price: c.askPrice, item: def.name }, { faction: c.faction }) || `${c.askPrice}¢ for the ${def.name}?`;
  out.push({ type: 'ITEM_SELECTED', uid: item.uid, price: c.askPrice, text: c.dialogue.offer });
}

function walk(st, out) {
  const c = st.customer;
  changeRep(st, c.faction, -1, out);
  const text = line(st, 'haggle_walk', { name: c.name }, { faction: c.faction }) || 'Forget it.';
  out.push({ type: 'HAGGLE_WALK', id: c.id, text });
  leave(st, 'patience', out);
}

export function offer(st, a, out) {
  const c = st.customer;
  if (!c || (c.kind !== 'buyer' && c.kind !== 'seller')) return 'no_customer';
  if (c.stage !== 'talk') return 'wrong_stage';
  if (c.agreed) return 'already_agreed';
  const P = Math.round(Number(a.price));
  if (!Number.isFinite(P) || P < 1 || P > 10000000) return 'bad_price';
  const res = c.hidden.reservation;
  const accept = (price) => {
    c.agreed = true;
    c.askPrice = price;
    const text = line(st, 'haggle_accept', { price, name: c.name }, { faction: c.faction }) || 'Deal.';
    out.push({ type: 'HAGGLE_ACCEPT', price, text });
  };
  const counter = (price, cost) => {
    c.patience -= cost;
    if (c.patience <= 0) { c.patience = 0; walk(st, out); return; }
    c.askPrice = price;
    setMood(c);
    const text = line(st, 'haggle_counter', { price, name: c.name }, { faction: c.faction, mood: c.mood }) || `${price}¢?`;
    c.dialogue.offer = text;
    out.push({ type: 'HAGGLE_COUNTER', price, mood: c.mood, patience: c.patience, text });
  };
  if (c.kind === 'buyer') {
    if (!c.selectedUid) return 'no_item_selected';
    if (P <= c.askPrice || P <= res) return accept(P);
    const cost = P > res * (1 + BAL.outrageous) ? 2 : 1;
    const stepF = randRange(st, BAL.counterStep[0], BAL.counterStep[1]);
    let bid = Math.floor((c.askPrice + (res - c.askPrice) * stepF) / BAL.priceSnap) * BAL.priceSnap;
    bid = Math.min(bid, res, P - 1);
    if (bid <= c.askPrice) bid = Math.min(res, c.askPrice + 1, P - 1);
    bid = Math.max(bid, c.askPrice);
    return counter(bid, cost);
  }
  // seller: player bids P to buy
  if (P >= c.askPrice) return accept(c.askPrice);
  if (P >= res) return accept(P);
  const cost = P < res * (1 - BAL.outrageous) ? 2 : 1;
  const stepF = randRange(st, BAL.counterStep[0], BAL.counterStep[1]);
  let ask = Math.ceil((c.askPrice - (c.askPrice - res) * stepF) / BAL.priceSnap) * BAL.priceSnap;
  ask = Math.max(ask, res, P + 1);
  if (ask >= c.askPrice) ask = Math.max(res, c.askPrice - 1, P + 1);
  ask = Math.min(ask, c.askPrice);
  return counter(ask, cost);
}

export function deal(st, a, out) {
  const c = st.customer;
  if (!c || (c.kind !== 'buyer' && c.kind !== 'seller')) return 'no_customer';
  if (c.stage !== 'talk') return 'wrong_stage';
  if (c.kind === 'seller') {
    const price = c.askPrice;
    if (st.creds < price) return 'insufficient_funds';
    const loc = placeLocation(st);
    if (!loc) return 'no_space';
    spend(st, price, `Bought ${ITEM[c.item.itemId].name}`);
    const item = { ...c.item, location: loc, boughtFor: price, acquiredDay: st.day };
    const def = ITEM[item.itemId];
    if (def.perishableDays) item.spoilsDay = item.spoilsDay || st.day + def.perishableDays;
    st.inventory.push(item);
    st.stats.itemsBought += 1;
    st.stats.customersServed += 1;
    changeRep(st, c.faction, 1, out);
    out.push({ type: 'PURCHASE', uid: item.uid, itemId: item.itemId, price, from: 'customer', text: line(st, 'deal_done', { price }, { faction: c.faction }) || `Bought for ${price}¢.` });
    leave(st, 'deal', out);
    return;
  }
  // buyer
  if (!c.selectedUid) return 'no_item_selected';
  const item = st.inventory.find((i) => i.uid === c.selectedUid);
  if (!item || item.location !== 'shelf') return 'item_unavailable';
  if (c.hidden.verifier && item.flags.counterfeit) {
    item.known.counterfeit = true;
    changeHeat(st, 8, out);
    out.push({ type: 'VERIFIER_CAUGHT', uid: item.uid, text: 'Their verifier wand screams. "A fake? Down here? How quaint." They leave, loudly.' });
    leave(st, 'verifier', out);
    return;
  }
  if (c.hidden.undercover && illegalTrue(st, item)) {
    st.inventory = st.inventory.filter((i) => i.uid !== item.uid);
    changeHeat(st, BAL.heat.undercoverSale, out);
    changeRep(st, 'vantage', -5, out);
    out.push({ type: 'UNDERCOVER_BUST', uid: item.uid, itemId: item.itemId, text: 'A Vantage badge slides across the counter. The item is confiscated. Your file grows thicker.' });
    leave(st, 'undercover', out);
    return;
  }
  if (c.payBy === 'chit') {
    c.stage = 'chit';
    out.push({ type: 'CHIT_PRESENTED', chit: { ...c.chit }, price: c.askPrice, text: 'They tap a credchit on the reader.' });
    return;
  }
  completeSale(st, c, item, c.askPrice, false, out);
}

export function completeSale(st, c, item, price, ghost, out) {
  const def = ITEM[item.itemId];
  st.inventory = st.inventory.filter((i) => i.uid !== item.uid);
  earn(st, price, `Sold ${def.name}`);
  if (ghost) st.pending.chits.push({ amount: price, name: c.name, itemId: item.itemId });
  st.stats.customersServed += 1;
  st.stats.itemsSold += 1;
  if (price > st.stats.bestSale) st.stats.bestSale = price;
  // consequences
  if (isContrabandDef(st, item)) changeHeat(st, randInt(st, BAL.heat.sellContraband[0], BAL.heat.sellContraband[1]), out);
  if (item.serial && st.hotList.includes(item.serial)) changeHeat(st, BAL.heat.sellHot, out);
  if (item.flags.tracer) {
    changeHeat(st, 8, out);
    if (c.faction === 'static') changeRep(st, 'static', 5, out);
  }
  if (item.flags.cut) {
    const p = BAL.foodPoisonChance * perkMult(st, 'poisonChanceMult');
    if (chance(st, p)) st.pending.poison.push({ dueDay: st.day, name: c.name, itemId: item.itemId });
  }
  if (def.category === 'chrome' && ((item.flags.untested && item.condition < 50) || item.condition < 25)) {
    st.pending.returns.push({ dueDay: st.day + randInt(st, 0, 2), price, itemId: item.itemId, faction: c.faction, name: c.name, untested: !!item.flags.untested, medical: def.legality === 'permit' && def.permit === 'med_tech' });
  }
  if (c.faction in st.rep) changeRep(st, c.faction, 1, out);
  const text = line(st, 'deal_done', { price, item: def.name, name: c.name }, { faction: c.faction }) || `Sold for ${price}¢.`;
  out.push({ type: 'SALE', uid: item.uid, itemId: item.itemId, price, text });
  leave(st, 'deal', out);
}

export function acceptChit(st, a, out) {
  const c = st.customer;
  if (!c || c.stage !== 'chit') return 'no_chit';
  const item = st.inventory.find((i) => i.uid === c.selectedUid);
  if (!item) return 'item_unavailable';
  completeSale(st, c, item, c.askPrice, !!c.hidden.ghostChit, out);
}

export function rejectChit(st, a, out) {
  const c = st.customer;
  if (!c || c.stage !== 'chit') return 'no_chit';
  if (c.hidden.ghostChit) {
    st.stats.ghostChitsCaught += 1;
    out.push({ type: 'CHIT_REJECTED', ghost: true, text: 'They snatch the chit back and vanish into the stairwell. A ghost.' });
  } else {
    changeRep(st, c.faction, -2, out);
    out.push({ type: 'CHIT_REJECTED', ghost: false, text: 'The chit was good. They leave, insulted.' });
  }
  leave(st, 'chit_rejected', out);
}

export function refuse(st, a, out) {
  const c = st.customer;
  if (!c) return 'no_customer';
  if (c.kind === 'special' && c.special && c.special.type === 'charity') changeRep(st, 'sump', -1, out);
  if (c.kind === 'buyer' && (c.agreed || c.stage === 'chit')) changeRep(st, c.faction, -1, out);
  leave(st, 'refused', out, line(st, 'refuse', { name: c.name }, { faction: c.faction }) || undefined);
}

export function wrongdoing(st, c) {
  if (c.hidden.undercover) return false;
  if (c.kind === 'buyer') return !!c.hidden.ghostChit;
  if (c.kind === 'seller' && c.item) return illegalTrue(st, c.item);
  return false;
}

export function report(st, a, out) {
  const c = st.customer;
  if (!c) return 'no_customer';
  st.stats.reports += 1;
  if (wrongdoing(st, c)) {
    const basis = c.kind === 'seller' ? itemValue(st, c.item, 'buyer') : Math.max(c.askPrice, 40);
    const bounty = Math.max(BAL.bounty.min, Math.round(basis * BAL.bounty.share));
    earn(st, bounty, 'Vantage bounty');
    changeRep(st, 'vantage', 3, out);
    changeRep(st, 'lantern', c.faction === 'lantern' ? -6 : -3, out);
    if (c.hidden.ghostChit) st.stats.ghostChitsCaught += 1;
    out.push({ type: 'REPORTED', correct: true, bounty, text: `Vantage hauls them off. Bounty: ${bounty}¢.` });
  } else {
    changeRep(st, 'sump', -4, out);
    changeHeat(st, BAL.heat.failedReport, out);
    out.push({ type: 'REPORTED', correct: false, bounty: 0, text: line(st, 'report', { name: c.name }, { faction: c.faction }) || 'Vantage finds nothing. The stairwell remembers.' });
  }
  leave(st, 'reported', out);
}

export function specialChoice(st, a, out) {
  const c = st.customer;
  if (!c || c.kind !== 'special' || !c.special) return 'no_special';
  const opt = (c.special.options || []).find((o) => o.id === a.optionId);
  if (!opt) return 'bad_option';
  const sp = c.special;
  if (sp.type === 'charity') {
    if (opt.id === 'give') {
      if (st.creds < sp.amount) return 'insufficient_funds';
      spend(st, sp.amount, `Helped ${c.name}`);
      changeRep(st, 'sump', 4, out);
      if (c.hidden.repays) st.pending.repay.push({ dueDay: st.day + randInt(st, 3, 6), amount: Math.round(sp.amount * 1.2), name: c.name });
      out.push({ type: 'SPECIAL_RESOLVED', optionId: 'give', text: `${c.name} squeezes your hand. "I won't forget."` });
    } else {
      changeRep(st, 'sump', -1, out);
      out.push({ type: 'SPECIAL_RESOLVED', optionId: opt.id, text: `${c.name} nods and goes.` });
    }
  } else if (sp.type === 'auction') {
    if (opt.id === 'bid') {
      if (st.creds < sp.price) return 'insufficient_funds';
      if (totalFree(st) < c.hidden.lot.length) return 'no_space';
      spend(st, sp.price, 'Auction Drone lot');
      const uids = [];
      for (const it of c.hidden.lot) {
        const loc = placeLocation(st);
        const def = ITEM[it.itemId];
        const item = { ...it, location: loc, boughtFor: Math.round(sp.price / c.hidden.lot.length), acquiredDay: st.day };
        // sealed lots are opened honestly except chrome still needs testing
        item.known = { condition: item.condition, conditionExact: true };
        if (item.flags.counterfeit) item.known.counterfeit = true;
        if (def.category === 'chrome' && item.flags.untested) item.known = { condition: clamp(item.condition + randInt(st, -10, 10), 0, 100), untested: true };
        if (def.perishableDays) item.spoilsDay = st.day + def.perishableDays;
        st.inventory.push(item);
        uids.push(item.uid);
      }
      st.stats.itemsBought += uids.length;
      out.push({ type: 'PURCHASE', from: 'auction', uids, price: sp.price, text: `The drone drops the lot: ${c.hidden.lot.map((i) => ITEM[i.itemId].name).join(', ')}.` });
    } else {
      out.push({ type: 'SPECIAL_RESOLVED', optionId: opt.id, text: 'The drone hums away.' });
    }
  } else {
    out.push({ type: 'SPECIAL_RESOLVED', optionId: opt.id });
  }
  leave(st, 'special', out);
}

export function closeShop(st, a, out) {
  const left = st.queue.length + (st.customer ? 1 : 0);
  st.queue = [];
  st.customer = null;
  st.phase = 'night';
  generateMarket(st);
  out.push({ type: 'SHOP_CLOSED', left, text: left ? `Shutters down. ${left} customer(s) wander off.` : 'Shutters down.' });
}

export { int };
