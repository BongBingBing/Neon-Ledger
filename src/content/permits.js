// Neon Ledger — Vantage permits (legal; make a trade's goods legal, no Heat).
//
// Fields: id, name, faction ('vantage'), cost (¢ one-off), weeklyFee (¢, charged with the lease),
//   minRep (Vantage rep required), repDiscount (fraction off cost per +10 Vantage rep, capped by maxDiscount),
//   legalizes (items with item.permit === id become legal while held), effects, blurb, flavor

import { freezeDeep } from './util.js';

const RAW = [
  {
    id: 'med_tech', name: 'Med-Tech Resale Permit', faction: 'vantage',
    cost: 600, weeklyFee: 40, minRep: -20, repDiscount: 0.03, maxDiscount: 0.3,
    legalizes: 'med_tech', effects: { chromeRefundMult: 0.5 },
    blurb: 'Sell grade-A medical chrome without the Heat. Refund claims halved: paperwork protects you.',
    flavor: 'Seven forms, two thumbprints, and an inspector who says "mm" a lot.',
  },
  {
    id: 'power_resale', name: 'Power Resale Permit', faction: 'vantage',
    cost: 300, weeklyFee: 20, minRep: -20, repDiscount: 0.03, maxDiscount: 0.3,
    legalizes: 'power_resale', effects: {},
    blurb: 'Resell stack and brick cells legally. Does not cover what a Grid Tap does.',
    flavor: 'A sticker for your charger that reads AUTHORISED in letters that glow faintly smug.',
  },
];

export const PERMITS = freezeDeep(RAW);
export const PERMIT_BY_ID = Object.freeze(Object.fromEntries(PERMITS.map((p) => [p.id, p])));
