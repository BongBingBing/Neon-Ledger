// Content adapter: loads src/content/*.js when present, otherwise falls back to
// src/engine/fallbackContent.js. Normalises / validates so the engine can rely on fields.
// (Top-level await: content modules are loaded once, before the engine is usable.)
import * as FB from './fallbackContent.js';

const FILES = {
  ITEMS: 'items.js', BRANDS: 'brands.js', MACHINES: 'machines.js', RECIPES: 'recipes.js',
  UPGRADES: 'upgrades.js', PERMITS: 'permits.js', LICENCES: 'licences.js', PERKS: 'perks.js',
  JOBS: 'jobs.js', NPCS: 'npcs.js', NAMES: 'names.js', DIALOGUE: 'dialogue.js', EVENTS: 'events.js',
  BACKGROUNDS: 'backgrounds.js', DIFFICULTIES: 'difficulties.js', ENDINGS: 'endings.js', FEED: 'feed.js',
};

async function tryImport(file) {
  try { return await import(`../content/${file}`); } catch { return null; }
}

function pickExport(mod, key) {
  if (!mod) return undefined;
  if (mod[key] !== undefined) return mod[key];
  if (mod.default !== undefined) return mod.default;
  const k = Object.keys(mod).find((n) => n === n.toUpperCase() && !n.endsWith('_BY_ID'));
  return k ? mod[k] : undefined;
}

const loaded = {};
export const SOURCES = {};
export const RAW_MODULES = {};
await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
  const mod = await tryImport(file);
  RAW_MODULES[key] = mod;
  const v = pickExport(mod, key);
  const ok = v !== undefined && v !== null && (Array.isArray(FB[key]) ? Array.isArray(v) && v.length > 0 : typeof v === 'object');
  loaded[key] = ok ? v : FB[key];
  SOURCES[key] = ok ? 'content' : 'fallback';
}));

const arr = (x) => (Array.isArray(x) ? x : []);
const byId = (list) => Object.fromEntries(arr(list).map((x) => [x.id, x]));
const num = (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);

// normalise a `requires` block: { machines:[], upgrades:[], licence, permit, rep:{} }
function normReq(r) {
  r = r || {};
  const out = { machines: [], upgrades: [], licences: [], permits: [], rep: {}, ...r };
  if (r.machine) out.machines = [...arr(r.machines), r.machine];
  if (r.upgrade) out.upgrades = [...arr(r.upgrades), r.upgrade];
  if (r.licence) out.licences = [...arr(r.licences), r.licence];
  if (r.permit) out.permits = [...arr(r.permits), r.permit];
  out.machines = arr(out.machines); out.upgrades = arr(out.upgrades);
  out.licences = arr(out.licences); out.permits = arr(out.permits);
  out.rep = r.rep && typeof r.rep === 'object' ? r.rep : {};
  return out;
}

// ---- items ----
export const ITEMS = arr(loaded.ITEMS).map((it) => ({
  size: 1, legality: 'legal', market: 0, buyers: [], ...it,
  basePrice: Math.max(1, Math.round(num(it.basePrice, 1))),
  tags: arr(it.tags), buyers: arr(it.buyers),
}));
export const ITEM = byId(ITEMS);
export const CATEGORIES = ['power', 'food', 'salvage', 'sundry', 'chrome', 'shard', 'luxury', 'tech', 'stolen_goods'];

export const BRANDS = arr(loaded.BRANDS).map((b) => ({
  ...b,
  marks: arr(b.marks),
  fakeMarksBySlot: Array.isArray(b.fakeMarksBySlot) && b.fakeMarksBySlot.length === 3
    ? b.fakeMarksBySlot.map(arr)
    : [0, 1, 2].map((i) => (arr(b.fakeMarks)[i] ? [arr(b.fakeMarks)[i]] : [`${arr(b.marks)[i] || 'mark'} (smudged)`])),
}));
export const BRAND = byId(BRANDS);

export const MACHINES = arr(loaded.MACHINES).map((m) => ({
  kind: 'workshop', powerPerNight: 0, breakdownChance: 0, repairCost: 0, ...m,
  cost: Math.round(num(m.cost ?? m.price, 100)),
  requires: normReq(m.requires), effects: m.effects || {},
}));
export const MACHINE = byId(MACHINES);

function inputOk(inp) {
  if (!inp || !(num(inp.qty, 1) >= 1)) return false;
  if (inp.itemId) return !!ITEM[inp.itemId];
  return !!(inp.category || inp.tag);
}
export const RECIPES = arr(loaded.RECIPES)
  .map((r) => ({
    kind: 'craft', days: 1, powerCost: 0, partsCost: 0, maxBatch: 1, outputs: [], outcomes: [], risk: {}, ...r,
    machineId: r.machineId || r.machine,
    inputs: arr(r.inputs).map((i) => ({ qty: 1, ...i, qty: Math.max(1, Math.round(num(i.qty, 1))), exclude: arr(i.exclude) })),
    outputs: arr(r.outputs), outcomes: arr(r.outcomes), risk: r.risk || {},
    days: Math.max(1, Math.round(num(r.days, 1))), maxBatch: Math.max(1, Math.round(num(r.maxBatch, 1))),
  }))
  .filter((r) => MACHINE[r.machineId] && r.inputs.length > 0 && r.inputs.every(inputOk)
    && r.outputs.every((o) => ITEM[o.itemId]) && r.outcomes.every((o) => ITEM[o.itemId])
    && (r.kind === 'refurb' || r.outputs.length > 0 || r.outcomes.length > 0));
export const RECIPE = byId(RECIPES);

export const UPGRADES = arr(loaded.UPGRADES).map((u) => ({ ...u, cost: Math.round(num(u.cost ?? u.price, 100)), requires: normReq(u.requires), effects: u.effects || {} }));
export const UPGRADE = byId(UPGRADES);
export const PERMITS = arr(loaded.PERMITS).map((p) => ({ weeklyFee: 0, minRep: -100, repDiscount: 0, maxDiscount: 0, ...p, cost: Math.round(num(p.cost ?? p.price, 100)), legalizes: p.legalizes || p.id, effects: p.effects || {} }));
export const PERMIT = byId(PERMITS);
export const LICENCES = arr(loaded.LICENCES).map((l) => ({ weeklyFee: 0, minRep: -100, loseBelowRep: -101, faction: 'lantern', ...l, cost: Math.round(num(l.cost ?? l.price, 100)), effects: l.effects || {} }));
export const LICENCE = byId(LICENCES);
export const PERKS = arr(loaded.PERKS).map((p) => ({ ...p, effects: p.effects || {} }));
export const PERK = byId(PERKS);
export const JOBS = arr(loaded.JOBS).map((j) => ({ pay: [0, 0], rep: {}, heat: 0, salvageRolls: 0, salvageTable: [], text: {}, ...j, requires: normReq(j.requires), risk: j.risk || {}, salvageTable: arr(j.salvageTable).filter((s) => ITEM[s.itemId]) }));
export const JOB = byId(JOBS);

// NPCs: if content gives none, use fallback; favours fall back to engine defaults per id.
const fbNpc = byId(FB.NPCS);
export const NPCS = arr(loaded.NPCS).map((n) => ({
  lines: {}, portraitTraits: {}, ...n,
  favors: (Array.isArray(n.favors) ? n.favors : (fbNpc[n.id] && fbNpc[n.id].favors) || []).map((f) => ({ cost: 0, effects: {}, ...f, requires: normReq(f.requires) })),
}));
export const NPC = byId(NPCS);

function normNames(n) {
  const fb = FB.NAMES;
  if (!n || typeof n !== 'object') return fb;
  const first = n.first && typeof n.first === 'object' ? n.first : fb.first;
  const last = arr(n.last).length ? n.last : fb.last;
  const wardsRaw = arr(n.wards).filter((w) => w && w.code);
  return { ...n, first, last, wards: wardsRaw.length ? wardsRaw : fb.wards };
}
export const NAMES = normNames(loaded.NAMES);
export const DIALOGUE = { ...FB.DIALOGUE, ...(loaded.DIALOGUE && typeof loaded.DIALOGUE === 'object' ? loaded.DIALOGUE : {}) };

export const EVENTS = arr(loaded.EVENTS).map((e) => ({
  durationDays: [1, 2], weight: 1, minDay: 1, ...e, effects: e.effects || {}, feedText: e.feedText || {},
}));
export const EVENT = byId(EVENTS);

export const BACKGROUNDS = arr(loaded.BACKGROUNDS).map((b) => ({
  machines: [], rep: {}, capacity: {}, ...b,
  startInventory: arr(b.startInventory || b.items).filter((s) => ITEM[s.itemId]),
}));
export const BACKGROUND = byId(BACKGROUNDS);
export const DIFFICULTIES = arr(loaded.DIFFICULTIES).map((d) => ({
  leaseBase: 350, leaseGrowth: 1.15, lateFee: 0.25, deedPrice: 30000, patienceMod: 0, heatGainMult: 1,
  ghostChitMult: 1, auditThreshold: 60, crackdownThreshold: 40, undercoverMinHeat: 30, priceMult: 1, ...d,
}));
export const DIFFICULTY = byId(DIFFICULTIES);
export const ENDINGS = arr(loaded.ENDINGS);
export const ENDING = byId(ENDINGS);
export const FEED = { ...FB.FEED, ...(loaded.FEED && typeof loaded.FEED === 'object' ? loaded.FEED : {}) };
