// Endings.
import { ENDING } from './content.js';

const FALLBACK = {
  deed_vantage: ['Franchise of the Spire', true], deed_lantern: ['Made in the Sump', true],
  deed_static: ['Free Node', true], deed_sump: ['Heart of the Stairwell', true],
  deed_plain: ['Your Own Name on the Door', true], evicted: ['Evicted', false], arrested: ['Arrested', false],
  taken_for_ride: ['Taken for a Ride', false], underwater: ['Underwater', false],
};

export function deedEndingId(st) {
  let best = null; let bestV = 39;
  for (const f of ['vantage', 'lantern', 'static', 'sump']) if (st.rep[f] > bestV) { best = f; bestV = st.rep[f]; }
  return best ? `deed_${best}` : 'deed_plain';
}

export function endingStats(st) {
  return {
    daysSurvived: st.day, netWorth: null, creds: st.creds, bestSale: st.stats.bestSale,
    customersServed: st.stats.customersServed, ghostChitsCaught: st.stats.ghostChitsCaught,
    auditsSurvived: st.stats.auditsSurvived, rep: { ...st.rep }, totalEarned: st.stats.totalEarned,
  };
}

export function endGame(st, id, out, netWorthFn) {
  const def = ENDING[id] || {};
  const fb = FALLBACK[id] || [id, false];
  const win = def.win !== undefined ? !!def.win : fb[1];
  const stats = endingStats(st);
  if (netWorthFn) stats.netWorth = netWorthFn(st);
  st.ending = { id, title: def.title || fb[0], text: def.text || def.body || '', win, stats };
  st.phase = 'ended';
  st.customer = null; st.queue = []; st.inspection = null;
  out.push({ type: 'ENDING', id, win, text: st.ending.title });
}
