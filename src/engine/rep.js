// Reputation & heat changes (single place so events/perks/licence loss stay consistent).
import { LICENCE } from './content.js';
import { clamp, int } from './util.js';
import { diff, perkMult } from './modifiers.js';
import { addFeed } from './util.js';

export function changeRep(st, faction, delta, out) {
  if (!(faction in st.rep) || !delta) return 0;
  if (faction === 'sump' && delta > 0) delta = delta * perkMult(st, 'sumpRepGainMult');
  delta = Math.round(delta);
  const before = st.rep[faction];
  st.rep[faction] = clamp(before + delta, -100, 100);
  const d = st.rep[faction] - before;
  if (d) out.push({ type: 'REP_CHANGED', faction, delta: d, value: st.rep[faction] });
  // licences can be revoked when standing collapses
  for (const id of [...st.licences]) {
    const L = LICENCE[id];
    if (L && (L.faction || 'lantern') === faction && typeof L.loseBelowRep === 'number' && st.rep[faction] < L.loseBelowRep) {
      st.licences = st.licences.filter((x) => x !== id);
      const text = `${L.name} revoked.`;
      addFeed(st, 'warning', text);
      out.push({ type: 'LICENCE_REVOKED', id, text });
    }
  }
  return d;
}

// gain=true applies heat gain multipliers (difficulty, Low Profile)
export function changeHeat(st, delta, out, { gain = true } = {}) {
  if (!delta) return 0;
  if (delta > 0 && gain) delta = delta * (diff(st).heatGainMult || 1) * perkMult(st, 'heatGainMult');
  delta = Math.round(delta);
  const before = st.heat;
  st.heat = clamp(int(before + delta), 0, 100);
  const d = st.heat - before;
  if (d) out.push({ type: 'HEAT_CHANGED', delta: d, heat: st.heat });
  return d;
}
