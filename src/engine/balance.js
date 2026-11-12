// Global tuning knobs (engine-owned). Content-specific numbers live in src/content.
export const BAL = Object.freeze({
  startCreds: 400,
  lease: { base: 350, period: 7, growth: 1.15, lateFee: 1.25 },
  deedPrice: 30000,
  capacity: { shelf: 6, storage: 10, stash: 0, shelfMax: 12, storageMax: 30, stashMax: 6 },

  // customers
  customersBase: 6, customersPerAppeal: 10, customersCap: 14,
  kindWeights: { buyer: 62, seller: 34, special: 4 },
  patience: [3, 5],
  outrageous: 0.35,              // >35% past limit costs 2 patience
  buyerReservation: [1.0, 1.4],  // × item value
  buyerOpening: [0.55, 0.8],     // opening bid × reservation
  sellerReservation: [0.45, 0.7],// × true value of their item (min price)
  sellerOpening: [1.35, 1.8],    // opening ask × reservation
  counterStep: [0.35, 0.6],      // how far the customer moves toward their limit per counter
  repPriceShift: 0.10,           // ±10% at ±100 rep
  chitShare: 0.7,                // share of non-ghost buyers paying by chit (rest cash)
  ghostChit: { start: 0.06, end: 0.15, endDay: 40 },
  undercover: { heatMin: 30, chance: 0.05 },
  verifierShare: 0.3,
  priceSnap: 5,

  // values
  qualityMult: { A: 1.3, B: 1.0, C: 0.7 },
  conditionFloor: 0.3,           // value mult at condition 0
  marketBuy: [0.5, 0.72],        // supplier price × base
  marketSell: 0.4,               // dump price × value
  marketListings: [8, 11],

  // heat
  heat: {
    illegalShelf: 2, tracerHeld: 5, gridTap: 4, decay: 5,
    sellContraband: [3, 8], sellHot: 10, undercoverSale: 25, failedReport: 4,
    auditThreshold: 60, crackdownThreshold: 40, afterAudit: 20, stashCheckHeat: 80,
  },
  audit: { fineMult: 1.5, bribeShare: 0.2, bribeBase: 0.5, arrestValue: 1000 },

  dues: { min: 15, share: 0.05, breakBase: 0.25, breakStep: 0.10, breakCap: 0.9, shutterMult: 0.5 },

  underwater: { debt: -2000, days: 3 },
  takenForRide: { lantern: -60, skips: 5 },

  bounty: { min: 25, share: 0.3 },
  machineBreakChance: 0.02,
  fireChance: 0.03,
  foodPoisonChance: 0.15,
  untestedReturnChance: 0.5,
  hotListAddChance: 0.15,
  historyKeep: 60,
});

export function difficultyDefaults(id) {
  switch (id) {
    case 'drizzle': return { id, leaseGrowth: 1.10, deedMult: 0.8, patience: 1, heatMult: 0.75, ghostMult: 0.8 };
    case 'downpour': return { id, leaseGrowth: 1.20, deedMult: 1.25, patience: -1, heatMult: 1.0, ghostMult: 1.4 };
    default: return { id: 'acid', leaseGrowth: 1.15, deedMult: 1.0, patience: 0, heatMult: 1.0, ghostMult: 1.0 };
  }
}
