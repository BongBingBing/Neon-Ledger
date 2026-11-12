// Neon Ledger — perks (1 perk point per week survived; DESIGN §8).
//
// Fields: id, name, effects (engine-readable modifiers), blurb (rules text), flavor

import { freezeDeep } from './util.js';

const RAW = [
  { id: 'silver_tongue', name: 'Silver Tongue', effects: { patienceBonus: 1 },
    blurb: 'Every customer has +1 patience.', flavor: 'You could talk rain back into the clouds.' },
  { id: 'eagle_eye', name: 'Eagle Eye', effects: { highlightChitField: true },
    blurb: 'One suspicious field on a ghost chit is highlighted.', flavor: 'Wrong letters itch at you now.' },
  { id: 'low_profile', name: 'Low Profile', effects: { heatGainMult: 0.75 },
    blurb: 'All Heat gains −25%.', flavor: 'Even the cameras forget your face.' },
  { id: 'night_owl', name: 'Night Owl', effects: { nightJobs: 2 },
    blurb: 'Take two night jobs per night.', flavor: 'Sleep is a rumour someone told you once.' },
  { id: 'thrifty', name: 'Thrifty', effects: { supplierPriceMult: 0.9 },
    blurb: 'Supplier prices −10%.', flavor: 'You haggle with vending machines. Sometimes you win.' },
  { id: 'good_neighbour', name: 'Good Neighbour', effects: { sumpRepGainMult: 1.5 },
    blurb: 'Sump Folk rep gains +50%.', flavor: 'You remember everyone’s birthday. Even the cat’s.' },
  { id: 'iron_stomach', name: 'Iron Stomach', effects: { poisonChanceMult: 0.5, spoilDaysBonus: 1 },
    blurb: 'Food lasts 1 day longer; food-poisoning risk halved.', flavor: 'You taste-test everything. Everything.' },
  { id: 'steady_hands', name: 'Steady Hands', effects: { probeBonus: 2, refurbFailMult: 0 },
    blurb: '+2 probes in the Probe mini-game; refurbs never fail.', flavor: 'Your pulse slows when the solder heats.' },
  { id: 'cold_read', name: 'Cold Read', effects: { showReservationHint: true },
    blurb: 'See whether your offer is near a customer’s limit (warm/cold).', flavor: 'People price themselves in their eyebrows.' },
  { id: 'greased_palm', name: 'Greased Palm', effects: { bribeChanceBonus: 0.15, bribeCostMult: 0.8 },
    blurb: 'Bribes +15% success and cost −20%.', flavor: 'You know exactly how thick an envelope should be.' },
  { id: 'scavenger', name: 'Scavenger', effects: { drainSalvageBonus: 1, injuryChanceMult: 0.5 },
    blurb: 'Drain diving yields +1 find; injury chance halved.', flavor: 'You can smell copper through two feet of water.' },
  { id: 'quiet_wires', name: 'Quiet Wires', effects: { tracerHeatMult: 0.5, gridFireMult: 0.5 },
    blurb: 'Tracer shards and Grid Tap make half the Heat; tap fire risk halved.', flavor: 'Lead foil, ground loops, and a lot of patience.' },
];

export const PERKS = freezeDeep(RAW);
export const PERK_BY_ID = Object.freeze(Object.fromEntries(PERKS.map((p) => [p.id, p])));
