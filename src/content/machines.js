// Neon Ledger — machines (bought at night in Upgrades & Permits / Workshop).
//
// Fields:
//   id, name, trade (trade it unlocks, or null), cost (¢)
//   kind        : 'workshop' (runs recipes) | 'passive' (always-on effect)
//   powerPerNight: ¢ power bill for each night the machine is active
//                  (workshop: nights it runs a job; passive: every night owned)
//   breakdownChance: chance per active night of breaking (needs repair)
//   repairCost  : ¢ to fix when broken
//   requires    : { machines?: [ids], licence?: id, permit?: id, rep?: { faction: min } }
//   illegal?    : true if owning it is itself a crime (adds Heat; see effects)
//   effects     : passive/modifier effects the engine applies while owned
//   flavor
// Recipes reference machines via recipe.machineId (see recipes.js).

import { freezeDeep } from './util.js';

const RAW = [
  {
    id: 'repair_bench', name: 'Repair Bench', kind: 'workshop', trade: 'chrome', cost: 300,
    powerPerNight: 4, breakdownChance: 0.02, repairCost: 60, requires: {}, effects: {},
    flavor: 'Magnifier, micro-solder, and a lamp bent at the angle your aunt liked.',
  },
  {
    id: 'shard_scanner', name: 'Shard Scanner', kind: 'workshop', trade: 'shards', cost: 350,
    powerPerNight: 8, breakdownChance: 0.02, repairCost: 70, requires: {}, effects: {},
    flavor: 'Reads a shard overnight with a whine like a mosquito doing taxes.',
  },
  {
    id: 'cell_charger', name: 'Cell Charger', kind: 'workshop', trade: 'power', cost: 250,
    powerPerNight: 2, breakdownChance: 0.02, repairCost: 50, requires: {}, effects: { maxBatch: 4 },
    flavor: 'Four bays, one fan, a smell of hot dust. Grid power, metered and legal.',
  },
  {
    id: 'grid_tap', name: 'Grid Tap', kind: 'passive', trade: 'power', cost: 200,
    powerPerNight: 0, breakdownChance: 0, repairCost: 80, illegal: true,
    requires: { machines: ['cell_charger'] },
    effects: { chargePowerMult: 0, heatPerNight: 4, fireChance: 0.04, fireDestroys: { items: [1, 3], machineChance: 0.3 } },
    flavor: 'A clamp on a conduit the Spire pretends not to know about. Free power, warm wires.',
  },
  {
    id: 'vat_cooker', name: 'Vat Cooker', kind: 'workshop', trade: 'kitchen', cost: 280,
    powerPerNight: 4, breakdownChance: 0.02, repairCost: 55, requires: {}, effects: {},
    flavor: 'A pressure vat, a noodle press, and a ladle older than you.',
  },
  {
    id: 'label_printer', name: 'Label Printer', kind: 'workshop', trade: 'knockoff', cost: 400,
    powerPerNight: 3, breakdownChance: 0.03, repairCost: 90,
    requires: { licence: 'knockoff' }, effects: {},
    flavor: 'Prints holo-tags, stitches hems, etches serials. Sold to you by a man who never blinked.',
  },
  {
    id: 'security_shutter', name: 'Security Shutter', kind: 'passive', trade: null, cost: 300,
    powerPerNight: 0, breakdownChance: 0, repairCost: 0, requires: {}, effects: { breakInMult: 0.5 },
    flavor: 'Rolled steel and a lock that sings when tampered with.',
  },
  {
    id: 'neon_sign', name: 'Neon Sign', kind: 'passive', trade: null, cost: 220,
    powerPerNight: 3, breakdownChance: 0.01, repairCost: 40, requires: {}, effects: { appeal: 15 },
    flavor: 'Your shop name in pink glass tubing. Visible from three landings down.',
  },
  {
    id: 'floor_cavity', name: 'Floor Cavity', kind: 'passive', trade: null, cost: 350,
    powerPerNight: 0, breakdownChance: 0, repairCost: 0, requires: {}, effects: { stash: 2 },
    flavor: 'A loose tile, a dry hollow, and a rug placed with great casualness.',
  },
];

export const MACHINES = freezeDeep(RAW);
export const MACHINE_BY_ID = Object.freeze(Object.fromEntries(MACHINES.map((m) => [m.id, m])));
