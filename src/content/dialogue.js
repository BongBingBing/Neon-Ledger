// Neon Ledger — counter dialogue line pools. All lines original.
//
// DIALOGUE[situation] = [{ text, faction?, mood?, tell? }]
//   faction: 'vantage'|'lantern'|'static'|'sump'|'spire'|'none' (omitted = anyone)
//   mood:    'happy'|'neutral'|'annoyed'|'angry' (omitted = any mood)
//   tell:    undercover-auditor tell id this line expresses (see TELLS.undercover)
// Placeholders: {item} {price} {name} {category} {shop} {ward}
// Pick a faction-matching line when one exists, else a generic one (engine/UI choice).
//
// Situations:
//   buyer_greet, buyer_want_category, buyer_want_item, buyer_no_match, seller_greet, seller_pitch,
//   haggle_counter, haggle_accept, haggle_insulted, haggle_walk, deal_done, seller_deal_done,
//   refuse, report_correct, report_wrong, chit_present, ghost_nervous, chit_accepted,
//   chit_rejected_ghost, chit_rejected_honest, undercover_greet, undercover_ask, undercover_bust,
//   undercover_refused, verifier_check, verifier_caught, chrome_return, charity_ask, credit_ask,
//   charity_thanks, charity_refused, tourist_wonder

import { freezeDeep } from './util.js';

const MOODS = ['happy', 'neutral', 'annoyed', 'angry'];
const FACTIONS = ['vantage', 'lantern', 'static', 'sump', 'spire', 'none'];

const POOLS = {
  buyer_greet: {
    any: [
      "Evening. Rain's coming sideways again.",
      'Hey. You open? You look open.',
      'Hi. Just looking. Okay, not just looking.',
      "Heard you're the new face in the old stall.",
      "Don't mind me dripping on your floor.",
      "Took four landings to find you. Worth it, I hope.",
    ],
    sump: [
      'Hey neighbour. Mama Ostra said you were fair.',
      "Evening! Stairwell's flooding again, so I'm shopping instead of sleeping.",
      'Hi. My kid sent me. My kid is very demanding.',
      "Your aunt used to give me a discount. Just mentioning it. No pressure.",
    ],
    lantern: [
      "Nice place. Be a shame if it stayed nice. That's a compliment.",
      "Rook says hi. Rook always says hi.",
      'Evening, shopkeeper. I am in a buying mood. Rare. Enjoy it.',
    ],
    static: [
      'hi. paying in creds, not in conversation.',
      "Your mesh signal's terrible. Your shop isn't. Hello.",
      "Don't log my face. Thanks. What've you got?",
    ],
    spire: [
      'Oh, how authentic. Is this a real shop? It smells real.',
      "We took the express lift all the way down! The guide said this is the 'vibrant' part.",
      "Hello! Darling, look, a little kiosk. How brave of them.",
      'I am slumming, officially. Sell me something with a story.',
    ],
    vantage: [
      'Off duty. Mostly. Just buying, citizen.',
      "Evening. Don't look so nervous. I'm on lunch.",
    ],
    none: [
      'Stacks born, Sump stuck. Hello.',
      "Got lost on the way to the lift. Might as well shop.",
    ],
  },

  buyer_want_category: {
    any: [
      'Looking for {category}. Anything decent.',
      'Need some {category}. Whatever you have that works.',
      "You do {category}? I'll look at anything.",
      'Anything in {category}? Not fussy. Fussy-ish.',
      "Show me your {category}. Don't show me the bad ones.",
      "I'm after {category}. Something to keep the lights on, so to speak.",
      "{category}, please. I've been told you're the stall for it.",
      "Got any {category}? My budget is modest. My hopes are not.",
    ],
    sump: [
      "Need {category} before the next flood. You know how it is.",
      "{category}, neighbour. The cheap good kind, not the cheap bad kind.",
    ],
    spire: [
      "Something {category}, but quirky. For my feed.",
      "Do you have any {category}? The rustic sort, ideally.",
    ],
    static: ['{category}. untraceable preferred. traceable tolerated.'],
    lantern: ['Need {category}. Quality stuff. I know the difference.'],
  },

  buyer_want_item: {
    any: [
      "You got a {item}? I've been searching all week.",
      'Looking for a {item}. Specifically. Exactly. Please.',
      "Someone said you might have a {item}.",
      "{item}. That's what I need. That's all I need.",
      "Do you stock {item}? I'll pay fair. Fairish.",
      "My {item} died. I'm in mourning. And in the market.",
      "Need a {item} tonight. Tomorrow is too late, trust me.",
      "Please tell me there's a {item} on that shelf.",
    ],
    spire: [
      "I simply must have a {item}. Everyone up top is mad for them.",
      "Is that a {item}? Down here? How marvellous. Price?",
    ],
    sump: ["Kid's birthday. They want a {item}. Help me be a hero."],
    lantern: ["The boss wants a {item}. The boss doesn't like waiting."],
    static: ['{item}. need it for a project. the project is a secret.'],
  },

  buyer_no_match: {
    any: [
      "Nothing, huh? I'll try the stalls upstairs.",
      "Not what I need. Thanks anyway.",
      "That's not it. Maybe next time.",
      "No luck. Keep an eye out for me?",
      "Hm. No. I'll keep walking.",
      'Closer than the last place, still not it.',
      "Ah well. The search continues.",
      "Nope. But your sign's nice.",
    ],
  },

  seller_greet: {
    any: [
      "Got a {item} here. Thinking {price}¢. Interested?",
      "Want to buy a {item}? {price}¢ and it's yours.",
      "I need to sell this {item}. {price}¢, quick, no fuss.",
      "{item}, good shape. {price}¢. Final offer. Mostly final.",
      'Brought you a {item}. I was told you pay fair. {price}¢ is fair.',
      "Rent's due. Here's a {item}. {price}¢?",
      "This {item} needs a new home. {price}¢ adoption fee.",
      "Clearing out my late uncle's things. {item}, {price}¢.",
    ],
    sump: [
      "Neighbour! Got a {item}. {price}¢ and I can pay the pump fee this month.",
      'Found this {item} in a flooded flat. Nobody claimed it. {price}¢?',
    ],
    lantern: [
      "{item}. Don't ask where from. {price}¢.",
      "Fell off a lift. Very sad. {item}, {price}¢.",
      "This {item} is very lonely, very portable, and {price}¢.",
    ],
    static: [
      'one {item}, lightly used, heavily mysterious. {price}¢.',
      "{item}. found it in a dead drop nobody came for. {price}¢.",
    ],
    spire: [
      "I'm told you people buy things? This {item}. {price}¢, I suppose.",
      "Redecorating. This {item} just doesn't spark joy. {price}¢?",
    ],
    none: ['Moving to the Stacks. Selling this {item}. {price}¢, no haggling. Okay, some haggling.'],
  },

  seller_pitch: {
    any: [
      "Works perfectly. Barely used. Practically new.",
      'Mint condition. Well, mint-adjacent.',
      "Never been dropped. Never been dropped hard.",
      'Runs like a dream. A nice dream. Not a weird one.',
      "Got it checked last week. Clean bill of health.",
      "There's a scratch, but it's a character scratch.",
      "One owner. Very careful. Owned a cat, but a careful cat.",
      "Honest to the rain, nothing wrong with it.",
    ],
    lantern: ["Quality goods. I don't move junk. Much."],
    sump: ["I wouldn't sell you rubbish. We share a stairwell."],
  },

  haggle_counter: {
    happy: [
      "Ooh, close! Meet me at {price}¢?",
      "I like you. {price}¢ and we're friends.",
      'Ha! Almost. {price}¢ and it’s done.',
      "Getting warmer. {price}¢?",
      "Let's not fight. {price}¢, handshake?",
    ],
    neutral: [
      'How about {price}¢?',
      "I could do {price}¢.",
      "Not quite. {price}¢.",
      "{price}¢. That's reasonable, isn't it?",
      'Meet me partway. {price}¢.',
      "Counter: {price}¢. Your move.",
    ],
    annoyed: [
      "Come on. {price}¢. Don't make me beg.",
      "You're pushing it. {price}¢.",
      "{price}¢ and I'm already regretting it.",
      'Look, {price}¢. My patience is wet cardboard.',
      "Fine. {price}¢. Last good mood I have.",
    ],
    angry: [
      "{price}¢. Take it or I walk.",
      "Last time: {price}¢. Then I'm gone.",
      "{price}¢, or I tell the whole stairwell you're a crook.",
      "{price}¢. Final. Truly final. Look at my face.",
    ],
  },

  haggle_accept: {
    any: [
      "Deal. {price}¢ it is.",
      "Fine, fine. {price}¢.",
      "{price}¢? You drive a hard bargain. Done.",
      'Alright. {price}¢. Shake on it.',
      "Can't argue with {price}¢. Well, I could. I won't.",
      "Done. You're good at this.",
      "{price}¢. Sure. My grandmother would be ashamed.",
      "Okay! {price}¢. Let's do it before I change my mind.",
    ],
    spire: ["{price}¢? How charming. Yes, why not."],
    lantern: ["{price}¢. Rook'll hear you're fair."],
  },

  haggle_insulted: {
    any: [
      "Are you joking? Is this a joke shop now?",
      'Wow. No. Just — wow.',
      "That's not an offer, that's an insult with numbers.",
      "I came here in good faith. Good faith is leaving.",
      'Did the rain get in your brain?',
      "My cousin would be furious. I'm only very upset.",
      "Try that again and I'm gone.",
      "You must think I fell off a ferry.",
    ],
    lantern: ["Careful. People get hurt being that cheap."],
    spire: ['I beg your pardon? I am from Aurum Heights.'],
    static: ['lol. no.'],
  },

  haggle_walk: {
    any: [
      "Forget it. I'll take my creds elsewhere.",
      "No deal. Good luck with your shop.",
      "I'm done. Enjoy the rain.",
      'Nope. Walking. Watch me walk.',
      "You lost a customer today. Hope it was worth it.",
      "Never mind. There's a stall on the Gantry.",
      "That's it. I'm telling Mama Ostra.",
      "I've got better things to do. Like stand in the flood.",
    ],
    lantern: ["Disappointing. Rook will hear about this."],
    sump: ["Thought you'd be better than this. Thought wrong."],
    spire: ['How tiresome. We are going back up.'],
    static: ['/leave'],
  },

  deal_done: {
    any: [
      'Pleasure doing business.',
      "Thanks! Exactly what I needed.",
      "Brilliant. You've saved my week.",
      'Cheers. I’ll be back.',
      "Lovely. Stay dry.",
      "Perfect. Better than the stall on the Gantry.",
      "Done and done. See you around the stairwell.",
      "You're alright, shopkeeper.",
    ],
    sump: ["You're a good neighbour. I'll tell people."],
    spire: ["Wonderful! I'll tell everyone I found it in the Sump. They'll be appalled."],
    lantern: ["Nice. You're on the good list."],
    static: ['transaction complete. you were never here.'],
    vantage: ['Appreciated. Keep your shelf boring.'],
  },

  seller_deal_done: {
    any: [
      "Thanks. That'll cover the pump fee.",
      'Good doing business. Take care of it.',
      "Pleasure. Don't tell anyone where you got it.",
      'Done. Rent is paid, crisis delayed.',
      "Cheers. It's your problem now. I mean, your treasure.",
      "Great. I'll buy my kid something nice. Or rice.",
      'Thanks. Lighter bag, heavier wallet.',
      "Lovely. I'll bring you more if I find any.",
    ],
    lantern: ["Smart buy. Smarter if you forget my face."],
  },

  refuse: {
    any: [
      "Your loss.",
      "Fine. I'll find someone who wants it.",
      'Okay, okay. I can take a hint.',
      "Huh. Alright then.",
      "You'll regret that. Probably not. But maybe.",
      "No? Shame. Have a dry night.",
      "Suit yourself, shopkeeper.",
      'Right. Off I go, then.',
    ],
    lantern: ["Turning down Lantern business. Bold."],
    sump: ["Thought neighbours helped neighbours. Okay."],
    spire: ['How rude. Is this a cultural thing?'],
  },

  report_correct: {
    any: [
      "You called Vantage on me? You little —",
      'Hey! Get off — I know my rights!',
      "This is a mistake. A big one. For you.",
      "Fine. FINE. I'm going.",
      'You snitch. The whole stairwell will know.',
      "Rook's going to hear about this, and Rook remembers.",
      "Officers, I can explain. I cannot explain.",
      "Should've known. New faces are always narcs.",
    ],
  },

  report_wrong: {
    any: [
      "You reported me? For what? Buying socks?",
      "Unbelievable. I'm an honest customer!",
      "The officer laughed at you. I'll laugh at you too.",
      "Wasting Vantage time on me? The neighbours will love this.",
      "I'll tell everyone how you treat people here.",
      'Never coming back. Never.',
      "They searched me in front of everyone. Thanks.",
      "My mum shops here. Shopped here. Past tense.",
    ],
  },

  chit_present: {
    any: [
      'Here, tap my chit.',
      "Paying by chit. Hope that's fine.",
      'Chit okay? I never carry creds.',
      'Here you go. Credchit. Tap away.',
      "Chit's good. Probably. Kidding. It's good.",
      'There you are. Quick, my lift leaves soon.',
      "Swipe it. Don't read my balance, it's embarrassing.",
      'One credchit, slightly damp.',
    ],
    spire: ['Will a Meridian Platinum do? It is the only one I have.'],
  },

  ghost_nervous: {
    any: [
      "Here's my chit. Can we be quick? I'm late. For a thing.",
      'Just tap it, yeah? No need to look closely.',
      "It's a perfectly normal chit. Very normal.",
      "Don't hold it to the light, it's — the light's bad. Just tap.",
      "Chit, here. My cousin's. I mean mine. Mine.",
      'Sorry, the hologram does that. Old chit. Sentimental.',
      'Quick quick, my friend is waiting outside. With engines.',
      "The expiry? It's renewed. They just didn't update the print.",
      "Name's spelled weird on it. Clerk error. Happens all the time.",
      "That's my old ward code. I moved. Recently. Very recently.",
    ],
  },

  chit_accepted: {
    any: [
      "Thanks. Pleasure.",
      'Cheers!',
      "Lovely. Bye!",
      "Great, thanks. Goodnight.",
      'Done. Nice doing business.',
      "Ta. See you.",
      'Brilliant, thank you.',
      "Thanks. Don't spend it all at once. Ha.",
    ],
  },

  chit_rejected_ghost: {
    any: [
      "Fine. Whatever. Wasn't my chit anyway.",
      "Worth a try. No hard feelings? Some hard feelings.",
      'How did you — never mind. Bye.',
      "Okay, okay, I'm going. Don't call anyone.",
      "You've got sharp eyes. Annoying, but sharp.",
      'Your aunt never checked. Times change, huh.',
      "Damn. Thought the Sump didn't check chits.",
      "Right. Running now. Bye.",
    ],
  },

  chit_rejected_honest: {
    any: [
      "What? That's my real chit! My real name!",
      "Are you serious? I've had that chit ten years.",
      "You think I'm a forger? Do I look like a forger?",
      "Insulting. Deeply. I'll shop elsewhere.",
      "Wow. Okay. Paranoid much?",
      'My mother gave me that name. Spelled like that.',
      "I'll be telling the whole stairwell about this.",
      "Fine. Keep your goods. Keep your suspicion too.",
    ],
  },

  // Undercover Vantage plants — each line expresses a tell in its phrasing.
  undercover_greet: {
    'tell:formal_phrasing': [
      'Good evening. I wish to make a purchase, in a personal capacity.',
      'Greetings, proprietor. I am a resident of this ward. A regular one.',
      'Hello. I am an ordinary citizen engaged in ordinary commerce.',
      'Good evening. Kindly describe the nature of your inventory.',
      'I am here as a member of the public. Purely and entirely.',
    ],
    'tell:knows_too_much': [
      "Evening. You're the one who took over the Stall on day one, yes?",
      "Hi. Your power bill's been low lately. For a shop with a charger. Interesting.",
      "Evening. Nice tile by the counter. Very... removable-looking.",
      "Hello. You were at the Drowned Market at 2:14 last night. Lovely evening for it.",
    ],
    'tell:badge_mismatch': [
      "Yo. Totally Lantern, me. Big Lantern energy. What's good.",
      "Hey, fellow neighbour. I am extremely Sump. Love those pumps.",
      'sup. i am a hacker. very static. ones and zeroes.',
    ],
  },

  undercover_ask: {
    'tell:formal_phrasing': [
      'I am seeking to acquire goods of an irregular provenance. For personal use.',
      'Do you, in the course of business, offer items not covered by permit?',
      "For the record — that is, for my records — do you sell {item}?",
      'I would like to purchase contraband. Hypothetically. And then actually.',
      'Please confirm whether {item} is available for unlicensed sale.',
    ],
    'tell:knows_too_much': [
      "I hear you've got a {item}. Serial ending in, oh, any number. Just curious.",
      "Word is there's a {item} under your floor. Second tile from the left?",
      "Someone sold a {item} here Tuesday. I'd like the same. The exact same.",
      "I know you've got something hot. I know roughly how hot. Show me.",
    ],
    'tell:badge_mismatch': [
      "Hook me up with something hot, fellow criminal. Like we do. Daily.",
      'give me the illegal stuff please. as a hacker. which i am.',
    ],
  },

  undercover_bust: {
    any: [
      'Thank you. Vantage Security. That item is now evidence.',
      "And that's a sale. Inspector Halloran will be in touch. Smile.",
      "Recorded. Logged. Confiscated. Have a pleasant evening, citizen.",
      'You have the right to remain disappointed.',
      "Gotcha. Nothing personal. Quota's due Friday.",
      'Lovely doing business. My supervisor thanks you.',
      "Badge, see? Shiny. Your Heat just went way up.",
      'Evidence bag. Your item goes in the evidence bag.',
    ],
  },

  undercover_refused: {
    any: [
      'Very well. I shall note that you were... compliant.',
      "Hm. Smart. Annoyingly smart.",
      'Understood. I will continue my ordinary citizen walk.',
      "Fine. I'll find another shop. Perhaps a less careful one.",
      'Noted. Good evening. Very good evening.',
      'Your caution has been observed. By me. A civilian.',
      "Right. Well. I'll just be — leaving. Normally.",
      "Hm. Rook told you about me, didn't he.",
    ],
  },

  verifier_check: {
    spire: [
      "You don't mind if I scan it? Just habit.",
      'One second, darling, let me ask my verifier. It is very clever.',
      "My assistant insists I verify everything. Ever since the incident.",
      'Hold still, little scanner. Tell mummy if it is real.',
      "I'll just run it past my app. It's terribly sensitive.",
      'Do you mind? Spire insurance requires a scan.',
      'Let me — beep. Sorry, the verifier always beeps.',
      "Scanning. Don't take it personally, I scan my husband too.",
    ],
  },

  verifier_caught: {
    spire: [
      "Counterfeit! In my hands! I feel unclean. Refund, now.",
      'My verifier says FAKE. In capitals. Explain.',
      "How dare you. I'm reporting this to the brand.",
      'Oh, this is hilarious. And illegal. Refund, please.',
      "I knew it was too cheap. Give me my creds back.",
      'A forgery! How quaint. How criminal. Refund.',
      "I'll be filing a complaint with the maker. And with Vantage.",
      "Do you know who I am? Neither does your fake label.",
    ],
  },

  chrome_return: {
    any: [
      'This {item} you sold me? It glitches. Every hour. On the hour.',
      "Your {item} made my arm wave at strangers. I want a refund.",
      'The {item} died. I nearly died. Refund.',
      "Remember this {item}? It remembers me. Badly. Refund.",
      "Your 'refurbished' {item} buzzes in my skull. Money back.",
      'I trusted you with my body. The {item} is broken. Pay up.',
      "My doctor laughed at this {item}. Then she cried. Refund.",
      "This {item} sparked. Inside me. I'd like my creds back.",
    ],
  },

  charity_ask: {
    sump: [
      "I'm short this week. Could you spare a little? I'll pay it back. Someday.",
      'My kid needs medicine. I need {price}¢. I know that is a lot.',
      "Flood took my stall. Anything helps. Even a little.",
      "Could you spare {price}¢? The pump fee's due and I'm empty.",
      "I hate asking. I'm asking. {price}¢?",
      "The landlord AI sent me a smiley. You know what that means. {price}¢?",
      'Not for me. For Gran. She needs filters. {price}¢?',
      "Just {price}¢. I'll mop your floor for a week.",
    ],
  },

  credit_ask: {
    any: [
      "Can I take it now and pay you Friday? Honest Friday.",
      "Put it on my tab? I'm good for it. Mostly.",
      'I get paid tomorrow. Credit till then?',
      "Could you front me this? I'll bring double. Well, extra.",
      "Your aunt used to let me pay later. Tradition?",
      "I'm good for it. Ask anyone. Don't ask Rook.",
      'Half now, half when the rain stops?',
      "I'll leave my coat as a deposit. It's a good coat.",
    ],
  },

  charity_thanks: {
    any: [
      "You're a saint. A wet, tired saint.",
      'I won’t forget this. Ever.',
      "Thank you. The stairwell will hear about this.",
      'Bless you and your stall.',
      "I'll pay you back. I mean it this time.",
      "My kid's going to draw you a picture. Brace yourself.",
      'You are your aunt’s kin, alright.',
      "Thank you. I'll tell Mama Ostra you're good people.",
    ],
  },

  charity_refused: {
    any: [
      'Right. I understand. Times are hard.',
      "Okay. Sorry I asked.",
      "No, it's fine. It's fine. It is.",
      'I get it. Everyone has their own floods.',
      "Okay. Maybe next week.",
      "Sure. Didn't hurt to ask. Hurt a little.",
      "Fine. I'll ask Ostra. She always says yes.",
      'Alright. Stay dry, shopkeeper.',
    ],
  },

  tourist_wonder: {
    spire: [
      "Is that rain coming through the ceiling? How atmospheric.",
      "Everyone's so resourceful down here! It's inspiring. From a distance.",
      'Our guide says nobody here has seen the sun. Is that true? How sad. Anyway, prices?',
      'I adore the smell. What is it? Oh. Oh, I see.',
      "We're doing the Sump tour. Next stop is the noodle lady!",
      "This is real Sump fashion, isn't it? I'll wear it to brunch.",
      "Do you live here? In the stall? No? Oh good.",
      "I'll pay extra if it's genuinely from down here.",
    ],
  },
};

function compile(pools) {
  const out = {};
  for (const [situation, groups] of Object.entries(pools)) {
    const lines = [];
    for (const [key, texts] of Object.entries(groups)) {
      for (const text of texts) {
        const line = { text };
        if (key.startsWith('tell:')) line.tell = key.slice(5);
        else if (FACTIONS.includes(key)) line.faction = key;
        else if (MOODS.includes(key)) line.mood = key;
        lines.push(line);
      }
    }
    out[situation] = lines;
  }
  return out;
}

export const DIALOGUE = freezeDeep(compile(POOLS));

/** Tells the player can learn to spot. `where` = how the tell is shown. */
export const TELLS = freezeDeep({
  undercover: [
    { id: 'vantage_boots', label: 'Regulation-issue boots', where: 'portrait',
      hint: 'Polished black boots with a blue toe-stripe. Nobody in the Sump has dry boots like that.' },
    { id: 'formal_phrasing', label: 'Talks like a report', where: 'dialogue',
      hint: "'In a personal capacity'. 'For the record'. Real people don't talk like forms." },
    { id: 'knows_too_much', label: 'Knows too much', where: 'dialogue',
      hint: 'Mentions your stash, your power bill, or last Tuesday. Strangers should not know that.' },
    { id: 'badge_mismatch', label: "Badge doesn't fit the outfit", where: 'portrait',
      hint: 'A Lantern pin on a pressed suit. A Static glyph on someone who calls it "the mesh thingy".' },
  ],
  ghost: [
    { id: 'name_mismatch', label: 'Name misspelt', where: 'chit', hint: 'One letter off from the name they gave you.' },
    { id: 'ward_mismatch', label: "Ward code doesn't fit", where: 'chit', hint: 'A Sump regular with a Spire ward code? Sure.' },
    { id: 'sigil_glitch', label: 'Hologram flickers', where: 'chit', hint: 'Real sigils turn smoothly. Forged ones skip a frame.' },
    { id: 'expired', label: 'Expired chit', where: 'chit', hint: 'Check the date against today.' },
  ],
});

export const DIALOGUE_SITUATIONS = Object.freeze(Object.keys(POOLS));
