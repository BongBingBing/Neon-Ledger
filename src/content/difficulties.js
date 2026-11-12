// Neon Ledger — difficulties (DESIGN §5, §7, §10, §13). Ids canonical (ARCHITECTURE R8).
//
// Fields:
//   leaseBase       : first week's lease (¢)
//   leaseGrowth     : weekly lease multiplier
//   lateFee         : fraction added to a missed lease (grace)
//   deedPrice       : ¢ to buy the Deed (win)
//   patienceMod     : added to every customer's patience pips
//   heatGainMult    : multiplier on all Heat gains
//   ghostChitMult   : multiplier on ghost-chit frequency (base 6% day 1 → 15% day 40)
//   auditThreshold  : Heat at which an audit becomes pending (Crackdown lowers to crackdownThreshold)
//   undercoverMinHeat: Heat above which undercover auditors may appear
//   priceMult       : supplier price multiplier (tuning guess, 1 = neutral)

import { freezeDeep } from './util.js';

const RAW = [
  {
    id: 'drizzle', name: 'Drizzle', tagline: 'Easy. The rain is almost pleasant.',
    leaseBase: 350, leaseGrowth: 1.10, lateFee: 0.25, deedPrice: 24000,
    patienceMod: 1, heatGainMult: 0.75, ghostChitMult: 1.0,
    auditThreshold: 60, crackdownThreshold: 40, undercoverMinHeat: 30, priceMult: 1.0,
    description: 'Slower lease growth, patient customers, a forgetful Vantage. Deed: 24,000¢.',
  },
  {
    id: 'acid', name: 'Acid Rain', tagline: 'Normal. It stings a little.',
    leaseBase: 350, leaseGrowth: 1.15, lateFee: 0.25, deedPrice: 30000,
    patienceMod: 0, heatGainMult: 1.0, ghostChitMult: 1.0,
    auditThreshold: 60, crackdownThreshold: 40, undercoverMinHeat: 30, priceMult: 1.0,
    description: 'The Sump as it is. Lease +15% a week. Deed: 30,000¢.',
  },
  {
    id: 'downpour', name: 'Downpour', tagline: 'Hard. Bring a bucket.',
    leaseBase: 350, leaseGrowth: 1.20, lateFee: 0.25, deedPrice: 37500,
    patienceMod: -1, heatGainMult: 1.0, ghostChitMult: 1.5,
    auditThreshold: 60, crackdownThreshold: 40, undercoverMinHeat: 30, priceMult: 1.0,
    description: 'Lease +20% a week, short tempers, more ghost chits. Deed: 37,500¢.',
  },
];

export const DIFFICULTIES = freezeDeep(RAW);
export const DIFFICULTY_BY_ID = Object.freeze(Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d])));
