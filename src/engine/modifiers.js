// Aggregated modifiers from perks / upgrades / licences / permits / machines / difficulty.
import { PERK, UPGRADE, LICENCE, PERMIT, MACHINE, DIFFICULTY } from './content.js';
import { BAL } from './balance.js';

const DEFAULT_DIFF = {
  id: 'acid', leaseBase: BAL.lease.base, leaseGrowth: 1.15, lateFee: 0.25, deedPrice: BAL.deedPrice, patienceMod: 0,
  heatGainMult: 1, ghostChitMult: 1, auditThreshold: 60, crackdownThreshold: 40, undercoverMinHeat: 30, priceMult: 1,
};
export function diff(st) { return DIFFICULTY[st.difficulty] || DIFFICULTY.acid || DEFAULT_DIFF; }

function sources(st) {
  const out = [];
  for (const id of st.perks || []) if (PERK[id]) out.push(PERK[id].effects);
  for (const id of st.upgrades || []) if (UPGRADE[id]) out.push(UPGRADE[id].effects);
  for (const id of st.licences || []) if (LICENCE[id]) out.push(LICENCE[id].effects);
  for (const id of st.permits || []) if (PERMIT[id]) out.push(PERMIT[id].effects);
  for (const [id, m] of Object.entries(st.machines || {})) if (m && m.owned && !m.broken && MACHINE[id]) out.push(MACHINE[id].effects);
  return out.filter(Boolean);
}

// Multiplicative effect (keys ending in Mult): product, default 1
export function mult(st, key) {
  let v = 1;
  for (const e of sources(st)) if (typeof e[key] === 'number') v *= e[key];
  return v;
}
// Additive effect (Bonus / counts): sum, default 0
export function add(st, key) {
  let v = 0;
  for (const e of sources(st)) if (typeof e[key] === 'number') v += e[key];
  return v;
}
export function flag(st, key) { return sources(st).some((e) => !!e[key]); }

export function perkFlag(st, key) {
  return (st.perks || []).some((id) => PERK[id] && PERK[id].effects && PERK[id].effects[key]);
}
export function perkMult(st, key) {
  let v = 1;
  for (const id of st.perks || []) { const e = PERK[id] && PERK[id].effects; if (e && typeof e[key] === 'number') v *= e[key]; }
  return v;
}
export function perkAdd(st, key) {
  let v = 0;
  for (const id of st.perks || []) { const e = PERK[id] && PERK[id].effects; if (e && typeof e[key] === 'number') v += e[key]; }
  return v;
}

export function machineOwned(st, id) { return !!(st.machines[id] && st.machines[id].owned); }
export function machineWorking(st, id) { return machineOwned(st, id) && !st.machines[id].broken; }
