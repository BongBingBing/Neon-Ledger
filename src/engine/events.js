// World events calendar: active effects, forecasting, activation (resolved at SLEEP).
import { EVENTS, EVENT } from './content.js';
import { rand, randInt, weighted, chance } from './rng.js';
import { addFeed } from './util.js';

const MULT_KEYS = ['traffic', 'undercoverMult', 'duesMult', 'breakInMult', 'spireMult', 'tracerMult', 'ghostMult', 'buyPriceMult'];

export function activeEffects(st) {
  const fx = { demand: {}, buyPrice: {}, traffic: 1, undercoverMult: 1, duesMult: 1, breakInMult: 1, spireMult: 1, tracerMult: 1, ghostMult: 1, buyPriceMult: 1, auditThreshold: null, brandRaids: 0 };
  const act = (st.events && st.events.active) || [];
  for (const a of act) {
    const ev = EVENT[a.id];
    if (!ev) continue;
    const e = ev.effects || {};
    for (const [cat, m] of Object.entries(e.demand || {})) fx.demand[cat] = (fx.demand[cat] || 1) * m;
    for (const [cat, m] of Object.entries(e.buyPrice || e.priceMult || {})) if (typeof m === 'number') fx.buyPrice[cat] = (fx.buyPrice[cat] || 1) * m;
    for (const k of MULT_KEYS) if (typeof e[k] === 'number') fx[k] *= e[k];
    if (typeof e.auditThreshold === 'number') fx.auditThreshold = fx.auditThreshold === null ? e.auditThreshold : Math.min(fx.auditThreshold, e.auditThreshold);
    if (typeof e.brandRaids === 'number') fx.brandRaids = Math.max(fx.brandRaids, e.brandRaids);
  }
  return fx;
}

export function isActive(st, id) { return ((st.events && st.events.active) || []).some((a) => a.id === id); }

function certaintyFor(st) {
  const best = Math.max(st.rep.static || 0, st.rep.sump || 0);
  if (best >= 30 || (st.flags && st.flags.tipoffUntil >= st.day)) return 'confirmed';
  if (best >= 10) return 'likely';
  return 'rumour';
}

// Called at SLEEP after day has advanced (st.day = new day). Returns events emitted.
export function advanceCalendar(st, out) {
  const ev = st.events;
  ev.pending = ev.pending || [];
  // expire
  const still = [];
  for (const a of ev.active) {
    if (a.untilDay < st.day) {
      const def = EVENT[a.id];
      out.push({ type: 'EVENT_ENDED', id: a.id, text: def && def.feedText.end ? def.feedText.end : undefined });
      if (def && def.feedText.end) addFeed(st, 'news', def.feedText.end);
    } else still.push(a);
  }
  ev.active = still;
  // activate pending whose startDay arrived
  const keep = [];
  for (const p of ev.pending) {
    if (p.startDay <= st.day) {
      if (p.real) startEvent(st, p.id, out);
      else addFeed(st, 'news', 'The rumours came to nothing.');
    } else keep.push(p);
  }
  ev.pending = keep;
  ev.forecast = ev.pending.map((p) => ({ id: p.id, startDay: p.startDay, certainty: p.certainty }));
  // roll new
  if (EVENTS.length && ev.pending.length < 2 && chance(st, 0.28)) {
    const busy = new Set([...ev.active.map((a) => a.id), ...ev.pending.map((p) => p.id)]);
    const pool = EVENTS.filter((e) => (e.minDay || 1) <= st.day && !busy.has(e.id) && (e.weight || 0) > 0);
    if (pool.length) {
      const def = weighted(st, pool, (e) => e.weight || 1);
      if (chance(st, 0.12)) {
        startEvent(st, def.id, out); // surprise
      } else {
        const certainty = certaintyFor(st);
        const real = certainty === 'confirmed' ? true : certainty === 'likely' ? rand(st) < 0.85 : rand(st) < 0.65;
        const p = { id: def.id, startDay: st.day + randInt(st, 1, 3), certainty, real };
        ev.pending.push(p);
        ev.forecast.push({ id: p.id, startDay: p.startDay, certainty });
        const txt = def.feedText.forecast || `${def.name} expected soon.`;
        addFeed(st, 'news', `[${certainty}] ${txt}`);
        out.push({ type: 'EVENT_FORECAST', id: def.id, startDay: p.startDay, certainty });
      }
    }
  }
}

export function startEvent(st, id, out) {
  const def = EVENT[id];
  if (!def) return;
  const [lo, hi] = Array.isArray(def.durationDays) ? def.durationDays : [1, 1];
  const dur = randInt(st, Math.max(1, lo), Math.max(lo, hi));
  st.events.active.push({ id, untilDay: st.day + dur - 1 });
  const e = def.effects || {};
  if (typeof e.leaseHike === 'number' && st.lease && !st.lease.owned) {
    st.lease.amount = Math.round(st.lease.amount * (1 + e.leaseHike));
  }
  const txt = def.feedText.start || `${def.name} has begun.`;
  addFeed(st, 'news', txt);
  out.push({ type: 'EVENT_STARTED', id, untilDay: st.day + dur - 1, text: txt });
}
