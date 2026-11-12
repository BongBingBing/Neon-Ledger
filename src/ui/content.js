// Loads display content from src/content/ (owned by the Content Writer).
// Each module is imported independently so a missing/broken file never breaks the UI.

const MODULES = [
  'items', 'brands', 'npcs', 'names', 'dialogue', 'events', 'machines', 'upgrades', 'permits',
  'licences', 'perks', 'jobs', 'recipes', 'backgrounds', 'difficulties', 'endings', 'feed', 'factions', 'favors',
];

export const C = {};       // C.items -> array/object exported by items.js (first UPPERCASE export)
export const MOD = {};     // MOD.items -> full module namespace

export async function loadContent() {
  await Promise.all(MODULES.map(async (name) => {
    try {
      const mod = await import(`../content/${name}.js`);
      MOD[name] = mod;
      const key = Object.keys(mod).find((k) => k === name.toUpperCase())
        ?? Object.keys(mod).find((k) => /^[A-Z][A-Z_]+$/.test(k))
        ?? 'default';
      C[name] = mod[key];
    } catch {
      C[name] = null;
    }
  }));
  buildIndexes();
}

const idx = {};
function toArray(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (typeof x === 'object') return Object.entries(x).map(([id, v]) => (v && typeof v === 'object' ? { id, ...v } : { id, value: v }));
  return [];
}
function buildIndexes() {
  for (const name of MODULES) {
    const m = new Map();
    for (const e of toArray(C[name])) if (e && e.id != null) m.set(e.id, e);
    idx[name] = m;
  }
}

export function list(name) { return toArray(C[name]); }
export function get(name, id) { return idx[name]?.get(id) ?? null; }

/** Human-readable name for any content id with graceful fallback. */
export function nameOf(name, id) {
  const e = get(name, id);
  return e?.name ?? e?.title ?? e?.label ?? prettify(id);
}

export function prettify(id) {
  return String(id ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function itemDef(id) {
  return get('items', id);
}

/** Pick a random line from a dialogue pool (UI-flavour only, e.g. refusal reply). */
export function line(pool, vars = {}, seed = 0) {
  const d = C.dialogue;
  let arr = d && (Array.isArray(d) ? d.filter((x) => x.key === pool) : d[pool]);
  if (!arr || !arr.length) return null;
  const pick = arr[Math.abs(seed) % arr.length];
  const text = typeof pick === 'string' ? pick : pick.text;
  return String(text).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}
