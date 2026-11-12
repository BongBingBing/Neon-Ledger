// localStorage adapter (ARCHITECTURE §4.4). Every access wrapped in try/catch:
// iOS private mode / storage-disabled contexts may throw on any call.

const PREFIX = 'neonledger.';
export const SLOTS = ['auto', '1', '2', '3'];

const memory = new Map(); // fallback when localStorage is unavailable

function ls() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const k = PREFIX + '__probe';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

function getRaw(key) {
  const s = ls();
  try {
    if (s) return s.getItem(PREFIX + key);
  } catch { /* fall through */ }
  return memory.has(key) ? memory.get(key) : null;
}

function setRaw(key, value) {
  const s = ls();
  try {
    if (s) { s.setItem(PREFIX + key, value); return true; }
  } catch { /* quota or disabled */ }
  memory.set(key, value);
  return false;
}

function removeRaw(key) {
  const s = ls();
  try { if (s) s.removeItem(PREFIX + key); } catch { /* ignore */ }
  memory.delete(key);
}

export function isPersistent() {
  return !!ls();
}

/** Save a serialized game string. meta: {shopName, day, creds} shown in slot lists. */
export function save(slot, str, meta = {}) {
  if (!SLOTS.includes(String(slot))) return false;
  const ok = setRaw('save.' + slot, str);
  setRaw('meta.' + slot, JSON.stringify({ ...meta, savedAt: Date.now() }));
  return ok;
}

export function load(slot) {
  return getRaw('save.' + slot);
}

export function remove(slot) {
  removeRaw('save.' + slot);
  removeRaw('meta.' + slot);
}

export function listSlots() {
  const out = [];
  for (const slot of SLOTS) {
    const data = getRaw('save.' + slot);
    if (!data) continue;
    let meta = {};
    try { meta = JSON.parse(getRaw('meta.' + slot) || '{}') || {}; } catch { meta = {}; }
    out.push({
      slot,
      shopName: meta.shopName ?? '???',
      day: meta.day ?? 0,
      creds: meta.creds ?? 0,
      savedAt: meta.savedAt ?? 0,
    });
  }
  return out;
}

const DEFAULT_SETTINGS = Object.freeze({ sound: true, music: true, reducedMotion: 'auto', haptics: true, textSpeed: 'normal' });

export function loadSettings() {
  try {
    const raw = getRaw('settings');
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(obj) {
  try { setRaw('settings', JSON.stringify(obj)); } catch { /* ignore */ }
}
