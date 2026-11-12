// Shared helpers for Neon Ledger unit tests (node:test).
// Tests are written against the CONTRACT in docs/ARCHITECTURE.md §3 and docs/DESIGN.md.
// If the engine/content module does not exist yet, dependent tests are skipped (not failed).
// If it exists but throws on import, the import error propagates (that is a real failure).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SRC = join(ROOT, 'src');

async function tryImport(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return import(pathToFileURL(p).href);
}

export const engine = await tryImport('src/engine/index.js');
export const SKIP_ENGINE = engine ? false : 'engine (src/engine/index.js) not present yet';

// Content modules: map of name -> module namespace (or null)
const CONTENT_FILES = ['items', 'brands', 'npcs', 'names', 'dialogue', 'events', 'machines', 'upgrades',
  'permits', 'licences', 'perks', 'jobs', 'recipes', 'backgrounds', 'difficulties', 'endings', 'feed'];
export const content = {};
for (const f of CONTENT_FILES) content[f] = await tryImport(`src/content/${f}.js`);

/** First exported array/object in a content module (e.g. ITEMS, BACKGROUNDS). */
export function contentExport(name, exportName) {
  const m = content[name];
  if (!m) return null;
  if (exportName && m[exportName] !== undefined) return m[exportName];
  const vals = Object.values(m).filter((v) => v && typeof v === 'object');
  return vals[0] ?? null;
}

export const DIFFICULTIES = ['drizzle', 'acid', 'downpour'];

export function backgroundIds() {
  const bgs = contentExport('backgrounds', 'BACKGROUNDS');
  if (Array.isArray(bgs) && bgs.length) return bgs.map((b) => b.id);
  if (bgs && typeof bgs === 'object') return Object.keys(bgs);
  return ['tinker', 'shard_diver', 'sparky', 'line_cook', 'fence', 'nobody'];
}

export function defaultBackground() {
  const ids = backgroundIds();
  // Prefer a "plain" background with decent starting creds for generic tests.
  return ids.find((i) => /sparky|cook|tinker/.test(i)) ?? ids[0];
}

export function fresh(opts = {}) {
  return engine.newGame({ seed: 12345, background: defaultBackground(), difficulty: 'acid', shopName: 'Test Stall', ...opts });
}

export function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}

export const clone = (o) => structuredClone(o);

/** step() that asserts no error and that the call did not throw. Returns {state, events}. */
export function act(state, action, msg) {
  const r = engine.step(state, action);
  assert.ok(r && typeof r === 'object', 'step must return an object');
  assert.ok(!r.error, `${msg ?? 'action'} ${JSON.stringify(action)} failed: ${r.error}`);
  assert.ok(Array.isArray(r.events), 'step must return events[]');
  return r;
}

/** step() that expects an error (and no throw, and state unchanged-ish). */
export function actFails(state, action) {
  let r;
  assert.doesNotThrow(() => { r = engine.step(state, action); }, `step threw on ${JSON.stringify(action)}`);
  assert.ok(r && typeof r.error === 'string' && r.error.length > 0, `expected error for ${JSON.stringify(action)}, got none`);
  return r;
}

export const legal = (s) => engine.legalActions(s);
export const hasLegal = (s, type) => legal(s).some((a) => a.type === type);
export const types = (s) => [...new Set(legal(s).map((a) => a.type))];
export const evTypes = (events) => events.map((e) => e.type);

/** Strip non-action keys (label etc.) from an ActionDescriptor. */
export function toAction(desc) {
  const { label, disabled, reason, ...rest } = desc;
  return rest;
}

/** Find a legal action of a type (optionally matching predicate). */
export function findLegal(s, type, pred = () => true) {
  const a = legal(s).find((x) => x.type === type && pred(x));
  return a ? toAction(a) : null;
}

export const S = () => engine.selectors;

/** Resolve any audit at dawn by complying. */
export function resolveAudit(s) {
  if (s.phase === 'dawn' && s.audit) s = act(s, { type: 'AUDIT_RESPOND', choice: 'comply' }).state;
  return s;
}

/** Refuse/dismiss every customer until queue empty, then close. Returns night state. */
export function skipDay(s) {
  s = resolveAudit(s);
  if (s.phase === 'dawn') s = act(s, { type: 'OPEN_SHOP' }).state;
  let guard = 0;
  while (s.phase === 'open' && guard++ < 200) {
    if (s.customer) {
      if (s.customer && s.customer.kind === 'special' && !hasLegal(s, 'REFUSE')) {
        const c = findLegal(s, 'SPECIAL_CHOICE');
        s = act(s, c).state;
        continue;
      }
      s = act(s, { type: 'REFUSE' }).state;
      continue;
    }
    s = act(s, { type: 'CLOSE_SHOP' }).state;
  }
  return s;
}

/** From any phase, sleep through to the next dawn (refusing everyone). */
export function nextDay(s, { payDues = true } = {}) {
  if (s.phase !== 'night') s = skipDay(s);
  if (payDues && hasLegal(s, 'PAY_DUES') && s.creds > (engine.selectors.duesQuote(s) ?? 0)) {
    s = act(s, { type: 'PAY_DUES' }).state;
  }
  return act(s, { type: 'SLEEP' }).state;
}

/** Item definitions from content. */
export function items() { return contentExport('items', 'ITEMS') ?? []; }
export function itemsWhere(pred) { return items().filter(pred); }

let uidCounter = 0;
/** Make an InvItem that conforms to the contract shape. */
export function makeInv(itemId, location = 'storage', extra = {}) {
  const def = items().find((i) => i.id === itemId);
  return {
    uid: `t_${itemId}_${++uidCounter}`,
    itemId, location,
    condition: 100, quality: 'A',
    flags: {}, known: {},
    boughtFor: def ? def.basePrice : 10,
    acquiredDay: 1,
    ...extra,
  };
}

/** Recursively list files under a dir. */
export function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
export const read = (p) => readFileSync(p, 'utf8');

/** Find a seed (state rng) such that predicate holds on the step result. Mutates a clone's rng only. */
export function searchRng(base, action, pred, tries = 400) {
  for (let i = 0; i < tries; i++) {
    const s = clone(base);
    s.rng = (Math.imul(i + 1, 2654435761) ^ 0x9e3779b9) >>> 0;
    const r = engine.step(s, action);
    if (!r.error && pred(r)) return { seedState: s, result: r };
  }
  return null;
}

/** Small local PRNG for test-side choices (independent of engine rng). */
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fill free-form params a descriptor may omit (OFFER price, BUY_STOCK qty). */
export function completeAction(s, desc, rnd = Math.random) {
  const a = toAction(desc);
  if (a.type === 'OFFER' && typeof a.price !== 'number') {
    const base = s.customer?.askPrice ?? 50;
    a.price = Math.max(5, Math.round((base * (0.7 + rnd() * 0.6)) / 5) * 5);
  }
  if (a.type === 'BUY_STOCK' && typeof a.qty !== 'number') a.qty = 1;
  if (a.type === 'MOVE_ITEM' && !a.to) return null;
  return a;
}

/** Random walk over legal actions. cb(prevState, action, result) per step. Returns final state. */
export function randomWalk(s, steps, seed, cb) {
  const rnd = mulberry(seed);
  for (let i = 0; i < steps && s.phase !== 'ended'; i++) {
    const opts = legal(s);
    if (!opts.length) break;
    // bias toward progress so walks cover several days
    const prog = opts.filter((o) => ['NEXT_CUSTOMER', 'OPEN_SHOP', 'CLOSE_SHOP', 'SLEEP', 'DEAL', 'ACCEPT_CHIT', 'AUDIT_RESPOND'].includes(o.type));
    const pool = prog.length && rnd() < 0.35 ? prog : opts;
    const a = completeAction(s, pool[Math.floor(rnd() * pool.length)], rnd);
    if (!a) continue;
    const r = engine.step(s, a);
    if (cb) cb(s, a, r);
    if (!r.error) s = r.state;
  }
  return s;
}

/** Put one legal item of each category onto the shelf (state setup, dawn). Returns new state clone. */
export function stockShelf(s, { legalOnly = true, n } = {}) {
  s = clone(s);
  const cats = new Map();
  for (const it of items()) {
    if (legalOnly && it.legality !== 'legal') continue;
    if (it.perishableDays) continue;
    if (!cats.has(it.category)) cats.set(it.category, []);
    cats.get(it.category).push(it);
  }
  const free = s.capacity.shelf - s.inventory.filter((i) => i.location === 'shelf').length;
  const pick = [];
  let round = 0;
  while (pick.length < (n ?? free) && round < 5) {
    for (const arr of cats.values()) { if (arr[round] && pick.length < (n ?? free)) pick.push(arr[round]); }
    round++;
  }
  for (const def of pick) s.inventory.push(makeInv(def.id, 'shelf'));
  return s;
}

/** In open phase: NEXT_CUSTOMER / REFUSE until a customer matching pred is at the counter. null if queue exhausted. */
export function advanceToCustomer(s, pred) {
  for (let g = 0; g < 60 && s.phase === 'open'; g++) {
    if (s.customer && pred(s.customer, s)) return s;
    if (s.customer) {
      const r = engine.step(s, { type: 'REFUSE' });
      if (r.error) {
        const c = findLegal(s, 'SPECIAL_CHOICE');
        if (!c) return null;
        s = engine.step(s, c).state;
      } else s = r.state;
      continue;
    }
    if (!s.queue.length) return null;
    s = act(s, { type: 'NEXT_CUSTOMER' }).state;
  }
  return null;
}

/** Search seeds for an open-phase state whose counter customer satisfies pred. */
export function findCustomer(pred, { seeds = 120, opts = {}, prep = (x) => x } = {}) {
  for (let seed = 1; seed <= seeds; seed++) {
    let s = prep(fresh({ seed, ...opts }));
    const r = engine.step(s, { type: 'OPEN_SHOP' });
    if (r.error) continue;
    const found = advanceToCustomer(r.state, pred);
    if (found) return found;
  }
  return null;
}

/** Item uids a buyer at the counter can be offered (from legalActions SELECT_ITEM). */
export function selectableUids(s) {
  return legal(s).filter((a) => a.type === 'SELECT_ITEM').map((a) => a.uid);
}

export const isBuyer = (c) => c.kind === 'buyer';
export const isSeller = (c) => c.kind === 'seller';
