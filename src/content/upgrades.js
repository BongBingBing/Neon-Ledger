// Neon Ledger — shop upgrades (bought at night). One-off purchases.
//
// Fields: id, name, cost (¢), requires: { upgrades?: [ids], machines?: [ids] },
//   effects: { shelf?, storage?, stash? (added capacity), appeal?, spoilDaysBonus?, chargeBatchBonus?,
//              refurbConditionBonus?, referenceIndex?, chitLamp?, ... }, blurb, flavor
// Capacity targets (DESIGN §8): shelf 6 → 12, storage 10 → 30, stash 0 → 2 (Floor Cavity) → 4 → 6.

import { freezeDeep } from './util.js';

const RAW = [
  // Shelf 6 → 12
  { id: 'shelf_1', name: 'Extra Shelf Bracket', cost: 150, requires: {}, effects: { shelf: 2 },
    blurb: 'Shelf +2 (8).', flavor: 'Two more hooks and a plank that only wobbles a bit.' },
  { id: 'shelf_2', name: 'Fold-Out Display', cost: 300, requires: { upgrades: ['shelf_1'] }, effects: { shelf: 2 },
    blurb: 'Shelf +2 (10).', flavor: 'Swings out over the stairwell. Mind your head.' },
  { id: 'shelf_3', name: 'Glass Counter Case', cost: 550, requires: { upgrades: ['shelf_2'] }, effects: { shelf: 2, appeal: 3 },
    blurb: 'Shelf +2 (12), Appeal +3.', flavor: 'Real glass. You polish it more than you should.' },

  // Storage 10 → 30
  { id: 'storage_1', name: 'Stacking Crates', cost: 100, requires: {}, effects: { storage: 5 },
    blurb: 'Storage +5 (15).', flavor: 'Milk crates from an era before milk was synthetic.' },
  { id: 'storage_2', name: 'Wall Racks', cost: 220, requires: { upgrades: ['storage_1'] }, effects: { storage: 5 },
    blurb: 'Storage +5 (20).', flavor: 'Bolted into the stairwell wall. LEASEHOLD has questions.' },
  { id: 'storage_3', name: 'Back-Room Mezzanine', cost: 450, requires: { upgrades: ['storage_2'] }, effects: { storage: 10 },
    blurb: 'Storage +10 (30).', flavor: 'A ladder, a loft, and a place to nap during Flood Week.' },

  // Stash 2 → 4 → 6 (needs Floor Cavity machine for the first 2)
  { id: 'stash_1', name: 'Deeper Cavity', cost: 300, requires: { machines: ['floor_cavity'] }, effects: { stash: 2 },
    blurb: 'Stash +2 (4).', flavor: 'You dig until you hit an older floor. Someone else hid things here once.' },
  { id: 'stash_2', name: 'False Wall', cost: 500, requires: { upgrades: ['stash_1'] }, effects: { stash: 2 },
    blurb: 'Stash +2 (6).', flavor: 'Looks exactly like a wall. That is the whole trick.' },

  // Utility
  { id: 'reference_index', name: 'Reference Index', cost: 200, requires: {}, effects: { referenceIndex: true },
    blurb: "Shows genuine maker's marks during Appraise.", flavor: 'A dog-eared catalogue of Upper-Spire luxury, stolen from a boutique bin.' },
  { id: 'chit_lamp', name: 'Chit Lamp', cost: 180, requires: {}, effects: { chitLamp: true },
    blurb: 'UV lamp over the counter: hologram glitches are easier to spot.', flavor: 'Violet light makes every forged sigil shiver.' },
  { id: 'awning', name: 'Drip Awning', cost: 120, requires: {}, effects: { appeal: 5, floodTrafficBonus: 0.15 },
    blurb: 'Appeal +5; Flood Week traffic loss reduced.', flavor: 'Somewhere dry to stand. In the Sump, that is a destination.' },
  { id: 'paint_job', name: 'Fresh Paint', cost: 90, requires: {}, effects: { appeal: 5 },
    blurb: 'Appeal +5.', flavor: 'Teal. Mama Ostra says it is too teal. It is the right amount of teal.' },
  { id: 'cold_box', name: 'Cold Box', cost: 180, requires: {}, effects: { spoilDaysBonus: 1 },
    blurb: 'Food spoils 1 day later.', flavor: 'Hums all night. Keeps noodles and secrets fresh.' },
  { id: 'cell_rack', name: 'Charging Rack', cost: 160, requires: { machines: ['cell_charger'] }, effects: { chargeBatchBonus: 2 },
    blurb: 'Cell Charger takes 2 more cells per night.', flavor: 'Six bays now. The fan has opinions.' },
  { id: 'precision_tools', name: 'Precision Tool Roll', cost: 240, requires: { machines: ['repair_bench'] }, effects: { refurbConditionBonus: 10, probeBonus: 1 },
    blurb: 'Refurbs +10 condition; +1 probe in the Probe mini-game.', flavor: 'Tiny screwdrivers, each with a name.' },
];

export const UPGRADES = freezeDeep(RAW);
export const UPGRADE_BY_ID = Object.freeze(Object.fromEntries(UPGRADES.map((u) => [u.id, u])));
