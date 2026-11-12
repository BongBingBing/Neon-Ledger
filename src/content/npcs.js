// Neon Ledger — recurring NPCs (DESIGN §9). All characters are original.
//
// Fields: id, name, faction ('vantage'|'lantern'|'static'|'sump'|'none'), role, personality,
//   homeWard (names.js ward id), portraitTraits (hints for the UI portrait generator; UI may ignore unknown keys),
//   screenOnly? (never shown as a portrait: voice on a cracked screen / text-only),
//   lines: { situation: [strings] }   placeholders: {item} {price} {name} {shop} {amount} {days} {fine}
//   favors?: [{ id, name, cost, minRep, effects, text }]  for CONTACT_FAVOR (night)

import { freezeDeep } from './util.js';

const RAW = [
  {
    id: 'halloran', name: 'Inspector Dace Halloran', faction: 'vantage', role: 'auditor',
    personality: 'Tired, by-the-book, decent in a worn-out way. Open to "processing fees".',
    homeWard: 'tier_forty',
    portraitTraits: { head: 'long', skin: 'pale_olive', hair: 'grey_crop', eyes: 'tired', facialHair: 'stubble',
      implant: 'datalens_left', clothing: 'vantage_greatcoat', accessory: 'badge', boots: 'vantage', palette: 'cyan' },
    lines: {
      greet: [
        "Morning, {name}. Let's make this quick for both of us.",
        'Vantage Security. Routine inspection. It is always routine.',
        "Don't get up. Actually, do get up. I need to see behind the counter.",
        "Third stairwell today. My knees hate the Sump. Nothing personal.",
        'Inspector Halloran. You know the drill. I know you know the drill.',
      ],
      audit_open: [
        'Shelf first, then the back room. Keep your hands where I can see them, please.',
        "I'm going to look at everything. You're going to stand there and look innocent.",
        'Clipboard says your Heat is up. Clipboard is rarely wrong.',
      ],
      audit_clean: [
        'Clean. Huh. Either you are honest or you are good. I will write "honest".',
        "Nothing. Good. I'd rather go home early than fill out forms.",
        "All in order. Don't make me come back, {name}.",
      ],
      audit_found: [
        'Ah. {item}. You knew I would find that. I know you knew.',
        "That's going in the bag. And that. And — yes. That too.",
        "Fine comes to {fine}¢. I don't set the rates. I just read them aloud, sadly.",
      ],
      bribe_offer: [
        'There is, hypothetically, a processing fee that expedites things.',
        "I'm told some shopkeepers pay a small courtesy. I'm told. I don't ask.",
        "If a fee of {price}¢ found its way into my coat, the paperwork might get lost.",
      ],
      bribe_accept: [
        "I didn't see a thing. My eyes are very tired today.",
        'Expedited. Have a good week, {name}. Truly.',
        "Paperwork's had an accident. Tragic. Goodbye.",
      ],
      bribe_fail: [
        'No. Not today. Today my supervisor is watching me.',
        "You tried to bribe an inspector in front of a camera drone. That doubles it.",
        "I'd have taken it yesterday. Today you get the full rate. Twice.",
      ],
      farewell: [
        'Stay boring, {name}. Boring is good for both of us.',
        "I'll be back when the numbers say so. Nothing personal.",
        'Mind the stairs. They are trying to kill everyone.',
      ],
    },
    favors: [
      { id: 'friendly_word', name: 'A Friendly Word', cost: 200, minRep: 20, effects: { heat: -15 },
        text: "Halloran pockets the envelope. 'Your file is very dull now. Congratulations.'" },
      { id: 'audit_schedule', name: 'Look at the Schedule', cost: 120, minRep: 35, effects: { revealAuditOdds: true, heat: -5 },
        text: "He taps the side of his nose. 'Nobody is visiting you this week. Probably.'" },
    ],
  },
  {
    id: 'rook', name: 'Rook', faction: 'lantern', role: 'dues_collector',
    personality: 'Cheerful, warm, remembers your birthday. Absolutely terrifying.',
    homeWard: 'lanternside',
    portraitTraits: { head: 'round', skin: 'deep_brown', hair: 'shaved_tattooed', eyes: 'bright', facialHair: 'none',
      implant: 'gold_jaw', clothing: 'red_bomber', accessory: 'paper_lantern_pin', boots: 'street', palette: 'magenta' },
    lines: {
      greet: [
        "{name}! There they are. Looking well. Business looking well?",
        'Evening, neighbour. Just doing the rounds. You know how it is.',
        "Love what you've done with the shelf. Very... flammable. Kidding!",
        "Hey hey. Got a minute? Course you do. You've always got a minute for me.",
      ],
      dues_ask: [
        "Little contribution tonight: {price}¢. Keeps the lights on. And the windows in.",
        "{price}¢ for the lantern fund. Safety's a community effort, right?",
        'Same as always, give or take. Tonight it is {price}¢. I round in your favour.',
        "Dues are {price}¢. I'd hate for you to have a night like the shop on Pumpwell had.",
      ],
      dues_paid: [
        'You are a joy. A delight. Sleep safe, {name}.',
        'Pleasure as always. Nobody is touching this shop. My word on it.',
        "See? Easy. That's how friendships last.",
      ],
      dues_skipped: [
        "No? Okay. Okay! That's your choice. I respect choices.",
        "Hm. Tight week? Sure. Lot of break-ins lately, is all. Just saying. Caring, really.",
        "I'll put you down as 'thinking about it'. Don't think too long.",
        'Brave. I like brave. The stairwell is very dark tonight, did you notice?',
      ],
      threat: [
        "We should talk, {name}. Not tonight. Soon. You'll know when.",
        "People are asking me why you're special. I'm running out of answers.",
        "I like you. That's why this is hard for me. Harder for you, though.",
      ],
      farewell: [
        'Mind how you go!',
        "Night, neighbour. Lock up. Or don't. We're watching anyway.",
        'Ciao, {name}. Tell your aunt’s ghost I said hi.',
      ],
    },
    favors: [
      { id: 'lantern_stock', name: 'Lantern Stock', cost: 0, minRep: 10, effects: { marketHotGoods: 3 },
        text: "Rook whistles. A crate appears at your shutter. 'First pick. Fair prices. For friends.'" },
      { id: 'quiet_night', name: 'Watch the Shop', cost: 80, minRep: 25, effects: { breakInChance: 0, nights: 2 },
        text: "'Two nights, nobody so much as breathes on your shutter. Promise.'" },
      { id: 'lean_on_seller', name: 'Lean on a Supplier', cost: 60, minRep: 40, effects: { supplierPriceMult: 0.85, nights: 1 },
        text: "'Market's going to be very reasonable with you tomorrow. Very.'" },
    ],
  },
  {
    id: 'wren', name: '0xWREN', faction: 'static', role: 'hacker_contact', screenOnly: true,
    personality: 'Only a voice and lowercase text on a cracked screen. Dry, curious, protective of the mesh.',
    homeWard: 'cistern_nine',
    portraitTraits: { screen: 'cracked_crt', glyph: 'wren_bird', palette: 'acid_green', noise: 'heavy' },
    lines: {
      greet: [
        'hello, shopkeeper. the rain sounds nicer through your mic.',
        "ping. you're up late. so am i. so is everyone who matters.",
        'connection is ugly tonight. so is the news. say something useful.',
        'hi. i read your ledger. you should encrypt it. also: nice margins.',
      ],
      tip_off: [
        'little bird says: {item} in {days} days. you did not hear it from a bird.',
        "something's coming. {item}. stock accordingly. don't thank me, pay me.",
        "the spire's calendar leaks like the sump. {item}, soon.",
      ],
      shard_buy: [
        'that shard on your shelf is screaming. i will take it off your hands for {price}.',
        'corp data. tasty. {price} and the tracer becomes my problem.',
        "bring me the ugly ones. the ones that ping. i pay better than the bounty.",
      ],
      scrub_offer: [
        "your heat is visible from orbit. {price} and i'll make you boring for a while.",
        "i can lose some of your file. {price}. vantage won't even notice what's missing.",
      ],
      courier: [
        "package needs legs. yours are adequate. interested?",
        'one box, one drop, no questions. you know the shape of it.',
      ],
      farewell: [
        'disconnecting. stay dry. stay weird.',
        '/quit. (that means bye.)',
        'the mesh remembers you kindly. for now.',
      ],
    },
    favors: [
      { id: 'scrub_heat', name: 'Scrub My File', cost: 150, minRep: 10, effects: { heat: -20 },
        text: "'done. you are now a florist, as far as vantage knows.'" },
      { id: 'tip_off', name: 'Buy a Tip-Off', cost: 60, minRep: 0, effects: { revealForecast: true, forecastCertainty: 1 },
        text: "'here is what the next three days look like. no refunds on fate.'" },
      { id: 'fence_shard', name: 'Quiet Shard Buyer', cost: 0, minRep: 20, effects: { sellTracerShardMult: 1.2 },
        text: "'send them over the mesh. i pay twenty percent more than street. for friends.'" },
    ],
  },
  {
    id: 'mama_ostra', name: 'Mama Ostra', faction: 'sump', role: 'neighbour',
    personality: 'Runs the noodle stand across the stairwell. Loud, nosy, generous, never wrong about weather.',
    homeWard: 'kettle_row',
    portraitTraits: { head: 'wide', skin: 'warm_tan', hair: 'black_bun_chopsticks', eyes: 'sharp', facialHair: 'none',
      implant: 'steam_goggles', clothing: 'apron_stained', accessory: 'ladle', boots: 'rubber', palette: 'amber' },
    lines: {
      greet: [
        'You eat today? You look like you did not eat today.',
        "Little {name}! Your aunt would be proud. Also worried. Mostly worried.",
        "I bring gossip and broth. The broth is free. The gossip costs you a smile.",
        "The stairwell is talking about you. Good things! Mostly.",
      ],
      warning: [
        "My knees say flood by the weekend. My knees are never wrong.",
        "Vantage boots on the lower landing this morning. Shiny ones. Be boring today.",
        "Rook's people were asking who pays and who doesn't. Just saying.",
        "Lights will go out soon. The pump-house men looked nervous. Buy candles.",
      ],
      charity: [
        'The Okonedo boy needs boots for school. You have spare? No? Some creds, then?',
        "Old Pell can't make rent this week. The stairwell is chipping in. You chip?",
      ],
      thanks: [
        'You are a good one. Like your aunt. Less handsome.',
        "The stairwell won't forget. I won't let it.",
        'Here. Dumplings. Do not argue with me.',
      ],
      gossip: [
        "Tamsin found a chandelier in the drains. She says. It's a lampshade.",
        'That Spire couple bought six of my noodle cones and took pictures. Rich people are weird.',
        "LEASEHOLD sent me a smiley face this morning. I have never been so frightened.",
        'The pump-house cat had kittens. The stairwell is taking bets on names.',
      ],
      farewell: [
        'Go. Sell things. Eat something.',
        "Close your shutter tonight. Double lock. I'll be watching. I'm always watching.",
        'Bye, sweetheart. Do not be a stranger. You literally live across from me.',
      ],
    },
    favors: [
      { id: 'neighbourhood_watch', name: 'Neighbourhood Watch', cost: 0, minRep: 30, effects: { breakInMult: 0.5, nights: 3 },
        text: "'The aunties will sit on your step. Nobody gets past the aunties.'" },
      { id: 'small_loan', name: 'Small Loan', cost: 0, minRep: 40, effects: { creds: 200, repayDays: 7, repayAmount: 220 },
        text: "'Two hundred. Pay me back in a week. With a little extra. For the worry.'" },
      { id: 'word_of_mouth', name: 'Spread the Word', cost: 30, minRep: 15, effects: { appeal: 10, nights: 2 },
        text: "'I tell everyone your prices are fair. Make them fair, then.'" },
    ],
  },
  {
    id: 'old_tamsin', name: 'Old Tamsin', faction: 'sump', role: 'scavenger',
    personality: 'Drain scavenger of uncertain age. Sells junk with tall tales; once in a while, a treasure.',
    homeWard: 'lowtide_steps',
    portraitTraits: { head: 'narrow', skin: 'weathered_pink', hair: 'white_wild', eyes: 'one_cloudy', facialHair: 'none',
      implant: 'rusty_cochlear', clothing: 'waders_patched', accessory: 'headlamp', boots: 'waders', palette: 'acid_green' },
    lines: {
      greet: [
        'Low tide, high spirits! Have I got a story for you.',
        "Don't mind the smell. That's the smell of opportunity. And eels.",
        "Tamsin's here! Clear the counter. Treasure incoming.",
        'You look like someone who appreciates history. Wet history.',
      ],
      tall_tale: [
        "This {item}? Pulled it from the mouth of a drowned statue. The statue winked at me.",
        'Belonged to a Spire duchess. She dropped it off a balcony for love. Or spite.',
        "Found this {item} guarded by a crab the size of a door. We came to an arrangement.",
        "Pre-flood, this. Older than the Spire. Older than me. Nearly.",
        "The pumps sang to me last night and pointed at this {item}. I don't argue with pumps.",
        'An eel tried to keep this. I explained property rights to the eel.',
      ],
      sell: [
        'For you, {price}¢. For anyone else, also {price}¢, but I would feel worse about it.',
        "{price}¢ and I'll throw in the story for free. Stories are usually extra.",
        'Make me an offer. Not that offer. A kinder offer.',
      ],
      treasure: [
        "This one's real. I know because my hands shook when I touched it.",
        "Don't laugh. This one's special. Even I'm not lying this time.",
      ],
      farewell: [
        'Back to the deep! Tide waits for no woman.',
        'If you hear singing in the drains, that is just me. Probably.',
        'Mind the third step. It bites.',
      ],
    },
    favors: [
      { id: 'tamsin_map', name: "Tamsin's Map", cost: 40, minRep: 20, effects: { nextDrainTreasure: true },
        text: "She draws a map on a napkin. It is mostly eels. 'X marks the good spot.'" },
    ],
  },
  {
    id: 'auction_drone', name: 'Auction Drone LQ-7', faction: 'none', role: 'auction',
    personality: 'Corp liquidation drone. Hovers in on Sundays selling sealed repossessed lots, blind. Cheerfully indifferent.',
    homeWard: 'meridian_gardens',
    portraitTraits: { drone: 'quadrotor', chassis: 'white_gloss', eye: 'single_red', logo: 'meridian_tile', palette: 'cyan' },
    lines: {
      greet: [
        'GOOD SUNDAY, VALUED RESIDENT. LIQUIDATION IS OPPORTUNITY.',
        'THIS UNIT BRINGS SEALED LOTS FROM ESTATES THAT NO LONGER NEED THEM.',
        'HELLO. YOU ARE ELIGIBLE TO BID. MOST THINGS ARE ELIGIBLE TO BID.',
        'SUNDAY CYCLE INITIATED. PLEASE DO NOT SWAT THE DRONE.',
      ],
      lot_pitch: [
        'LOT {item}: CONTENTS UNKNOWN. CONDITION UNKNOWN. PRICE: {price}¢. EXCITEMENT: KNOWN.',
        'THIS LOT WAS REPOSSESSED FROM A STACKS APARTMENT. THE OWNER WAS SAD. {price}¢.',
        'SEALED CRATE. WEIGHT SUGGESTS SOMETHING. {price}¢. NO REFUNDS. NO REGRETS (OPTIONAL).',
        'LOT FROM A BANKRUPT SPIRE BOUTIQUE. COULD BE SILK. COULD BE PACKING FOAM. {price}¢.',
      ],
      sold: [
        'SOLD. CONGRATULATIONS ON YOUR ACQUISITION. THIS UNIT FEELS NOTHING.',
        'TRANSACTION COMPLETE. MERIDIAN THANKS YOU FOR RECYCLING OTHER PEOPLE’S MISFORTUNE.',
        'SOLD. PLEASE OPEN AWAY FROM FACE.',
      ],
      unsold: [
        'UNDERSTOOD. LOT WILL BE INCINERATED. NO PRESSURE.',
        'NO BID RECORDED. THIS UNIT WILL TRY YOUR NEIGHBOUR.',
        'DECLINED. YOUR CAUTION HAS BEEN NOTED IN A FILE.',
      ],
      farewell: [
        'SEE YOU NEXT SUNDAY. OR SOMEONE LIKE YOU.',
        'DEPARTING. PLEASE REMAIN CALM AND SOLVENT.',
      ],
    },
  },
  {
    id: 'leasehold', name: 'LEASEHOLD', faction: 'none', role: 'landlord_ai', screenOnly: true,
    personality: 'Meridian Property Trust’s tenant-relations AI. Relentlessly polite. Texts only. Loves emoticons.',
    homeWard: 'meridian_gardens',
    portraitTraits: { screen: 'message_bubble', glyph: 'smiley_house', palette: 'amber' },
    lines: {
      // Full LEASEHOLD text pools live in feed.js (LEASEHOLD); these are short fallbacks.
      greet: ['Hello, valued tenant! :)', 'Good morning from Meridian Property Trust! :)'],
      farewell: ['Have a wonderful, rent-positive day! :)'],
    },
  },
];

export const NPCS = freezeDeep(RAW);
export const NPC_BY_ID = Object.freeze(Object.fromEntries(NPCS.map((n) => [n.id, n])));
