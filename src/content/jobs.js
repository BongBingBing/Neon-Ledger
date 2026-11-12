// Neon Ledger — night jobs (one per night, optional; DESIGN §12).
//
// Fields: id, name, npcId, requires: { rep?: { faction: min }, notEvent?: [eventIds] },
//   pay: [min, max] ¢, rep: { faction: delta }, heat (delta),
//   salvageRolls?: number of random finds, salvageTable?: [{ itemId, weight }],
//   risk: { injuryChance? (injury = −1 customer next day), heatSpikeChance? },
//   text: { offer, success: [...], injury?, fail? }

import { freezeDeep } from './util.js';

const RAW = [
  {
    id: 'drain_diving', name: 'Drain Diving', npcId: 'old_tamsin', requires: {},
    pay: [0, 0], rep: { sump: 1 }, heat: 0,
    salvageRolls: 2,
    salvageTable: [
      { itemId: 'hull_scrap', weight: 26 }, { itemId: 'copper_coil', weight: 22 }, { itemId: 'drain_glass', weight: 20 },
      { itemId: 'pump_impeller', weight: 9 }, { itemId: 'shard_unscanned', weight: 8 }, { itemId: 'cell_pocket_drained', weight: 8 },
      { itemId: 'preflood_coin', weight: 4 }, { itemId: 'brass_bell', weight: 2 }, { itemId: 'chrome_finger_torch', weight: 1 },
    ],
    risk: { injuryChance: 0.12 },
    text: {
      offer: "Tamsin's waders are by the grate. 'Tide's low. The drains are generous tonight.'",
      success: [
        'Cold water to the chest, a headlamp, and Tamsin singing. You come up with treasure. Of a kind.',
        "Tamsin finds a boot. You find something better. She insists the boot was the real prize.",
        'The current tugs at your ankles like a child wanting attention. Your bag is heavier now.',
      ],
      injury: 'A rusted grille opens your palm. Tamsin bandages it with surprising tenderness. Slow day tomorrow.',
    },
  },
  {
    id: 'courier_static', name: 'Courier Run', npcId: 'wren', requires: { rep: { static: -20 } },
    pay: [60, 110], rep: { static: 4 }, heat: 6,
    risk: { heatSpikeChance: 0.15 },
    text: {
      offer: "The cracked screen lights up: 'package. Stacks drop. don't open it. don't be followed.'",
      success: [
        "You hand a warm little box to someone in a mask. They tip you a nod and an extra ten.",
        'Eleven flights up, three down, one lift ride holding your breath. Delivered.',
        "Drop made. On the way home every camera seems to blink at you. Probably nothing.",
      ],
      fail: 'A Vantage patrol stops you on the Gantry. You talk your way out, but they took a good look.',
    },
  },
  {
    id: 'help_ostra', name: "Help at Mama Ostra's", npcId: 'mama_ostra', requires: {},
    pay: [15, 30], rep: { sump: 4 }, heat: 0,
    risk: {},
    text: {
      offer: "Mama Ostra waves a ladle across the stairwell. 'You. Apron. Now. I pay in coin and gossip.'",
      success: [
        'Four hours of noodles, steam, and stories. Your arms ache. Your heart, weirdly, does not.',
        "Ostra pays you, feeds you, and tells you who's been seen talking to Vantage.",
        'You wash two hundred bowls. Ostra says you are adequate. From her, that is a medal.',
      ],
    },
  },
  {
    id: 'collection_rook', name: 'Collection Run', npcId: 'rook', requires: { rep: { lantern: 20 } },
    pay: [90, 160], rep: { lantern: 5, sump: -5 }, heat: 2,
    risk: {},
    text: {
      offer: "Rook leans in the doorway. 'Couple of folks forgot what week it is. Come remind them with me?'",
      success: [
        "You stand behind Rook looking serious. Doors open. Envelopes appear. Nobody meets your eye.",
        "Rook is so friendly about it. That's the worst part. You get paid. You don't sleep well.",
        'A neighbour you know pays up with shaking hands. Rook thanks them warmly. You take your cut.',
      ],
    },
  },
  {
    id: 'pump_watch', name: 'Pump Watch', npcId: null, requires: {},
    pay: [30, 45], rep: { sump: 1 }, heat: 0,
    risk: { injuryChance: 0.04 },
    text: {
      offer: 'The ward pump-house needs someone to watch the gauges overnight. Boring. Honest. Paid.',
      success: [
        'You watch needles not move for six hours. The sea stays outside. You did that. Sort of.',
        'A pressure alarm at 3 a.m. You hit the right valve. Nobody will ever know you saved the stairwell.',
        'The pump-house cat sits on your lap all night. It is the best shift you have ever worked.',
      ],
      injury: 'A valve wheel kicks back and wrenches your shoulder. Slow day tomorrow.',
    },
  },
];

export const JOBS = freezeDeep(RAW);
export const JOB_BY_ID = Object.freeze(Object.fromEntries(JOBS.map((j) => [j.id, j])));
