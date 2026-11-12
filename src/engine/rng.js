// Seeded PRNG (mulberry32). The PRNG state is a uint32 stored in state.rng.
// All helpers take the (already cloned) game state and advance state.rng.

export function seedToRng(seed) {
  let s = (Number(seed) >>> 0) ^ 0x9e3779b9;
  // scramble a bit so small seeds diverge
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0;
  s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0;
  return (s ^ (s >>> 16)) >>> 0;
}

export function rand(st) {
  let t = (st.rng = (st.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(st, lo, hi) { // inclusive
  return lo + Math.floor(rand(st) * (hi - lo + 1));
}

export function randRange(st, lo, hi) { return lo + rand(st) * (hi - lo); }

export function chance(st, p) { return rand(st) < p; }

export function pick(st, arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(rand(st) * arr.length)];
}

export function weighted(st, arr, weightFn) {
  let total = 0;
  for (const a of arr) total += Math.max(0, weightFn(a));
  if (total <= 0) return pick(st, arr);
  let r = rand(st) * total;
  for (const a of arr) {
    r -= Math.max(0, weightFn(a));
    if (r < 0) return a;
  }
  return arr[arr.length - 1];
}

export function shuffle(st, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(st) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// derive a fresh uint32 seed (e.g. for portraits) from the stream
export function subSeed(st) { return Math.floor(rand(st) * 4294967296) >>> 0; }
