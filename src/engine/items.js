// Item creation, valuation, legality.
import { ITEM, BRAND, PERMIT } from './content.js';
import { BAL } from './balance.js';
import { rand, randInt, pick, chance } from './rng.js';
import { nextUid, clamp, int } from './util.js';
import { activeEffects } from './events.js';

const LETTERS = 'ABCDEFHKLMNPRSTVXZ';
export function makeSerial(st) {
  const a = LETTERS[randInt(st, 0, LETTERS.length - 1)] + LETTERS[randInt(st, 0, LETTERS.length - 1)];
  const n = String(randInt(st, 1000, 9999));
  return `${a}-${n}-${LETTERS[randInt(st, 0, LETTERS.length - 1)]}`;
}

export function hasSerialTag(def) { return !!def && (def.tags.includes('serial') || ['tech', 'chrome', 'luxury', 'stolen_goods'].includes(def.category)); }

// opts: { location, condition, quality, flags, known (overrides), boughtFor, honest (default true), claimedCondition, serial }
export function makeItem(st, itemId, opts = {}) {
  const def = ITEM[itemId];
  const condition = clamp(int(opts.condition ?? randInt(st, 70, 100)), 0, 100);
  const quality = opts.quality || (rand(st) < 0.15 ? 'A' : rand(st) < 0.75 ? 'B' : 'C');
  const flags = { ...(opts.flags || {}) };
  const item = {
    uid: opts.uid || nextUid(st, 'i'),
    itemId,
    location: opts.location || 'storage',
    condition,
    quality,
    flags,
    known: {},
    boughtFor: int(opts.boughtFor || 0),
    acquiredDay: st.day,
  };
  if (def && (hasSerialTag(def) || flags.stolen)) item.serial = opts.serial || makeSerial(st);
  if (def && def.perishableDays) item.spoilsDay = st.day + def.perishableDays;
  if (def && def.brand && BRAND[def.brand]) {
    const b = BRAND[def.brand];
    item.marks = b.marks.slice(0, 3);
    if (flags.counterfeit) {
      const slot = randInt(st, 0, 2);
      item.marks[slot] = pick(st, b.fakeMarksBySlot[slot]) || `${b.marks[slot]} (off)`;
      flags.fakeSlot = slot;
    }
  }
  if (def && def.category === 'chrome' && flags.untested === undefined && opts.untested) flags.untested = true;
  // known: honest by default (market goods); sellers pass honest:false
  if (opts.honest === false) {
    item.known = { condition: clamp(int(opts.claimedCondition ?? condition), 0, 100) };
    if (flags.untested) item.known.untested = true;
    if (flags.labelled) item.known.labelled = true;
  } else {
    item.known = { condition, conditionExact: true };
    for (const k of ['stolen', 'counterfeit', 'tracer', 'untested', 'cut', 'labelled']) if (flags[k]) item.known[k] = true;
  }
  if (opts.known) Object.assign(item.known, opts.known);
  return item;
}

export function condMult(c) { return BAL.conditionFloor + (1 - BAL.conditionFloor) * clamp(c, 0, 100) / 100; }

export function demandMult(st, category) {
  const d = (st.market && st.market.demand && st.market.demand[category]) || 1;
  const ev = activeEffects(st).demand[category] || 1;
  return d * ev;
}

// Base value from definition + quality + condition. perspective:
//  'truth'  -> real worth (counterfeits worth little)
//  'known'  -> what the player believes (known flags/condition)
//  'buyer'  -> what a customer at the counter perceives (they can't see hidden flags)
export function itemValue(st, item, perspective = 'truth') {
  const def = ITEM[item.itemId];
  if (!def) return 0;
  let v = def.basePrice * (BAL.qualityMult[item.quality] || 1);
  const cond = perspective === 'truth' ? item.condition : (item.known && item.known.condition !== undefined ? item.known.condition : item.condition);
  v *= condMult(cond);
  if (perspective === 'truth' && item.flags.counterfeit) v *= 0.2;
  if (perspective === 'known' && item.known.counterfeit) v *= 0.2;
  if (perspective !== 'truth' && def.category === 'chrome' && item.known.untested) v *= 0.85;
  if (item.flags.cut && perspective === 'truth') v *= 0.9;
  return Math.max(1, Math.round(v));
}

// --- legality -------------------------------------------------------------
function defIllegal(st, def) {
  if (!def) return false;
  if (def.legality === 'contraband') return true;
  if (def.legality === 'permit') return !(def.permit && st.permits.includes(def.permit) && PERMIT[def.permit] !== undefined) && !(def.permit && st.permits.includes(def.permit));
  return false;
}
export function illegalTrue(st, item) {
  const def = ITEM[item.itemId];
  return defIllegal(st, def) || !!(item.flags.stolen || item.flags.counterfeit || item.flags.tracer);
}
export function illegalKnown(st, item) {
  const def = ITEM[item.itemId];
  return defIllegal(st, def) || !!(item.known.stolen || item.known.counterfeit || item.known.tracer || item.known.hot);
}
export function isContrabandDef(st, item) { return defIllegal(st, ITEM[item.itemId]); }

export function freeSlots(st, loc) {
  const used = st.inventory.filter((i) => i.location === loc).length;
  return Math.max(0, (st.capacity[loc] || 0) - used);
}
// place a new item: storage first, then shelf (R7). Returns location or null.
export function placeLocation(st) {
  if (freeSlots(st, 'storage') > 0) return 'storage';
  if (freeSlots(st, 'shelf') > 0) return 'shelf';
  return null;
}
export function totalFree(st) { return freeSlots(st, 'storage') + freeSlots(st, 'shelf'); }

export { chance };
