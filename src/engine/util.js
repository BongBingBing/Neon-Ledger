// Small shared helpers (pure, operate on the cloned state passed in).
import { rand, pick } from './rng.js';
import { DIALOGUE } from './content.js';
import { BAL } from './balance.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const int = (v) => Math.round(Number(v) || 0);
export const snapDown = (v, s = BAL.priceSnap) => Math.max(s, Math.floor(v / s) * s);
export const snapUp = (v, s = BAL.priceSnap) => Math.max(s, Math.ceil(v / s) * s);
export const snap = (v, s = BAL.priceSnap) => Math.max(s, Math.round(v / s) * s);

export function clone(x) {
  return typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x));
}

export function fill(tpl, vars = {}) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

// pick a dialogue line from a pool, optionally filtered by faction/mood
export function line(st, key, vars = {}, filter = {}) {
  let pool = DIALOGUE[key];
  if (!Array.isArray(pool) || pool.length === 0) return '';
  pool = pool.map((p) => (typeof p === 'string' ? { text: p } : p));
  let f = pool.filter((p) => (!p.faction || p.faction === filter.faction) && (!p.mood || p.mood === filter.mood));
  if (f.length === 0) f = pool;
  const specific = f.filter((p) => p.faction && p.faction === filter.faction);
  const chosen = specific.length && rand(st) < 0.5 ? pick(st, specific) : pick(st, f);
  return fill(chosen && chosen.text, vars);
}

export function nextUid(st, prefix = 'i') {
  st.counters = st.counters || { uid: 1, customer: 1, inspection: 1 };
  const k = prefix === 'c' ? 'customer' : prefix === 'x' ? 'inspection' : 'uid';
  const n = st.counters[k] || 1;
  st.counters[k] = n + 1;
  return `${prefix}${n}`;
}

export function addFeed(st, kind, text, from) {
  if (!text) return;
  const e = { day: st.day, kind, text };
  if (from) e.from = from;
  st.feed.push(e);
  if (st.feed.length > 80) st.feed.splice(0, st.feed.length - 80);
}

// money helpers keep dayLog + stats consistent
export function earn(st, amount, label) {
  amount = int(amount);
  if (amount === 0) return;
  st.creds += amount;
  st.dayLog.income += amount;
  st.dayLog.lines.push({ label, amount });
  st.stats.totalEarned += amount;
}
export function spend(st, amount, label) {
  amount = int(amount);
  if (amount === 0) return;
  st.creds -= amount;
  st.dayLog.expenses += amount;
  st.dayLog.lines.push({ label, amount: -amount });
  st.stats.totalSpent += amount;
}
export function logLine(st, label, amount = 0) { st.dayLog.lines.push({ label, amount: int(amount) }); }

export function hasPerk(st, id) { return st.perks.includes(id); }
