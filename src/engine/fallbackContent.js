// Minimal fallback content used when a src/content/*.js module is missing.
// It doubles as a reference for the fields the engine consumes (see STATE.md "Content fields").
// Real content in src/content always takes precedence (src/engine/content.js).

export const ITEMS = [];

export const BRANDS = [];

export const MACHINES = [];

export const RECIPES = [];

export const UPGRADES = [];

export const PERMITS = [];

export const LICENCES = [];

export const PERKS = [];

export const JOBS = [];

export const NPCS = [
  { id: 'halloran', name: 'Inspector Dace Halloran', faction: 'vantage', role: 'inspector', portraitTraits: { boots: 'vantage', coat: 'trench' },
    favors: [
      { id: 'look_away', name: 'Ask him to look elsewhere', cost: 200, requires: { rep: { vantage: 20 } }, effects: { heat: -15 } },
      { id: 'turn_in_shard', name: 'Turn in a corp shard', cost: 0, requires: { holdsTag: 'corp' }, effects: { turnInShard: true } },
    ], lines: { greet: ['Morning. Routine check.'] } },
  { id: 'rook', name: 'Rook', faction: 'lantern', role: 'dues', portraitTraits: { grin: true },
    favors: [ { id: 'black_stock', name: 'Ask for special stock', cost: 0, requires: { rep: { lantern: 10 } }, effects: { blackMarket: true } } ], lines: { greet: ['Evening, neighbour!'] } },
  { id: 'wren', name: '0xWREN', faction: 'static', role: 'hacker', portraitTraits: { screen: true },
    favors: [
      { id: 'scrub_heat', name: 'Scrub your records', cost: 150, requires: { rep: { static: 10 } }, effects: { heat: -20 } },
      { id: 'tipoff', name: 'Buy a tip-off', cost: 40, effects: { forecastReveal: true } },
    ], lines: { greet: ['>> u up?'] } },
  { id: 'mama_ostra', name: 'Mama Ostra', faction: 'sump', role: 'neighbour', portraitTraits: { apron: true },
    favors: [ { id: 'warning', name: 'Ask what the stairwell is saying', cost: 0, requires: { rep: { sump: 20 } }, effects: { forecastReveal: true } } ], lines: { greet: ['Eat something, child.'] } },
  { id: 'old_tamsin', name: 'Old Tamsin', faction: 'sump', role: 'scavenger', portraitTraits: { hood: true }, lines: { greet: ['Found this in the Deep Drain, I did.'] } },
];

export const NAMES = {
  first: {
    sump: ['Mags', 'Tully', 'Ines', 'Bo', 'Pell', 'Nadia', 'Rafe', 'Kit', 'Oona', 'Dez'],
    lantern: ['Vex', 'Marlo', 'Sly', 'Juno', 'Crane', 'Tess'],
    vantage: ['Aldous', 'Priya', 'Conrad', 'Hale', 'Mirela'],
    static: ['Nyx', 'Bit', 'Lux', 'Echo', 'Quill'],
    spire: ['Cassius', 'Ottilie', 'Florian', 'Seraphine', 'Lysander'],
    none: ['Sam', 'Ari', 'Jo', 'Lee', 'Max'],
  },
  last: ['Okoro', 'Vance', 'Lindqvist', 'Moreau', 'Tanaka', 'Achebe', 'Reyes', 'Kowal', 'Brandt', 'Szabo', 'Quill', 'Marsh'],
  wards: [
    { code: 'S-03', name: 'Stairwell Three', faction: 'sump' },
    { code: 'S-07', name: 'Drowned Market', faction: 'sump' },
    { code: 'L-12', name: 'Lantern Row', faction: 'lantern' },
    { code: 'V-21', name: 'Checkpoint Deck', faction: 'vantage' },
    { code: 'X-00', name: 'The Dead Floor', faction: 'static' },
    { code: 'U-88', name: 'Upper Spire', faction: 'spire' },
    { code: 'M-40', name: 'Midlevels', faction: 'none' },
  ],
};

export const DIALOGUE = {
  buyer_greet: [{ text: 'Looking for {want}. Got any?' }, { text: "Need {want}. Don't make it complicated." }],
  seller_greet: [{ text: 'Got a {item} here. {price}¢ and it\'s yours.' }, { text: 'Interested in a {item}? I\'m asking {price}¢.' }],
  haggle_counter: [{ text: 'How about {price}¢?' }, { text: '{price}¢. Final-ish.' }],
  haggle_accept: [{ text: 'Deal.' }, { text: 'Fine, fine. Done.' }],
  haggle_walk: [{ text: "Forget it. I'm out." }],
  deal_done: [{ text: 'Pleasure.' }],
  refuse: [{ text: 'Your loss.' }],
  report: [{ text: 'You called the corps on me?!' }],
  undercover_greet: [{ text: 'Good morning. I am seeking {want}, if available.' }],
  ghost_nervous: [{ text: 'Can we hurry this up?' }],
  special_charity: [{ text: "I can't make rent this week. Could you spare {price}¢?" }],
  special_auction: [{ text: 'LIQUIDATION LOT {lot}. SEALED. MINIMUM BID {price}¢.' }],
};

export const EVENTS = [
  { id: 'blackout', name: 'Blackout', durationDays: [2, 3], weight: 3, minDay: 5, effects: { demand: { power: 3 } }, feedText: { forecast: 'Grid techs whisper about a blackout.', start: 'The lights die across the Sump.', end: 'Power is back.' } },
  { id: 'flood_week', name: 'Flood Week', durationDays: [3, 5], weight: 2, minDay: 8, effects: { traffic: 0.7, demand: { food: 1.5, power: 1.5 } }, feedText: { forecast: 'Tide warnings posted.', start: 'The water is up.', end: 'The water recedes.' } },
  { id: 'spire_gala', name: 'Spire Gala', durationDays: [3, 4], weight: 2, minDay: 10, effects: { demand: { luxury: 2 }, spireMult: 3, brandRaids: 0.15 }, feedText: { forecast: 'The Gala approaches.', start: 'Tourists pour down from the Spire.', end: 'The Gala is over.' } },
  { id: 'crackdown', name: 'Crackdown', durationDays: [3, 5], weight: 2, minDay: 12, effects: { auditThreshold: 40, undercoverMult: 2 }, feedText: { forecast: 'Vantage is restless.', start: 'Vantage announces a crackdown.', end: 'The crackdown eases.' } },
  { id: 'chrome_recall', name: 'Chrome Recall', durationDays: [3, 4], weight: 2, minDay: 10, effects: { demand: { chrome: 1.8 } }, feedText: { forecast: 'A chrome maker is in trouble.', start: 'A big chrome recall hits.', end: 'The recall settles.' } },
  { id: 'shard_leak', name: 'Shard Leak', durationDays: [2, 4], weight: 2, minDay: 10, effects: { demand: { shard: 2 }, tracerMult: 2 }, feedText: { forecast: 'Something big leaked upstairs.', start: 'Shards everywhere.', end: 'The leak dries up.' } },
  { id: 'turf_war', name: 'Turf War', durationDays: [2, 4], weight: 2, minDay: 14, effects: { duesMult: 2, breakInMult: 1.5 }, feedText: { forecast: 'Lanterns are arguing.', start: 'Turf war in the stairwell.', end: 'The turf war cools.' } },
  { id: 'market_adjustment', name: 'Market Adjustment', durationDays: [1, 1], weight: 1, minDay: 15, effects: { leaseHike: 0.1 }, feedText: { forecast: 'LEASEHOLD is reviewing rates.', start: 'LEASEHOLD: a small market adjustment :)', end: '' } },
];

export const BACKGROUNDS = [];

export const DIFFICULTIES = [];

export const ENDINGS = [
  { id: 'deed_vantage', title: 'Franchise of the Spire', text: 'Vantage puts your Stall on a brochure.', win: true },
  { id: 'deed_lantern', title: 'Made in the Sump', text: 'The Lanterns light a candle in your window.', win: true },
  { id: 'deed_static', title: 'Free Node', text: 'The Stall becomes a free mesh hub.', win: true },
  { id: 'deed_sump', title: 'Heart of the Stairwell', text: 'The neighbours throw you a party in the rain.', win: true },
  { id: 'deed_plain', title: 'Your Own Name on the Door', text: 'The deed is yours. The rain sounds different now.', win: true },
  { id: 'evicted', title: 'Evicted', text: 'LEASEHOLD changes the locks with a smiley face.', win: false },
  { id: 'arrested', title: 'Arrested', text: 'Halloran reads you your rights, tiredly.', win: false },
  { id: 'taken_for_ride', title: 'Taken for a Ride', text: 'Rook offers you a lift. You do not come back.', win: false },
  { id: 'underwater', title: 'Underwater', text: 'The debt rises faster than the tide.', win: false },
];

export const FEED = {
  leasehold: {
    countdown: ['Friendly reminder: rent of {amount}¢ is due in {days} day(s) :)'],
    dueToday: ['Rent of {amount}¢ is due tonight! :)'],
    paid: ['Payment received. Thank you for being a valued tenant :)'],
    missed: ['Payment missed. A late fee applies. Overdue: {amount}¢ :('],
    grace: ['You are in grace. {amount}¢ overdue. Please :)'],
    evicted: ['Your tenancy has ended. Have a nice day :)'],
  },
  news: ['Rain expected. Rain continues.', 'Spire stocks up 2%. Sump stocks: wet.', 'Vantage reports record efficiency.', 'Noodle prices steady.'],
  audit: ['Word is Inspector Halloran will visit this morning.'],
  hotlist: ['Vantage hot list posted: {count} serials.'],
};
