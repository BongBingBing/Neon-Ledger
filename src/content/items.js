// Neon Ledger — item catalogue. All names and flavour are original.
//
// Schema (ARCHITECTURE §5) + extra fields (see README.md):
//   id, name, category, basePrice (street value in ¢, integer), legality, permit?,
//   size, perishableDays?, brand?, marks?, tags, flavor
//   trade   : 'chrome'|'shards'|'power'|'kitchen'|'knockoff'|'fencing'|'general'
//   market  : relative weight of appearing in the night market (0 = never sold by suppliers)
//   buyers  : customer factions most likely to want it (buyer generation hint)
//   grade?  : chrome only — 'A' med-grade (needs Med-Tech permit) or 'B' street-grade
//   tracer? : corp shards — carries a corp tracer (Heat while held)
//   blank? / knockoffOf? : luxury item <-> the cheap blank the Label Printer turns into it
//   serialPrefix? : fenced goods — prefix used when generating serials for the Hot List

import { freezeDeep } from './util.js';
import { BRAND_BY_ID } from './brands.js';

function item(def) {
  const out = { size: 1, legality: 'legal', tags: [], market: 0, buyers: [], ...def };
  if (out.brand) out.marks = [...BRAND_BY_ID[out.brand].marks];
  return out;
}

const RAW = [
  // ── POWER CELLS ────────────────────────────────────────────────────────
  item({ id: 'cell_pocket_drained', name: 'Drained Pocket Cell', category: 'power', trade: 'power', basePrice: 8, tags: ['cell', 'drained'], market: 8, buyers: [],
    flavor: 'Thumb-sized, flat as a promise. Somebody wrung every last spark out of it.' }),
  item({ id: 'cell_pocket', name: 'Pocket Cell', category: 'power', trade: 'power', basePrice: 40, tags: ['cell', 'charged'], market: 2, buyers: ['sump', 'none', 'static'],
    flavor: 'Runs a lamp for a night or a handset for a week. Warm when full.' }),
  item({ id: 'cell_stack_drained', name: 'Drained Stack Cell', category: 'power', trade: 'power', basePrice: 14, tags: ['cell', 'drained'], market: 6, buyers: [],
    flavor: 'Three cells glued into one by an optimist. Empty.' }),
  item({ id: 'cell_stack', name: 'Stack Cell', category: 'power', trade: 'power', basePrice: 65, legality: 'permit', permit: 'power_resale', tags: ['cell', 'charged'], market: 1, buyers: ['sump', 'lantern', 'static'],
    flavor: 'Enough juice to keep a pump going through a short blackout. Resale is regulated.' }),
  item({ id: 'cell_brick_drained', name: 'Dead Brick Cell', category: 'power', trade: 'power', basePrice: 20, tags: ['cell', 'drained'], market: 4, buyers: [],
    flavor: 'Heavy enough to stop a door. Currently that is all it does.' }),
  item({ id: 'cell_brick', name: 'Brick Cell', category: 'power', trade: 'power', basePrice: 90, legality: 'permit', permit: 'power_resale', tags: ['cell', 'charged'], market: 0, buyers: ['sump', 'lantern'],
    flavor: 'Hums if you hold it to your ear. Runs a whole stall through a blackout.' }),

  // ── SYNTH KITCHEN ──────────────────────────────────────────────────────
  item({ id: 'feedstock', name: 'Vat Feedstock Brick', category: 'food', trade: 'kitchen', basePrice: 6, perishableDays: 6, tags: ['ingredient'], market: 10, buyers: [],
    flavor: 'Beige, dense, faintly sweet. Becomes noodles if you believe hard enough.' }),
  item({ id: 'starch_filler', name: 'Bulking Starch', category: 'food', trade: 'kitchen', basePrice: 2, tags: ['ingredient', 'filler'], market: 7, buyers: [],
    flavor: "Label says 'food-adjacent'. Label is being generous." }),
  item({ id: 'krill_paste', name: 'Krill Paste Tube', category: 'food', trade: 'kitchen', basePrice: 5, perishableDays: 4, tags: ['ingredient'], market: 6, buyers: [],
    flavor: 'Pink, salty, scraped off the intake grilles of the lower pumps.' }),
  item({ id: 'kelp_bundle', name: 'Kelp Bundle', category: 'food', trade: 'kitchen', basePrice: 4, perishableDays: 3, tags: ['ingredient'], market: 6, buyers: [],
    flavor: 'Grown on the drowned tram lines. Tastes green, which is rare down here.' }),
  item({ id: 'vat_noodles', name: 'Vat Noodles', category: 'food', trade: 'kitchen', basePrice: 18, perishableDays: 2, tags: ['cooked', 'meal'], market: 0, buyers: ['sump', 'none', 'lantern', 'static'],
    flavor: 'Hot, slippery, served in a folded-paper cone. The Sump runs on these.' }),
  item({ id: 'krill_cakes', name: 'Fried Krill Cakes', category: 'food', trade: 'kitchen', basePrice: 22, perishableDays: 2, tags: ['cooked', 'meal'], market: 0, buyers: ['sump', 'lantern', 'spire'],
    flavor: 'Crisp outside, oceanic inside. Tourists photograph them, then flinch.' }),
  item({ id: 'kelp_broth', name: 'Kelp Broth Flask', category: 'food', trade: 'kitchen', basePrice: 14, perishableDays: 3, tags: ['cooked', 'drink'], market: 0, buyers: ['sump', 'none', 'vantage'],
    flavor: 'A thermos of something warm and green. Good for chest coughs and bad days.' }),
  item({ id: 'rice_bars', name: 'Puffed Rice Bars', category: 'food', trade: 'general', basePrice: 9, perishableDays: 14, tags: ['packaged', 'meal'], market: 8, buyers: ['sump', 'none', 'static'],
    flavor: 'Factory-sealed in the Stacks. Survives floods, falls, and most arguments.' }),

  // ── SALVAGE ────────────────────────────────────────────────────────────
  item({ id: 'copper_coil', name: 'Drowned Copper Coil', category: 'salvage', trade: 'general', basePrice: 12, tags: ['metal', 'parts'], market: 5, buyers: ['static', 'sump'],
    flavor: 'Green with verdigris, still good copper underneath. Everyone wants copper.' }),
  item({ id: 'hull_scrap', name: 'Hull Scrap', category: 'salvage', trade: 'general', basePrice: 7, tags: ['metal'], market: 6, buyers: ['sump', 'lantern'],
    flavor: 'Plate off a sunk ferry. Patches roofs, walls, and the occasional argument.' }),
  item({ id: 'drain_glass', name: 'Drain Glass', category: 'salvage', trade: 'general', basePrice: 5, tags: ['pretty'], market: 4, buyers: ['sump', 'spire'],
    flavor: 'Bottle shards tumbled smooth by the pumps. Sump kids trade them like jewels.' }),
  item({ id: 'pump_impeller', name: 'Pump Impeller', category: 'salvage', trade: 'general', basePrice: 30, tags: ['parts', 'metal'], market: 3, buyers: ['sump', 'lantern'],
    flavor: "A spare part for the machines that keep the Sump from becoming the sea." }),
  item({ id: 'preflood_coin', name: 'Pre-Flood Coin', category: 'salvage', trade: 'general', basePrice: 45, tags: ['collectible', 'pretty', 'treasure'], market: 0, buyers: ['spire', 'static'],
    flavor: 'Real metal money from before the water came. A face on it nobody remembers.' }),
  item({ id: 'brass_bell', name: 'Brass Shrine Bell', category: 'salvage', trade: 'general', basePrice: 70, tags: ['collectible', 'treasure'], market: 0, buyers: ['spire', 'sump'],
    flavor: 'Fished from a drowned chapel. Rings a note that makes the stairwell go quiet.' }),

  // ── SUNDRIES ───────────────────────────────────────────────────────────
  item({ id: 'rain_poncho', name: 'Rain Poncho', category: 'sundry', trade: 'general', basePrice: 12, tags: ['wear'], market: 7, buyers: ['sump', 'spire', 'none'],
    flavor: 'Folds into a pocket, unfolds into a small tent. The Sump drips. Always.' }),
  item({ id: 'filter_mask', name: 'Filter Mask', category: 'sundry', trade: 'general', basePrice: 15, tags: ['wear', 'health'], market: 6, buyers: ['sump', 'none', 'vantage'],
    flavor: 'Keeps out the mold spores and the smell of the lower pumps. Mostly.' }),
  item({ id: 'iodine_tabs', name: 'Iodine Tabs', category: 'sundry', trade: 'general', basePrice: 6, tags: ['health'], market: 7, buyers: ['sump', 'none'],
    flavor: 'Two in a cup makes drain water merely unpleasant.' }),
  item({ id: 'glowgum', name: 'Glowgum', category: 'sundry', trade: 'general', basePrice: 3, tags: ['treat'], market: 8, buyers: ['sump', 'lantern', 'static', 'spire'],
    flavor: 'Chew it and your teeth glow lime for an hour. Kids love it. Dentists do not.' }),
  item({ id: 'dry_socks', name: 'Dry Socks (3 pair)', category: 'sundry', trade: 'general', basePrice: 8, tags: ['wear'], market: 7, buyers: ['sump', 'none', 'vantage'],
    flavor: 'In the Sump, a gift of dry socks is a declaration of love.' }),
  item({ id: 'soy_candles', name: 'Soy Candles', category: 'sundry', trade: 'general', basePrice: 7, tags: ['light'], market: 6, buyers: ['sump', 'none'],
    flavor: 'For blackouts, vigils, and dates that went better than expected.' }),
  item({ id: 'sunlamp_bulb', name: 'Daylight Bulb', category: 'sundry', trade: 'general', basePrice: 25, tags: ['light', 'health'], market: 4, buyers: ['sump', 'static'],
    flavor: "Full-spectrum. Ten minutes a day keeps the grey out of your blood, they say." }),
  item({ id: 'label_stock', name: 'Label Stock', category: 'sundry', trade: 'knockoff', basePrice: 10, tags: ['knockoff_input'], market: 5, buyers: [],
    flavor: 'Holo-foil sheets, thread, ink cartridges. Blank, and very deniable.' }),

  // ── TECH (general goods) ───────────────────────────────────────────────
  item({ id: 'wristcomp_used', name: 'Used Wristcomp', category: 'tech', trade: 'general', basePrice: 70, tags: ['device'], market: 3, buyers: ['sump', 'static', 'lantern'],
    flavor: "Three owners back it belonged to a Stacks accountant. It still does sums." }),
  item({ id: 'earbuds', name: 'Earbuds', category: 'tech', trade: 'general', basePrice: 20, tags: ['device', 'audio'], market: 5, buyers: ['sump', 'static', 'lantern', 'none'],
    flavor: 'One works perfectly. The other picks up a pirate radio station. Bonus.' }),
  item({ id: 'mesh_repeater', name: 'Mesh Repeater', category: 'tech', trade: 'general', basePrice: 85, tags: ['device', 'network'], market: 2, buyers: ['static', 'sump'],
    flavor: 'Bounces signal down stairwells the Spire forgot to wire.' }),
  item({ id: 'cracked_slate', name: 'Cracked Slate', category: 'tech', trade: 'general', basePrice: 45, tags: ['device'], market: 3, buyers: ['sump', 'none', 'static'],
    flavor: 'A spiderweb across the glass. Still shows cartoons, menus, and eviction notices.' }),
  item({ id: 'headlamp', name: 'Headlamp', category: 'tech', trade: 'general', basePrice: 18, tags: ['device', 'light'], market: 6, buyers: ['sump', 'lantern', 'none'],
    flavor: 'For drain work, stair climbing, and reading by when the grid sulks.' }),
  item({ id: 'pocket_dehumidifier', name: 'Pocket Dehumidifier', category: 'tech', trade: 'general', basePrice: 55, tags: ['device', 'health'], market: 3, buyers: ['sump', 'spire'],
    flavor: 'Wrings a cup of water from a cupboard a day. The cupboard is grateful.' }),

  // ── CHROME (implants; basePrice = refurbished, fully working) ──────────
  item({ id: 'chrome_finger_torch', name: 'Fingertip Torch', category: 'chrome', trade: 'chrome', grade: 'B', basePrice: 150, tags: ['implant', 'hand'], market: 4, buyers: ['sump', 'lantern'],
    flavor: 'A pea-sized lamp under the nail. Popular with drain divers and pickpockets.' }),
  item({ id: 'chrome_cochlear', name: 'Cochlear Bud', category: 'chrome', trade: 'chrome', grade: 'B', basePrice: 220, tags: ['implant', 'ear'], market: 4, buyers: ['sump', 'static', 'lantern'],
    flavor: 'Hear through rain, walls, and lies, if the firmware is honest.' }),
  item({ id: 'chrome_iris', name: 'Iris-7 Optic', category: 'chrome', trade: 'chrome', grade: 'B', basePrice: 380, tags: ['implant', 'eye'], market: 3, buyers: ['static', 'lantern', 'spire'],
    flavor: 'Seven zoom stops and a night mode. One previous owner, who is fine, probably.' }),
  item({ id: 'chrome_dermal', name: 'Dermal Weave', category: 'chrome', trade: 'chrome', grade: 'B', basePrice: 450, tags: ['implant', 'skin'], market: 3, buyers: ['lantern', 'vantage'],
    flavor: 'A fine mesh under the skin that turns a knife into a bruise.' }),
  item({ id: 'chrome_polyglot', name: 'Polyglot Jaw', category: 'chrome', trade: 'chrome', grade: 'B', basePrice: 520, tags: ['implant', 'jaw'], market: 2, buyers: ['static', 'spire', 'sump'],
    flavor: 'Translates eleven languages and three dialects of corporate. Slight lisp.' }),
  item({ id: 'chrome_grip_hand', name: 'Gripwork Hand', category: 'chrome', trade: 'chrome', grade: 'B', basePrice: 640, tags: ['implant', 'hand'], market: 2, buyers: ['lantern', 'sump'],
    flavor: 'Dock-worker hand. Lifts a crate, cracks a walnut, shakes very firmly.' }),
  item({ id: 'chrome_lung_scrubber', name: 'Lung Scrubber', category: 'chrome', trade: 'chrome', grade: 'A', basePrice: 760, legality: 'permit', permit: 'med_tech', tags: ['implant', 'medical'], market: 2, buyers: ['sump', 'vantage', 'none'],
    flavor: 'Filters mold and smog at the bronchi. Med-grade; selling it needs a permit.' }),
  item({ id: 'chrome_reflex_spool', name: 'Reflex Spool', category: 'chrome', trade: 'chrome', grade: 'A', basePrice: 900, legality: 'permit', permit: 'med_tech', tags: ['implant', 'spine', 'medical'], market: 1, buyers: ['lantern', 'vantage', 'static'],
    flavor: 'Spinal-tap timing booster. Med-grade: install it wrong and you dance forever.' }),
  item({ id: 'chrome_cardio_pacer', name: 'Cardio Pacer', category: 'chrome', trade: 'chrome', grade: 'A', basePrice: 1200, legality: 'permit', permit: 'med_tech', tags: ['implant', 'heart', 'medical'], market: 1, buyers: ['sump', 'spire', 'none'],
    flavor: 'Keeps a tired heart in time. The most honest thing you can sell, if it works.' }),

  // ── DATA SHARDS ────────────────────────────────────────────────────────
  item({ id: 'shard_unscanned', name: 'Unscanned Shard', category: 'shard', trade: 'shards', basePrice: 35, tags: ['shard', 'unknown'], market: 6, buyers: ['static'],
    flavor: 'Could be a cat video. Could be a fortune. Could be the reason someone vanished.' }),
  item({ id: 'shard_blank', name: 'Wiped Shard', category: 'shard', trade: 'shards', basePrice: 22, tags: ['shard', 'storage'], market: 3, buyers: ['static', 'sump', 'none'],
    flavor: 'Clean, empty, legal. Fresh storage for someone else’s secrets.' }),
  item({ id: 'shard_mem_concert', name: 'Bootleg Concert Shard', category: 'shard', trade: 'shards', basePrice: 150, tags: ['shard', 'memory'], market: 0, buyers: ['static', 'lantern', 'sump'],
    flavor: 'Front row, first person. You can feel the bass in someone else’s ribs.' }),
  item({ id: 'shard_mem_family', name: 'Family Album Shard', category: 'shard', trade: 'shards', basePrice: 210, tags: ['shard', 'memory'], market: 0, buyers: ['spire', 'sump'],
    flavor: "Twenty years of birthdays. Collectors pay for strangers' happiness. Odd, but true." }),
  item({ id: 'shard_mem_skyline', name: 'Skyline Memory Shard', category: 'shard', trade: 'shards', basePrice: 340, tags: ['shard', 'memory'], market: 0, buyers: ['sump', 'static', 'spire'],
    flavor: 'Ten minutes on a Spire balcony at sunrise. Sump folk replay it until it wears thin.' }),
  item({ id: 'shard_corp_mailbox', name: 'Executive Mailbox Shard', category: 'shard', trade: 'shards', basePrice: 1200, legality: 'contraband', tracer: true, tags: ['shard', 'corp', 'tracer'], market: 0, buyers: ['static'],
    flavor: "A vice-president's inbox. Mostly lunch orders. One email is not about lunch." }),
  item({ id: 'shard_corp_ledger', name: 'Black Ledger Shard', category: 'shard', trade: 'shards', basePrice: 1600, legality: 'contraband', tracer: true, tags: ['shard', 'corp', 'tracer'], market: 0, buyers: ['static'],
    flavor: 'Two sets of books. Only one was meant for the auditors.' }),
  item({ id: 'shard_corp_schematic', name: 'Prototype Schematic Shard', category: 'shard', trade: 'shards', basePrice: 2000, legality: 'contraband', tracer: true, tags: ['shard', 'corp', 'tracer'], market: 0, buyers: ['static'],
    flavor: "Blueprints for next year's miracle. The tracer pings every hour, politely." }),

  // ── LUXURY (genuine Upper-Spire goods) ─────────────────────────────────
  item({ id: 'aubade_scarf', name: 'Aubade Silk Scarf', category: 'luxury', trade: 'knockoff', brand: 'aubade', blank: 'blank_scarf', basePrice: 420, tags: ['branded', 'wear'], market: 0, buyers: ['spire'],
    flavor: 'Weighs nothing. Costs a month of Sump rent. Ripples like poured light.' }),
  item({ id: 'varga_no4', name: 'Lumen Varga No. 4', category: 'luxury', trade: 'knockoff', brand: 'varga', blank: 'blank_atomizer', basePrice: 320, tags: ['branded', 'scent'], market: 0, buyers: ['spire', 'lantern'],
    flavor: 'Smells like a sky you will never stand under. A spritz lasts two days.' }),
  item({ id: 'kestrel_visor', name: 'Kestrel Glare Visor', category: 'luxury', trade: 'knockoff', brand: 'kestrel', blank: 'blank_visor', basePrice: 540, tags: ['branded', 'wear'], market: 0, buyers: ['spire', 'lantern'],
    flavor: 'For people who have sunlight to complain about.' }),
  item({ id: 'halvard_signet', name: 'Halvard Oro Signet', category: 'luxury', trade: 'knockoff', brand: 'halvard', blank: 'blank_signet', basePrice: 760, tags: ['branded', 'jewellery'], market: 0, buyers: ['spire', 'lantern'],
    flavor: 'Old-family gold, new-family money. Warm to the touch, cold to the wallet.' }),
  item({ id: 'ninefold_envelope', name: 'Ninefold Envelope Bag', category: 'luxury', trade: 'knockoff', brand: 'ninefold', blank: 'blank_bag', basePrice: 980, tags: ['branded', 'bag'], market: 0, buyers: ['spire'],
    flavor: 'Holds a slate, a lipstick, and a sense of superiority.' }),
  item({ id: 'corvane_tidepiece', name: 'Corvane Tidepiece', category: 'luxury', trade: 'knockoff', brand: 'corvane', blank: 'blank_watch', basePrice: 1350, tags: ['branded', 'wristpiece'], market: 0, buyers: ['spire', 'lantern'],
    flavor: 'Tells the time, the tide, and everyone in the room what you are worth.' }),

  // ── BLANKS (cheap goods the Label Printer can dress up) ────────────────
  item({ id: 'blank_scarf', name: 'Plain Synth-Silk Scarf', category: 'sundry', trade: 'knockoff', knockoffOf: 'aubade_scarf', basePrice: 18, tags: ['blank', 'wear'], market: 5, buyers: ['sump'],
    flavor: 'Shiny, thin, honest about being nothing special.' }),
  item({ id: 'blank_atomizer', name: 'Unlabelled Atomizer', category: 'sundry', trade: 'knockoff', knockoffOf: 'varga_no4', basePrice: 9, tags: ['blank', 'scent'], market: 5, buyers: ['sump'],
    flavor: 'Smells pleasant from a distance. Smells like a pleasant distance.' }),
  item({ id: 'blank_visor', name: 'Tinted Visor', category: 'sundry', trade: 'knockoff', knockoffOf: 'kestrel_visor', basePrice: 15, tags: ['blank', 'wear'], market: 5, buyers: ['sump', 'lantern'],
    flavor: 'Darkens the world one shade. The Sump is already dark. Fashion, then.' }),
  item({ id: 'blank_signet', name: 'Plated Signet Ring', category: 'sundry', trade: 'knockoff', knockoffOf: 'halvard_signet', basePrice: 12, tags: ['blank', 'jewellery'], market: 4, buyers: ['sump', 'lantern'],
    flavor: 'Gold-coloured. Gold-adjacent. Turns your finger a modest green.' }),
  item({ id: 'blank_bag', name: 'Plain Fold Bag', category: 'sundry', trade: 'knockoff', knockoffOf: 'ninefold_envelope', basePrice: 25, tags: ['blank', 'bag'], market: 4, buyers: ['sump'],
    flavor: 'Faux-leather envelope. Folded a respectable number of times.' }),
  item({ id: 'blank_watch', name: 'Unbranded Quartz Watch', category: 'sundry', trade: 'knockoff', knockoffOf: 'corvane_tidepiece', basePrice: 30, tags: ['blank', 'wristpiece'], market: 3, buyers: ['sump', 'none'],
    flavor: 'Keeps decent time. Has never once impressed anyone.' }),

  // ── FENCED GOODS (always hot; serial checked against the Hot List) ─────
  item({ id: 'hot_transit_passes', name: 'Bundle of Lift Passes', category: 'stolen_goods', trade: 'fencing', basePrice: 120, legality: 'contraband', serialPrefix: 'LP', tags: ['serialed', 'hot'], market: 0, buyers: ['sump', 'lantern', 'none'],
    flavor: 'Thirty rides up the express lifts. Every one of them a small escape.' }),
  item({ id: 'hot_medkit', name: 'Clinic Med Kit', category: 'stolen_goods', trade: 'fencing', basePrice: 160, legality: 'contraband', serialPrefix: 'MK', tags: ['serialed', 'hot', 'health'], market: 0, buyers: ['sump', 'lantern', 'none'],
    flavor: 'Stamped PROPERTY OF STACKS CLINIC 12. The Sump needs it more. Probably.' }),
  item({ id: 'hot_toolcase', name: 'Contractor Tool Case', category: 'stolen_goods', trade: 'fencing', basePrice: 190, legality: 'contraband', serialPrefix: 'TC', tags: ['serialed', 'hot'], market: 0, buyers: ['sump', 'lantern', 'static'],
    flavor: "A maintenance crew's whole kit. Somewhere a lift is staying broken." }),
  item({ id: 'hot_hub_motor', name: 'E-Bike Hub Motor', category: 'stolen_goods', trade: 'fencing', basePrice: 220, legality: 'contraband', serialPrefix: 'HM', tags: ['serialed', 'hot', 'parts'], market: 0, buyers: ['lantern', 'sump'],
    flavor: 'Still warm. The bike it came from is probably still confused.' }),
  item({ id: 'hot_courier_drone', name: 'Courier Drone', category: 'stolen_goods', trade: 'fencing', basePrice: 280, legality: 'contraband', serialPrefix: 'CD', tags: ['serialed', 'hot', 'device'], market: 0, buyers: ['lantern', 'static'],
    flavor: 'Plucked out of the air mid-delivery. Keeps trying to fly home.' }),
  item({ id: 'hot_spire_handset', name: 'Spire Handset', category: 'stolen_goods', trade: 'fencing', basePrice: 340, legality: 'contraband', serialPrefix: 'SH', tags: ['serialed', 'hot', 'device'], market: 0, buyers: ['sump', 'lantern', 'static', 'none'],
    flavor: "This season's model. Wallpaper is a stranger's dog. Very good dog." }),
  item({ id: 'hot_gallery_holoprint', name: 'Gallery Holoprint', category: 'stolen_goods', trade: 'fencing', basePrice: 600, legality: 'contraband', serialPrefix: 'GH', tags: ['serialed', 'hot', 'art', 'collectible'], market: 0, buyers: ['spire', 'lantern'],
    flavor: 'A slow-moving painting of a forest. Lifted from a lobby nobody looked at.' }),
];

export const ITEMS = freezeDeep(RAW);
export const ITEM_BY_ID = Object.freeze(Object.fromEntries(ITEMS.map((i) => [i.id, i])));

export const CATEGORIES = Object.freeze(['power', 'food', 'salvage', 'sundry', 'chrome', 'shard', 'luxury', 'tech', 'stolen_goods']);

/** Display labels for categories (buyer requests like "anything {category}"). */
export const CATEGORY_LABELS = Object.freeze({
  power: 'power cells',
  food: 'food',
  salvage: 'salvage',
  sundry: 'sundries',
  chrome: 'chrome',
  shard: 'data shards',
  luxury: 'luxury goods',
  tech: 'tech',
  stolen_goods: 'hot goods',
});

export const TRADES = Object.freeze(['chrome', 'shards', 'power', 'kitchen', 'knockoff', 'fencing', 'general']);
