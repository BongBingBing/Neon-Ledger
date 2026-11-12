// Neon Ledger — Lantern Syndicate "licences" (black market; require Lantern rep).
//
// Fields: id, name, faction ('lantern'), cost (¢), weeklyFee (¢, added to nightly dues as a weekly lump),
//   minRep (Lantern rep required to buy), loseBelowRep (licence is revoked if rep falls below),
//   effects, blurb, flavor

import { freezeDeep } from './util.js';

const RAW = [
  {
    id: 'knockoff', name: 'Knock-off Licence', faction: 'lantern',
    cost: 350, weeklyFee: 25, minRep: 15, loseBelowRep: -10,
    effects: { unlocksMachines: ['label_printer'], brandRaidMult: 0.6 },
    blurb: 'Permission to print labels on Lantern turf. They warn you before a brand raid. Usually.',
    flavor: "Rook hands you a matchbook. Inside: a phone number and a small drawing of a lantern.",
  },
  {
    id: 'hot_goods', name: 'Hot Goods Licence', faction: 'lantern',
    cost: 400, weeklyFee: 30, minRep: 25, loseBelowRep: 0,
    effects: { fenceSellMult: 1.15, fenceBuyMult: 0.9, hotSellerMult: 1.5 },
    blurb: 'Better fence prices both ways, and the crews bring their good stuff to you first.',
    flavor: "No paper. Just a nod on the stairs, and suddenly everyone knows you're open for business.",
  },
];

export const LICENCES = freezeDeep(RAW);
export const LICENCE_BY_ID = Object.freeze(Object.fromEntries(LICENCES.map((l) => [l.id, l])));
