// Neon Ledger — player backgrounds (DESIGN §10). Ids are canonical (ARCHITECTURE R8).
//
// Fields:
//   id, name, creds (starting ¢), trade (starting Trade or null)
//   machines        : machine ids owned at start
//   capacity        : overrides of starting capacity ({ shelf, storage, stash }); omitted keys use defaults 6/10/0
//   rep             : starting reputation deltas
//   startInventory  : [{ itemId, qty, location: 'shelf'|'storage'|'stash', condition?, quality?, flags? }]
//   blurb (short, new-game card), intro (first-morning Feed message), twist (one-line summary)

import { freezeDeep } from './util.js';

const RAW = [
  {
    id: 'tinker', name: 'Tinker', creds: 400, trade: 'chrome',
    machines: ['repair_bench'], capacity: {}, rep: {},
    startInventory: [
      { itemId: 'chrome_cochlear', qty: 1, location: 'storage', condition: 35, quality: 'C', flags: { untested: true } },
      { itemId: 'chrome_finger_torch', qty: 1, location: 'storage', condition: 45, quality: 'C', flags: { untested: true } },
      { itemId: 'headlamp', qty: 1, location: 'shelf' },
      { itemId: 'rain_poncho', qty: 2, location: 'shelf' },
      { itemId: 'iodine_tabs', qty: 2, location: 'shelf' },
    ],
    twist: 'Starts with a Repair Bench and two busted implants.',
    blurb: "You fixed the whole stairwell's chrome for years, for free. Time to start charging.",
    intro: "Aunt Merle's bench is still here, her tools still warm in their foam. Two dead implants in the drawer.",
  },
  {
    id: 'shard_diver', name: 'Shard Diver', creds: 400, trade: 'shards',
    machines: ['shard_scanner'], capacity: {}, rep: { static: 5 },
    startInventory: [
      { itemId: 'shard_unscanned', qty: 3, location: 'storage' },
      { itemId: 'earbuds', qty: 1, location: 'shelf' },
      { itemId: 'glowgum', qty: 3, location: 'shelf' },
      { itemId: 'rain_poncho', qty: 1, location: 'shelf' },
    ],
    twist: 'Starts with a Shard Scanner, three unread shards, and a friend in the Static.',
    blurb: 'You know what people forget on their shards. You know who pays to remember.',
    intro: "A cracked screen in the corner flickers: 'welcome back to the wet, diver.' Three shards wait.",
  },
  {
    id: 'sparky', name: 'Sparky', creds: 450, trade: 'power',
    machines: ['cell_charger'], capacity: {}, rep: {},
    startInventory: [
      { itemId: 'cell_pocket', qty: 2, location: 'shelf' },
      { itemId: 'cell_pocket_drained', qty: 4, location: 'storage' },
      { itemId: 'soy_candles', qty: 2, location: 'shelf' },
      { itemId: 'headlamp', qty: 1, location: 'shelf' },
    ],
    twist: 'Starts with a Cell Charger and a box of empty cells.',
    blurb: "The grid flickers. You don't. Everyone in the Sump needs a little light.",
    intro: 'The charger hums when you plug it in, like it missed you. Four empty cells, two full ones.',
  },
  {
    id: 'line_cook', name: 'Line Cook', creds: 450, trade: 'kitchen',
    machines: ['vat_cooker'], capacity: {}, rep: { sump: 10 },
    startInventory: [
      { itemId: 'feedstock', qty: 4, location: 'storage' },
      { itemId: 'starch_filler', qty: 2, location: 'storage' },
      { itemId: 'rice_bars', qty: 3, location: 'shelf' },
      { itemId: 'kelp_broth', qty: 2, location: 'shelf' },
    ],
    twist: 'Starts with a Vat Cooker, a sack of feedstock, and the neighbours on side.',
    blurb: "You cooked six years at Mama Ostra's. She says you're ready. She says it like a threat.",
    intro: "Mama Ostra left two flasks of broth on your counter. A note: 'competition is healthy. Mine is better.'",
  },
  {
    id: 'fence', name: 'Fence', creds: 350, trade: 'fencing',
    machines: ['floor_cavity'], capacity: { stash: 2 }, rep: { lantern: 15, vantage: -10 },
    startInventory: [
      { itemId: 'hot_medkit', qty: 1, location: 'stash', flags: { stolen: true } },
      { itemId: 'dry_socks', qty: 2, location: 'shelf' },
      { itemId: 'glowgum', qty: 3, location: 'shelf' },
      { itemId: 'filter_mask', qty: 1, location: 'shelf' },
    ],
    twist: 'Starts with a 2-slot stash, Lantern friends, and a Vantage file.',
    blurb: 'Things find their way to you. You find them a new home. No questions, small fee.',
    intro: "Rook's card is tucked under the tile you hide things beneath. 'Glad you're back. We noticed.'",
  },
  {
    id: 'nobody', name: 'Nobody', creds: 60, trade: null,
    machines: [], capacity: {}, rep: {},
    startInventory: [
      { itemId: 'rain_poncho', qty: 1, location: 'shelf' },
      { itemId: 'glowgum', qty: 2, location: 'shelf' },
    ],
    twist: 'Hard start: sixty creds, an empty shelf, and nobody owes you a thing.',
    blurb: "No trade, no friends, no plan. Just the keys, the debt, and a stairwell full of strangers.",
    intro: "The shutter sticks halfway. The shelf is bare except for a poncho and some gum. It's a start.",
  },
];

export const BACKGROUNDS = freezeDeep(RAW);
export const BACKGROUND_BY_ID = Object.freeze(Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b])));
