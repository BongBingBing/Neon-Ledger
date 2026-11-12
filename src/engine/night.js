// NIGHT phase: market, workshop, purchases, dues, jobs, favours; plus MOVE/PAY_LEASE/BUY_DEED/CHOOSE_PERK.
import { ITEMS, ITEM, MACHINE, RECIPE, RECIPES, UPGRADE, PERMIT, LICENCE, PERK, JOB, NPC } from './content.js';
import { BAL } from './balance.js';
import { randInt, randRange, weighted, chance, pick } from './rng.js';
import { clamp, earn, spend, int, addFeed } from './util.js';
import { makeItem, itemValue, freeSlots, placeLocation, totalFree, illegalTrue, isContrabandDef } from './items.js';
import { activeEffects } from './events.js';
import { diff, mult, add, perkMult, perkAdd, machineOwned, machineWorking } from './modifiers.js';
import { changeRep, changeHeat } from './rep.js';
import { computeAudit } from './audit.js';
import { recalc } from './state.js';
import { endGame, deedEndingId } from './endings.js';
import { assignShardContent } from './customers.js';

// ---- market ----------------------------------------------------------------
function supplierMult(st, category) {
  const fx = activeEffects(st);
  return (fx.buyPrice[category] || 1) * fx.buyPriceMult * perkMult(st, 'supplierPriceMult') * (diff(st).priceMult || 1);
}

function makeListing(st, def, extra = {}) {
  const cheap = def.basePrice < 20;
  const listing = { itemId: def.id, price: 1, qty: def.category === 'chrome' ? 1 : cheap ? randInt(st, 3, 8) : randInt(st, 1, 3), flags: {}, quality: pick(st, ['B', 'B', 'C', 'A']), condition: randInt(st, 80, 100), ...extra };
  let price = def.basePrice * randRange(st, BAL.marketBuy[0], BAL.marketBuy[1]) * (BAL.qualityMult[listing.quality] || 1);
  if (def.category === 'chrome') {
    listing.condition = randInt(st, 12, 60);
    listing.flags = { untested: true };
    price = def.basePrice * (0.3 + 0.7 * listing.condition / 100) * randRange(st, 0.35, 0.5);
  } else price *= (0.3 + 0.7 * listing.condition / 100);
  if (extra.black) price = def.basePrice * randRange(st, 0.35, 0.5);
  listing.price = Math.max(1, Math.round(price * supplierMult(st, def.category)));
  delete listing.black;
  return listing;
}

export function generateMarket(st) {
  const pool = ITEMS.filter((i) => (i.market || 0) > 0);
  const want = randInt(st, BAL.marketListings[0], BAL.marketListings[1]);
  const chosen = new Set();
  // trade inputs for owned machines always show up
  for (const r of RECIPES) {
    if (!machineOwned(st, r.machineId)) continue;
    for (const inp of r.inputs) {
      if (inp.itemId && ITEM[inp.itemId] && (ITEM[inp.itemId].market || 0) > 0) chosen.add(inp.itemId);
      else if (inp.category || inp.tag) {
        const opts = pool.filter((i) => (inp.category ? i.category === inp.category : i.tags.includes(inp.tag)) && !(inp.exclude || []).includes(i.id));
        if (opts.length && [...chosen].filter((id) => opts.some((o) => o.id === id)).length === 0) chosen.add(weighted(st, opts, (i) => i.market).id);
      }
    }
  }
  let guard = 0;
  while (chosen.size < want + 0 && guard++ < 200 && chosen.size < pool.length) chosen.add(weighted(st, pool, (i) => i.market).id);
  st.market = { ...st.market, day: st.day, listings: [...chosen].map((id) => makeListing(st, ITEM[id])) };
}

export function buyStock(st, a, out) {
  const idx = int(a.listingIndex);
  const L = st.market.listings[idx];
  if (!L || !Number.isInteger(Number(a.listingIndex))) return 'no_such_listing';
  const qty = int(a.qty ?? 1);
  if (qty < 1 || qty > L.qty) return 'bad_qty';
  const cost = L.price * qty;
  if (st.creds < cost) return 'insufficient_funds';
  if (totalFree(st) < qty) return 'no_space';
  spend(st, cost, `Supplier: ${qty}× ${ITEM[L.itemId].name}`);
  const uids = [];
  const def = ITEM[L.itemId];
  for (let k = 0; k < qty; k++) {
    const loc = placeLocation(st);
    const flags = { ...(L.flags || {}) };
    const it = makeItem(st, L.itemId, { location: loc, condition: L.condition, quality: L.quality, flags, boughtFor: L.price });
    if (def.category === 'chrome' && flags.untested) it.known = { condition: clamp(it.condition + randInt(st, -10, 15), 0, 100), untested: true };
    if (def.category === 'shard' && def.tags.includes('unknown')) assignShardContent(st, it, 'none');
    if (def.perishableDays) it.spoilsDay = st.day + def.perishableDays + add(st, 'spoilDaysBonus');
    st.inventory.push(it);
    uids.push(it.uid);
  }
  L.qty -= qty;
  st.stats.itemsBought += qty;
  out.push({ type: 'PURCHASE', from: 'market', itemId: L.itemId, qty, price: cost, uids, text: `Bought ${qty}× ${def.name} for ${cost}¢.` });
}

export function sellToMarket(st, a, out) {
  const it = st.inventory.find((i) => i.uid === a.uid);
  if (!it) return 'no_such_item';
  const share = isContrabandDef(st, it) || it.flags.stolen ? 0.3 : BAL.marketSell;
  const price = Math.max(1, Math.round(itemValue(st, it, 'truth') * share));
  st.inventory = st.inventory.filter((i) => i.uid !== it.uid);
  earn(st, price, `Dumped ${ITEM[it.itemId].name} to supplier`);
  if (isContrabandDef(st, it)) changeHeat(st, 2, out);
  out.push({ type: 'SOLD_TO_MARKET', uid: it.uid, itemId: it.itemId, price, text: `Supplier pays ${price}¢.` });
}

// ---- workshop --------------------------------------------------------------
export function recipeMaxBatch(st, r) {
  return r.maxBatch + (r.kind === 'charge' ? add(st, 'chargeBatchBonus') : 0);
}
function specMatches(spec, item) {
  const def = ITEM[item.itemId];
  if (!def) return false;
  if ((spec.exclude || []).includes(item.itemId)) return false;
  if (spec.itemId) return item.itemId === spec.itemId;
  if (spec.category) return def.category === spec.category;
  if (spec.tag) return def.tags.includes(spec.tag);
  return false;
}
// assign inputUids to recipe specs; returns {batch} or error string
export function matchInputs(st, r, uids) {
  if (!Array.isArray(uids) || uids.length === 0) return 'no_inputs';
  if (new Set(uids).size !== uids.length) return 'duplicate_inputs';
  const items = uids.map((u) => st.inventory.find((i) => i.uid === u));
  if (items.some((i) => !i)) return 'no_such_item';
  const setSize = r.inputs.reduce((s, i) => s + i.qty, 0);
  if (items.length % setSize !== 0) return 'bad_input_count';
  const batch = items.length / setSize;
  if (batch < 1 || batch > recipeMaxBatch(st, r)) return 'bad_batch';
  const pool = items.slice();
  const specs = r.inputs.slice().sort((x, y) => (y.itemId ? 1 : 0) - (x.itemId ? 1 : 0));
  for (const s of specs) {
    for (let n = 0; n < s.qty * batch; n++) {
      const k = pool.findIndex((it) => specMatches(s, it));
      if (k < 0) return 'inputs_mismatch';
      pool.splice(k, 1);
    }
  }
  if (r.kind === 'scan' && items.some((i) => !(ITEM[i.itemId].tags.includes('unknown')))) return 'inputs_mismatch';
  return { batch, items };
}

export function runCost(st, r, batch) {
  const charge = r.kind === 'charge';
  const powerMult = charge ? mult(st, 'chargePowerMult') : 1;
  return Math.round((r.powerCost || 0) * batch * powerMult + (r.partsCost || 0) * batch);
}

export function runMachine(st, a, out) {
  const m = st.machines[a.machineId];
  if (!m || !m.owned) return 'machine_not_owned';
  if (m.broken) return 'machine_broken';
  if (m.job) return 'machine_busy';
  const r = RECIPE[a.recipeId];
  if (!r || r.machineId !== a.machineId) return 'bad_recipe';
  const res = matchInputs(st, r, a.inputUids);
  if (typeof res === 'string') return res;
  const cost = runCost(st, r, res.batch);
  if (st.creds < cost) return 'insufficient_funds';
  if (cost > 0) spend(st, cost, `${MACHINE[a.machineId].name}: ${r.name}`);
  const set = new Set(a.inputUids);
  const inputs = st.inventory.filter((i) => set.has(i.uid));
  st.inventory = st.inventory.filter((i) => !set.has(i.uid));
  m.job = { recipeId: r.id, inputUids: a.inputUids.slice(), inputs, batch: res.batch, readyDay: st.day + r.days, startedDay: st.day };
  out.push({ type: 'MACHINE_STARTED', machineId: a.machineId, recipeId: r.id, readyDay: m.job.readyDay, cost, text: `${MACHINE[a.machineId].name} is running: ${r.name}.` });
}

function jobOutputCount(st, job) {
  const r = RECIPE[job.recipeId];
  if (!r) return job.inputs.length;
  if (r.kind === 'refurb' || r.kind === 'scan') return job.inputs.length;
  return r.outputs.reduce((s, o) => s + (o.qty || 1), 0) * job.batch;
}

function produce(st, machineId, out) {
  const m = st.machines[machineId];
  const job = m.job;
  const r = RECIPE[job.recipeId];
  const made = [];
  const ruined = [];
  if (!r) { // recipe vanished (content change): return inputs
    for (const it of job.inputs) { it.location = placeLocation(st) || 'storage'; st.inventory.push(it); made.push(it.uid); }
  } else if (r.kind === 'refurb') {
    const t = r.transform || {};
    const failP = (r.risk.failChance || 0) * perkMult(st, 'refurbFailMult');
    for (const it of job.inputs) {
      if (failP > 0 && chance(st, failP)) { ruined.push(it.itemId); continue; }
      it.condition = clamp(it.condition + (t.conditionGain || 0) + add(st, 'refurbConditionBonus'), 0, t.conditionCap || 100);
      for (const f of t.clearFlags || ['untested']) { delete it.flags[f]; delete it.known[f]; }
      it.flags.untested = false; it.known.untested = false;
      if (t.revealCondition !== false) { it.known.condition = it.condition; it.known.conditionExact = true; }
      it.location = placeLocation(st) || 'storage';
      st.inventory.push(it); made.push(it.uid);
    }
  } else if (r.kind === 'scan') {
    for (const it of job.inputs) {
      let res = it.flags.scanResult;
      if (!res || !ITEM[res]) { assignShardContent(st, it, 'none'); res = it.flags.scanResult; }
      if (res && ITEM[res]) {
        const o = r.outcomes.find((x) => x.itemId === res) || {};
        it.itemId = res;
        it.flags = { ...(o.flags || {}) };
        if (ITEM[res].tracer) it.flags.tracer = true;
        it.known = { condition: it.condition, conditionExact: true, scanned: true };
        if (it.flags.tracer) it.known.tracer = true;
        if (ITEM[res].brand === undefined) delete it.marks;
      }
      it.location = placeLocation(st) || 'storage';
      st.inventory.push(it); made.push(it.uid);
    }
  } else {
    for (let b = 0; b < job.batch; b++) {
      for (const o of r.outputs) {
        for (let q = 0; q < (o.qty || 1); q++) {
          const it = makeItem(st, o.itemId, { location: placeLocation(st) || 'storage', condition: randInt(st, 85, 100), quality: 'B', flags: { ...(o.flags || {}) }, boughtFor: 0 });
          const def = ITEM[o.itemId];
          if (def.perishableDays) it.spoilsDay = st.day + def.perishableDays + add(st, 'spoilDaysBonus');
          if (r.risk && typeof r.risk.poisonChance === 'number' && it.flags.cut) it.flags.poisonChance = r.risk.poisonChance;
          st.inventory.push(it); made.push(it.uid);
        }
      }
    }
  }
  m.job = null;
  out.push({ type: 'MACHINE_DONE', machineId, recipeId: job.recipeId, uids: made, ruined, text: `${MACHINE[machineId] ? MACHINE[machineId].name : machineId} finished${ruined.length ? ` (${ruined.length} ruined)` : ''}.` });
}

export function collectMachine(st, a, out) {
  const m = st.machines[a.machineId];
  if (!m || !m.owned) return 'machine_not_owned';
  if (!m.job) return 'no_job';
  if (m.job.readyDay > st.day) return 'not_ready';
  if (totalFree(st) < jobOutputCount(st, m.job)) return 'no_space';
  produce(st, a.machineId, out);
}

export function autoCollect(st, out) {
  for (const id of Object.keys(st.machines)) {
    const m = st.machines[id];
    if (m.job && m.job.readyDay <= st.day && totalFree(st) >= jobOutputCount(st, m.job)) produce(st, id, out);
    else if (m.job && m.job.readyDay <= st.day) out.push({ type: 'MACHINE_READY', machineId: id, text: `${MACHINE[id] ? MACHINE[id].name : id} is done, but you have no room for the output.` });
  }
}

export { jobOutputCount };

// ---- purchases ---------------------------------------------------------------
export function reqsMet(st, req) {
  if (!req) return true;
  for (const m of req.machines || []) if (!machineOwned(st, m)) return false;
  for (const u of req.upgrades || []) if (!st.upgrades.includes(u)) return false;
  for (const l of req.licences || []) if (!st.licences.includes(l)) return false;
  for (const p of req.permits || []) if (!st.permits.includes(p)) return false;
  for (const [f, v] of Object.entries(req.rep || {})) if ((st.rep[f] ?? 0) < v) return false;
  if (req.holdsTag && !st.inventory.some((i) => ITEM[i.itemId] && ITEM[i.itemId].tags.includes(req.holdsTag))) return false;
  return true;
}
function machineUnlocked(st, id) {
  const def = MACHINE[id];
  if (!reqsMet(st, def.requires)) return false;
  // licences may also unlock a machine (if machine requires a licence it is covered above)
  return true;
}
export function machinePrice(st, id) {
  const def = MACHINE[id];
  const m = st.machines[id];
  if (m && m.owned && m.broken) return def.repairCost || Math.round(def.cost * 0.35);
  return def.cost;
}
export function buyMachine(st, a, out) {
  const def = MACHINE[a.id];
  if (!def) return 'no_such_machine';
  const m = st.machines[a.id];
  if (m && m.owned && !m.broken) return 'already_owned';
  if (!(m && m.owned) && !machineUnlocked(st, a.id)) return 'requirements_unmet';
  const price = machinePrice(st, a.id);
  if (st.creds < price) return 'insufficient_funds';
  if (m && m.owned && m.broken) {
    spend(st, price, `Repaired ${def.name}`);
    m.broken = false;
    out.push({ type: 'MACHINE_REPAIRED', id: a.id, price, text: `${def.name} repaired.` });
    return;
  }
  spend(st, price, `Bought ${def.name}`);
  st.machines[a.id] = { owned: true, broken: false, job: null };
  recalc(st);
  out.push({ type: 'PURCHASE', from: 'machine', id: a.id, price, text: `${def.name} installed.` });
}
export function buyUpgrade(st, a, out) {
  const def = UPGRADE[a.id];
  if (!def) return 'no_such_upgrade';
  if (st.upgrades.includes(a.id)) return 'already_owned';
  if (!reqsMet(st, def.requires)) return 'requirements_unmet';
  if (st.creds < def.cost) return 'insufficient_funds';
  spend(st, def.cost, `Upgrade: ${def.name}`);
  st.upgrades.push(a.id);
  recalc(st);
  out.push({ type: 'PURCHASE', from: 'upgrade', id: a.id, price: def.cost, text: `${def.name} installed.` });
}
export function permitPrice(st, id) {
  const p = PERMIT[id];
  const rep = Math.max(0, st.rep[p.faction || 'vantage'] || 0);
  const disc = Math.min(p.maxDiscount || 0, (p.repDiscount || 0) * rep / 10);
  return Math.round(p.cost * (1 - disc));
}
export function buyPermit(st, a, out) {
  const p = PERMIT[a.id];
  if (!p) return 'no_such_permit';
  if (st.permits.includes(a.id)) return 'already_owned';
  if ((st.rep[p.faction || 'vantage'] ?? 0) < (p.minRep ?? -100) || !reqsMet(st, p.requires)) return 'requirements_unmet';
  const price = permitPrice(st, a.id);
  if (st.creds < price) return 'insufficient_funds';
  spend(st, price, `Permit: ${p.name}`);
  st.permits.push(a.id);
  out.push({ type: 'PURCHASE', from: 'permit', id: a.id, price, text: `${p.name} granted.` });
}
export function buyLicence(st, a, out) {
  const l = LICENCE[a.id];
  if (!l) return 'no_such_licence';
  if (st.licences.includes(a.id)) return 'already_owned';
  if ((st.rep[l.faction || 'lantern'] ?? 0) < (l.minRep ?? -100) || !reqsMet(st, l.requires)) return 'requirements_unmet';
  if (st.creds < l.cost) return 'insufficient_funds';
  spend(st, l.cost, `Licence: ${l.name}`);
  st.licences.push(a.id);
  out.push({ type: 'PURCHASE', from: 'licence', id: a.id, price: l.cost, text: `${l.name}: the Lanterns nod.` });
}

// ---- dues ------------------------------------------------------------------
export function duesQuote(st) {
  const stock = st.inventory.reduce((s, i) => s + (ITEM[i.itemId] ? ITEM[i.itemId].basePrice : 0), 0);
  const base = Math.max(BAL.dues.min, Math.round(stock * BAL.dues.share));
  const lantern = st.rep.lantern || 0;
  const repMult = clamp(1 - lantern / 250, 0.6, 1.4);
  return Math.max(BAL.dues.min, Math.round(base * repMult * activeEffects(st).duesMult));
}
export function payDues(st, a, out) {
  if (st.duesPaidTonight || st.duesSkippedTonight) return 'dues_decided';
  const amt = duesQuote(st);
  if (st.creds < amt) return 'insufficient_funds';
  spend(st, amt, 'Lantern dues');
  st.duesPaidTonight = true;
  st.duesSkipStreak = 0;
  changeRep(st, 'lantern', 1, out);
  out.push({ type: 'DUES_PAID', amount: amt, text: `Rook pockets ${amt}¢. "Sleep well, neighbour."` });
}
export function skipDues(st, a, out) {
  if (st.duesPaidTonight || st.duesSkippedTonight) return 'dues_decided';
  st.duesSkippedTonight = true;
  out.push({ type: 'DUES_SKIPPED', text: 'Rook shrugs. "Your call. Lock up tight."' });
}
export function breakInChance(st, streak) {
  let p = BAL.dues.breakBase + BAL.dues.breakStep * (streak - 1);
  p *= mult(st, 'breakInMult'); // Security Shutter: 0.5 (machine effect)
  p *= activeEffects(st).breakInMult;
  return clamp(p, 0, BAL.dues.breakCap);
}

// ---- jobs & favours ----------------------------------------------------------
export function nightJobLimit(st) {
  let n = 1;
  for (const id of st.perks) { const e = PERK[id] && PERK[id].effects; if (e && typeof e.nightJobs === 'number') n = Math.max(n, e.nightJobs); }
  return n;
}
export function nightJob(st, a, out) {
  const j = JOB[a.jobId];
  if (!j) return 'no_such_job';
  if (st.nightJobsCount >= nightJobLimit(st)) return 'job_done';
  if (!reqsMet(st, j.requires)) return 'requirements_unmet';
  st.nightJobsCount += 1;
  st.nightJobDone = true;
  const pay = randInt(st, j.pay[0] || 0, Math.max(j.pay[0] || 0, j.pay[1] || 0));
  if (pay > 0) earn(st, pay, `Night job: ${j.name}`);
  for (const [f, v] of Object.entries(j.rep || {})) changeRep(st, f, v, out);
  if (j.heat) changeHeat(st, j.heat, out);
  let failText = '';
  if (j.risk.heatSpikeChance && chance(st, j.risk.heatSpikeChance)) { changeHeat(st, 8, out); failText = (j.text && j.text.fail) || ''; }
  const got = [];
  const rolls = (j.salvageRolls || 0) + (j.salvageRolls ? perkAdd(st, 'drainSalvageBonus') : 0);
  for (let k = 0; k < rolls && j.salvageTable.length; k++) {
    const s = weighted(st, j.salvageTable, (x) => x.weight || 1);
    const loc = placeLocation(st);
    if (!loc) break;
    const def = ITEM[s.itemId];
    const flags = {};
    if (def.category === 'chrome') flags.untested = true;
    const it = makeItem(st, s.itemId, { location: loc, condition: randInt(st, 20, 90), flags, boughtFor: 0 });
    if (flags.untested) it.known = { condition: clamp(it.condition + randInt(st, -10, 15), 0, 100), untested: true };
    if (def.category === 'shard' && def.tags.includes('unknown')) assignShardContent(st, it, 'sump');
    if (def.perishableDays) it.spoilsDay = st.day + def.perishableDays;
    st.inventory.push(it); got.push(it.uid);
  }
  let injured = false;
  const inj = (j.risk.injuryChance || 0) * perkMult(st, 'injuryChanceMult');
  if (inj > 0 && chance(st, inj)) { injured = true; st.flags.injuredDay = st.day + 1; }
  const succ = j.text && Array.isArray(j.text.success) && j.text.success.length ? pick(st, j.text.success) : `${j.name}: done.`;
  const text = injured ? (j.text.injury || 'You got hurt. Slow day tomorrow.') : failText || succ;
  out.push({ type: 'NIGHT_JOB', jobId: j.id, pay, uids: got, injured, text });
}

export function contactFavor(st, a, out) {
  const npc = NPC[a.npcId];
  if (!npc) return 'no_such_contact';
  const f = (npc.favors || []).find((x) => x.id === a.favorId);
  if (!f) return 'no_such_favor';
  const key = `${a.npcId}:${a.favorId}`;
  if (st.favorsUsed.includes(key)) return 'favor_used';
  if (!reqsMet(st, f.requires)) return 'requirements_unmet';
  const cost = int(f.cost || 0);
  if (st.creds < cost) return 'insufficient_funds';
  const e = f.effects || {};
  if (e.turnInShard && !st.inventory.some((i) => i.flags.tracer || (ITEM[i.itemId] && ITEM[i.itemId].tags.includes('corp')))) return 'requirements_unmet';
  if (cost) spend(st, cost, `${npc.name}: ${f.name}`);
  st.favorsUsed.push(key);
  let text = `${npc.name}: done.`;
  if (typeof e.heat === 'number') changeHeat(st, e.heat, out, { gain: false });
  if (e.rep) for (const [fc, v] of Object.entries(e.rep)) changeRep(st, fc, v, out);
  if (e.forecastReveal) {
    st.flags.tipoffUntil = st.day + 5;
    const pend = st.events.pending || [];
    st.events.pending = pend.filter((p) => p.real).map((p) => ({ ...p, certainty: 'confirmed' }));
    st.events.forecast = st.events.pending.map((p) => ({ id: p.id, startDay: p.startDay, certainty: p.certainty }));
    text = st.events.forecast.length ? `${npc.name} tells you what's coming.` : `${npc.name}: "Quiet week ahead. Enjoy it."`;
  }
  if (e.turnInShard) {
    const it = st.inventory.find((i) => i.flags.tracer || (ITEM[i.itemId] && ITEM[i.itemId].tags.includes('corp')));
    st.inventory = st.inventory.filter((i) => i.uid !== it.uid);
    const bounty = Math.round(ITEM[it.itemId].basePrice * 0.4);
    earn(st, bounty, 'Vantage shard bounty');
    changeRep(st, 'vantage', 6, out); changeRep(st, 'static', -3, out);
    changeHeat(st, -10, out, { gain: false });
    text = `Halloran takes the shard without a word and pays ${bounty}¢.`;
  }
  if (e.blackMarket) {
    const pool = ITEMS.filter((i) => i.category === 'stolen_goods' || (i.legality === 'contraband' && !i.tags.includes('corp')));
    for (let k = 0; k < randInt(st, 2, 3) && pool.length; k++) {
      const def = pick(st, pool);
      const L = makeListing(st, def, { black: true, qty: 1 });
      if (def.category === 'stolen_goods') L.flags = { stolen: true };
      st.market.listings.push(L);
    }
    text = `${npc.name} whistles. A few crates appear in the market.`;
  }
  out.push({ type: 'FAVOR', npcId: a.npcId, favorId: a.favorId, cost, text });
}

// ---- inventory & ledger --------------------------------------------------------
export function moveItem(st, a, out) {
  const it = st.inventory.find((i) => i.uid === a.uid);
  if (!it) return 'no_such_item';
  if (!['shelf', 'storage', 'stash'].includes(a.to)) return 'bad_location';
  if (it.location === a.to) return 'same_location';
  if (freeSlots(st, a.to) <= 0) return 'no_space';
  const from = it.location;
  it.location = a.to;
  if (st.phase === 'dawn' && st.audit) st.audit = computeAudit(st);
  recalc(st);
  out.push({ type: 'ITEM_MOVED', uid: it.uid, from, to: a.to });
}

export function leaseDueNow(st) {
  if (st.lease.owned) return 0;
  if (st.lease.graceActive) return st.lease.overdue;
  return st.lease.prepaid ? 0 : st.lease.amount;
}
export function payLease(st, a, out) {
  if (st.lease.owned) return 'lease_owned';
  const amt = leaseDueNow(st);
  if (amt <= 0) return 'nothing_due';
  if (st.creds < amt) return 'insufficient_funds';
  if (st.lease.graceActive) {
    spend(st, amt, 'Overdue lease (LEASEHOLD)');
    st.lease.graceActive = false;
    st.lease.overdue = 0;
    out.push({ type: 'LEASE_PAID', amount: amt, overdue: true, text: 'LEASEHOLD: Overdue balance cleared. Thank you :)' });
  } else {
    spend(st, amt, 'Lease paid early (LEASEHOLD)');
    st.lease.prepaid = true;
    out.push({ type: 'LEASE_PAID', amount: amt, early: true, text: 'LEASEHOLD: Early payment received! You are a model tenant :)' });
  }
}

export function buyDeed(st, a, out, netWorth) {
  if (st.lease.owned) return 'deed_owned';
  if (st.creds < st.deedPrice) return 'insufficient_funds';
  spend(st, st.deedPrice, 'The Deed');
  st.lease.owned = true;
  st.lease.graceActive = false;
  st.lease.overdue = 0;
  endGame(st, deedEndingId(st), out, netWorth);
}

export function choosePerk(st, a, out) {
  if (st.perkPoints <= 0) return 'no_perk_points';
  if (!PERK[a.perkId]) return 'no_such_perk';
  if (st.perks.includes(a.perkId)) return 'already_owned';
  st.perks.push(a.perkId);
  st.perkPoints -= 1;
  recalc(st);
  out.push({ type: 'PERK_GAINED', perkId: a.perkId, text: `Perk: ${PERK[a.perkId].name}` });
}

export { illegalTrue, addFeed };
