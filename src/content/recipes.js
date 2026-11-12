// Neon Ledger — workshop recipes (run at night, ready at dawn after `days`).
//
// Fields:
//   id, machineId, name
//   kind     : 'refurb' (improve chrome in place) | 'scan' (reveal a shard) | 'wipe'
//            | 'charge' | 'cook' | 'label'
//   inputs   : [{ itemId?, category?, tag?, qty, exclude?: [itemIds] }]  one input "set"
//   outputs? : [{ itemId, qty, flags? }]           produced per input set (charge/cook/label/wipe)
//   outcomes?: [{ itemId, weight, flags? }]        scan: input becomes one weighted outcome
//   transform?: { conditionGain, conditionCap, clearFlags: [...], revealCondition: bool }
//              refurb: the input item is kept (same uid) and modified
//   maxBatch : how many input sets one run may take (charger batch comes from machine.effects.maxBatch)
//   days     : nights until ready (1 = ready next dawn)
//   powerCost: ¢ per input set (in addition to machine.powerPerNight); Grid Tap multiplies charge costs by 0
//   partsCost: ¢ per input set for consumables (refurb parts)
//   risk?    : { poisonChance? (cooked food made from filler), failChance? (input ruined) }
//   flavor
//
// Output flags use the InvItem flag names (counterfeit, labelled, cut, tracer…).

import { freezeDeep } from './util.js';

const label = (id, blank, lux, name) => ({
  id, machineId: 'label_printer', name, kind: 'label',
  inputs: [{ itemId: blank, qty: 1 }, { itemId: 'label_stock', qty: 1 }],
  outputs: [{ itemId: lux, qty: 1, flags: { counterfeit: true, labelled: true } }],
  maxBatch: 3, days: 1, powerCost: 3, partsCost: 0,
  flavor: 'Tag, stitch, etch. Nearly perfect. Nearly is the whole business.',
});

const RAW = [
  // ── Repair Bench ──
  {
    id: 'refurb_patch', machineId: 'repair_bench', name: 'Patch Job', kind: 'refurb',
    inputs: [{ category: 'chrome', qty: 1 }],
    transform: { conditionGain: 25, conditionCap: 85, clearFlags: ['untested'], revealCondition: true },
    maxBatch: 2, days: 1, powerCost: 3, partsCost: 15, risk: { failChance: 0.05 },
    flavor: 'Reseat the contacts, swap a capacitor, pray quietly.',
  },
  {
    id: 'refurb_rebuild', machineId: 'repair_bench', name: 'Full Rebuild', kind: 'refurb',
    inputs: [{ category: 'chrome', qty: 1 }],
    transform: { conditionGain: 55, conditionCap: 100, clearFlags: ['untested'], revealCondition: true },
    maxBatch: 1, days: 2, powerCost: 6, partsCost: 60, risk: { failChance: 0.02 },
    flavor: 'Strip it to the frame, rebuild it better than the factory bothered to.',
  },

  // ── Shard Scanner ──
  {
    id: 'scan_shard', machineId: 'shard_scanner', name: 'Deep Scan', kind: 'scan',
    inputs: [{ itemId: 'shard_unscanned', qty: 1 }],
    outcomes: [
      { itemId: 'shard_blank', weight: 50 },            // junk: scanner auto-wipes it
      { itemId: 'shard_mem_concert', weight: 16 },
      { itemId: 'shard_mem_family', weight: 12 },
      { itemId: 'shard_mem_skyline', weight: 7 },
      { itemId: 'shard_corp_mailbox', weight: 7, flags: { tracer: true } },
      { itemId: 'shard_corp_ledger', weight: 5, flags: { tracer: true } },
      { itemId: 'shard_corp_schematic', weight: 3, flags: { tracer: true } },
    ],
    maxBatch: 3, days: 1, powerCost: 5, partsCost: 0,
    flavor: 'Overnight, the shard tells the scanner everything. The scanner tells you.',
  },
  {
    id: 'wipe_shard', machineId: 'shard_scanner', name: 'Wipe Clean', kind: 'wipe',
    inputs: [{ category: 'shard', qty: 1, exclude: ['shard_blank'] }],
    outputs: [{ itemId: 'shard_blank', qty: 1 }],
    maxBatch: 3, days: 1, powerCost: 2, partsCost: 0,
    flavor: 'Seven passes of noise. Whatever it was, it is nothing now. Tracer included.',
  },

  // ── Cell Charger ──
  {
    id: 'charge_pocket', machineId: 'cell_charger', name: 'Charge Pocket Cells', kind: 'charge',
    inputs: [{ itemId: 'cell_pocket_drained', qty: 1 }], outputs: [{ itemId: 'cell_pocket', qty: 1 }],
    maxBatch: 4, days: 1, powerCost: 6, partsCost: 0,
    flavor: 'Slow and steady. The little green lights fill up like a fuel gauge of hope.',
  },
  {
    id: 'charge_stack', machineId: 'cell_charger', name: 'Charge Stack Cells', kind: 'charge',
    inputs: [{ itemId: 'cell_stack_drained', qty: 1 }], outputs: [{ itemId: 'cell_stack', qty: 1 }],
    maxBatch: 4, days: 1, powerCost: 10, partsCost: 0,
    flavor: 'Three cells, one patience.',
  },
  {
    id: 'charge_brick', machineId: 'cell_charger', name: 'Charge Brick Cells', kind: 'charge',
    inputs: [{ itemId: 'cell_brick_drained', qty: 1 }], outputs: [{ itemId: 'cell_brick', qty: 1 }],
    maxBatch: 2, days: 1, powerCost: 16, partsCost: 0,
    flavor: 'The charger groans. The lights on the landing dim a little.',
  },

  // ── Vat Cooker ──
  {
    id: 'cook_noodles', machineId: 'vat_cooker', name: 'Vat Noodles', kind: 'cook',
    inputs: [{ itemId: 'feedstock', qty: 2 }], outputs: [{ itemId: 'vat_noodles', qty: 4 }],
    maxBatch: 2, days: 1, powerCost: 4, partsCost: 0,
    flavor: 'Press, boil, fold into cones. The smell brings the stairwell to your door.',
  },
  {
    id: 'cook_noodles_stretched', machineId: 'vat_cooker', name: 'Stretched Noodles', kind: 'cook',
    inputs: [{ itemId: 'feedstock', qty: 2 }, { itemId: 'starch_filler', qty: 1 }],
    outputs: [{ itemId: 'vat_noodles', qty: 6, flags: { cut: true } }],
    maxBatch: 2, days: 1, powerCost: 4, partsCost: 0, risk: { poisonChance: 0.12 },
    flavor: 'Fifty percent more noodle. Forty percent of it is noodle.',
  },
  {
    id: 'cook_krill_cakes', machineId: 'vat_cooker', name: 'Krill Cakes', kind: 'cook',
    inputs: [{ itemId: 'krill_paste', qty: 1 }, { itemId: 'feedstock', qty: 1 }],
    outputs: [{ itemId: 'krill_cakes', qty: 3 }],
    maxBatch: 2, days: 1, powerCost: 5, partsCost: 0,
    flavor: 'Hot oil, a spatula, and the sound of rain trying to get in on it.',
  },
  {
    id: 'cook_kelp_broth', machineId: 'vat_cooker', name: 'Kelp Broth', kind: 'cook',
    inputs: [{ itemId: 'kelp_bundle', qty: 1 }, { itemId: 'feedstock', qty: 1 }],
    outputs: [{ itemId: 'kelp_broth', qty: 3 }],
    maxBatch: 2, days: 1, powerCost: 3, partsCost: 0,
    flavor: 'Simmered until it tastes like a grandmother who forgives you.',
  },

  // ── Label Printer ──
  label('label_aubade_scarf', 'blank_scarf', 'aubade_scarf', "Dress as 'Aubade' Scarf"),
  label('label_varga_no4', 'blank_atomizer', 'varga_no4', "Dress as 'Varga No. 4'"),
  label('label_kestrel_visor', 'blank_visor', 'kestrel_visor', "Dress as 'Kestrel' Visor"),
  label('label_halvard_signet', 'blank_signet', 'halvard_signet', "Dress as 'Halvard' Signet"),
  label('label_ninefold_envelope', 'blank_bag', 'ninefold_envelope', "Dress as 'Ninefold' Bag"),
  label('label_corvane_tidepiece', 'blank_watch', 'corvane_tidepiece', "Dress as 'Corvane' Watch"),
];

export const RECIPES = freezeDeep(RAW);
export const RECIPE_BY_ID = Object.freeze(Object.fromEntries(RECIPES.map((r) => [r.id, r])));
