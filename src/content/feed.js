// Neon Ledger — the Dawn Feed: LEASEHOLD texts, news ticker, Hot List flavour, contact messages,
// audit warnings and overnight incident reports.
// Placeholders: {amount} {days} {day} {shop} {item} {count} {fine} {serials} {name}

import { freezeDeep } from './util.js';

/** Meridian Property Trust's tenant AI. Chirpy. Sinister. Always a smiley. */
export const LEASEHOLD = freezeDeep({
  welcome: [
    "Welcome to your new tenancy at {shop}! We're so sorry about your aunt. Rent is due in {days} days! :)",
    "Hi! I'm LEASEHOLD, your tenant companion! I'll be with you every step of the way. Every step. :)",
  ],
  reminder: [
    'Friendly reminder: {amount}¢ due in {days} days! You can do it! :)',
    "Just checking in! {days} days until your {amount}¢ payment. I believe in you! :)",
    "Did you know? Paying on time keeps your tenancy wonderful! {amount}¢ in {days} days. :)",
    "Your lease misses you! It'll see you in {days} days for {amount}¢. :)",
    "Good morning! {days} days, {amount}¢, endless possibilities! :)",
    "Thinking of you! And of {amount}¢. In {days} days. :)",
  ],
  due_tomorrow: [
    "Tomorrow's the big day! {amount}¢! I've set a reminder for both of us! :)",
    "Only one sleep until rent! {amount}¢! I'm so excited for you! :)",
    "Eve-of-lease greetings! {amount}¢ tomorrow. Don't be a stranger! :)",
  ],
  due_today: [
    "Today's the day! {amount}¢ will be collected when you close up. :)",
    "Lease day! {amount}¢ tonight. We'll take it automatically, so you don't have to worry! :)",
    'Happy Lease Day! {amount}¢ at close of business. :)',
  ],
  paid: [
    'Payment received! Thank you for choosing to keep living here! :)',
    "Got it! {amount}¢. You're one of our favourite tenants. Don't tell the others. :)",
    "Lease paid! Next one is a little bigger. That's growth! :)",
    "Thank you! Your account is in good standing. Standing is good! :)",
  ],
  paid_early: [
    "Early payment! You're an overachiever and we love that for you! :)",
    "Wow, ahead of schedule! Your diligence has been noted in your file. :)",
  ],
  missed: [
    "Oh no! We didn't receive {amount}¢. A small 25% courtesy fee has been added. You have 7 days! :)",
    "Uh-oh! Payment missed! That's okay. Everyone gets one. Exactly one. :)",
    "We noticed a missed payment. We notice everything! {amount}¢ is now overdue. :)",
  ],
  grace: [
    'Grace period: day {day}. Overdue: {amount}¢. We are being very graceful. :)',
    "Just a nudge! {amount}¢ overdue. Our Transition Associates are standing by. Just in case! :)",
    "Your grace period ends in {days} days. Grace is a gift. Gifts end. :)",
  ],
  final_warning: [
    "Final reminder! If {amount}¢ isn't received by tonight, your tenancy will conclude. :)",
    "Tonight is very important! {amount}¢. Otherwise we'll have to say goodbye. :( Just kidding! :)",
    'This is our last friendly message! The next one is less friendly! {amount}¢ tonight. :)',
  ],
  escalation: [
    'Good news! Your lease has grown to {amount}¢ per week, just like you! :)',
    'Annual-weekly review complete! New lease: {amount}¢. Thank you for growing with Meridian! :)',
    "Your lease is now {amount}¢! Inflation is a natural phenomenon, like rain. :)",
  ],
  market_adjustment: [
    "Exciting update! Market conditions have adjusted your next lease by +10%! :)",
    "A neighbour of yours did very well this week, so your rent did too! +10%! :)",
    'Meridian analysts have revalued your stairwell! Congratulations! +10% rent! :)',
  ],
  deed: [
    "Did you know? The Deed to {shop} can be yours for just {amount}¢! :)",
    "Ownership is a journey! Your journey costs {amount}¢. :)",
    "Imagine never hearing from me again! Only {amount}¢! Think about it! :)",
  ],
  idle: [
    'Reminder: stairwells are for walking, not living! :)',
    'Meridian has noticed water on your floor. Water is not covered by your lease. :)',
    "Your neighbour reported a smell. We've added a scent assessment to your file! :)",
    'Tenants who smile pay 12% more on time! Try smiling! :)',
    "Please stop taping over the corridor camera. It's lonely. :)",
    "We have updated our terms of tenancy. Don't worry about it. :)",
    'Fun fact: your stall used to be a broom cupboard! Look how far you have come! :)',
    "Flooding is a feature of your ward's character! :)",
  ],
});

/** News ticker. Lines with eventId hint at / follow that event; others are ambient. */
export const NEWS = freezeDeep([
  { text: 'Meridian Property Trust reports record quarterly occupancy. "Stairwells are the new studios," says CEO.' },
  { text: 'Vantage Security unveils new patrol drones. Drones "only slightly armed".' },
  { text: 'Sump pump-house 4 celebrates 100 days without catastrophic failure. Cake served damp.' },
  { text: 'Upper Spire residents vote to rename the cloud deck "the Ceiling". Sump residents not consulted.' },
  { text: 'Feedstock futures steady. Taste futures remain bleak.' },
  { text: 'Local cat elected honorary pump inspector. Cat declines comment.' },
  { text: 'Lift 9 out of service again. Engineers blame "general wetness".' },
  { text: 'Gallery in Aurum Heights reports theft of holoprint. "We had no idea it was there," admits curator.' },
  { text: 'Implant maker apologises for firmware that made 3,000 users hum the company jingle.' },
  { text: 'Vantage: crime in the Sump down 4%. Sump: reporting crime down 40%.' },
  { text: "Kelp yields up on the drowned tram lines. Kelp farmers 'cautiously green'." },
  { text: 'Study finds Sump residents see 11 minutes of sunlight a year, mostly on shards.' },
  { text: 'Lantern Syndicate sponsors stairwell lighting project. Lights are, coincidentally, lantern-shaped.' },
  { text: 'New Spire tower to be "the tallest thing ever built by people who will never visit the bottom".' },
  { text: 'Counterfeit credchits rising, warns Meridian Bank. "Check the sigil," they advise. "And the spelling."' },
  { text: 'The Static claims responsibility for every billboard in Saltglass showing pictures of ducks.' },
  { text: 'Tide charts predict a wet month. Locals ask: as opposed to what.' },
  { text: 'Stacks clinic reports theft of medical kits. Sump clinic reports sudden excellent supplies.' },
  { text: 'Brand enforcement agents seized 400 fake Corvane wristpieces. Real Corvanes "more expensive, feel worse".' },
  { text: "Grid operator reminds residents unlicensed taps 'void your warranty, and possibly you'." },
  { text: "Pre-flood coin sells for 9,000¢ at Spire auction. Diver who found it 'was paid in soup'." },
  { text: 'Mesh outage blamed on "a seagull, probably". The Static denies being a seagull.' },
  { text: 'Vantage recruitment drive: "Join us. Dry boots guaranteed."' },
  { text: 'Noodle prices stable for 40th straight week. Noodle quality also stable. Stably beige.' },
  { text: 'Upper Spire influencer visits Sump, describes it as "giving drowned chic". Sump does not know what that means.' },
  { text: 'Meridian unveils LEASEHOLD 2.0: "Now with more feelings."' },
  { text: 'Lowtide Steps residents build a bridge out of doors. Doors\' owners unaware.' },
  { text: 'Eel sightings up in Cistern Nine. Eels "unbothered", reports scientist.' },
  { text: 'Synth-silk shortage hits Spire fashion week. Designers forced to use "regular" silk.' },
  { text: 'Pump-house union negotiating for "fewer surprises". Management offers "different surprises".' },
  { text: 'Vantage audits up 12% this quarter. "We are simply very curious," says spokesperson.' },
  { text: 'Corporate data vault reports "zero breaches". Static responds with a single laughing emoji.' },
  { text: 'Lower grid load hits record high. Engineers advise "maybe stop charging everything".', eventId: 'blackout' },
  { text: 'Tide models flash amber for the lower wards. Sandbag prices rise.', eventId: 'flood_week' },
  { text: 'Spire Gala guest list leaked. Theme: "Authentic Grit". Sequins mandatory.', eventId: 'spire_gala' },
  { text: 'Vantage Commissioner promises "visible presence" in the Sump. Residents promise invisibility.', eventId: 'crackdown' },
  { text: 'Whistleblower claims implant line "fails at a fun rate". Company denies "fun".', eventId: 'chrome_recall' },
  { text: 'Unusual traffic around a Spire data vault. Security "not worried". Static "very not worried".', eventId: 'shard_leak' },
  { text: 'Graffiti war on the Gantry escalates. Someone painted over a Lantern. That was a mistake.', eventId: 'turf_war' },
  { text: 'Meridian quarterly review: "Lower-ward rents undervalued." Tenants: oh no.', eventId: 'market_adjustment' },
  { text: 'Vat farms in the Stacks report "an exciting new colour". The colour is green.', eventId: 'algae_bloom' },
  { text: 'Meridian occupancy notice posted in the lower Stacks. Residents asked to "pre-pack".', eventId: 'move_out_day' },
  { text: 'Solar observatory warns of flare activity. Mesh may "hiccup dramatically".', eventId: 'mesh_storm' },
  { text: 'Lantern families announce a wedding. Every florist in the Sump is suddenly busy.', eventId: 'lantern_wedding' },
  { text: 'Tide tables show the lowest ebb in years. The dry steps will be open for feasting.', eventId: 'low_tide_feast' },
]);

/** Hot List (morning list of stolen serials Vantage wants found). */
export const HOTLIST = freezeDeep({
  intro: [
    'VANTAGE HOT LIST — report sightings for a bounty. Possession is evidence.',
    "Today's wanted serials. Seen one? Vantage pays. Lanterns remember.",
    'Stolen property bulletin. Check your shelves. Check your conscience.',
    'HOT LIST: the following items were reported stolen in the last 72 hours.',
  ],
  empty: [
    'Hot List is empty today. Either the Spire is honest or Vantage is tired.',
    'No new serials today. Enjoy the quiet. It will not last.',
  ],
  bounty: [
    'Bounty for reported hot goods: 20% of street value.',
    'Report a match, earn a bounty. Rook asks you to consider your health.',
  ],
  match: [
    'One of your items matches a serial on the Hot List: {item}.',
    "That {item} in your stock? It's on the list. Today, it's evidence.",
  ],
});

/** Dawn audit warnings. */
export const AUDIT_WARNINGS = freezeDeep({
  pending: [
    "VANTAGE NOTICE: an inspection of {shop} is scheduled for this morning. Please be present and boring.",
    'Inspector Halloran is on his way down the stairwell. Move what needs moving.',
    'Audit today. Your Heat finally caught up with you. You have a few minutes.',
    "Mama Ostra bangs on your shutter: 'Vantage coat on the stairs! Coming your way!'",
  ],
  rising: [
    'Your name is coming up in Vantage reports. Heat is rising.',
    "0xWREN: 'your file is getting thick. thin it out.'",
    "Halloran's drone has photographed your shutter twice this week.",
  ],
  survived: [
    'Inspection complete. You are still in business. Breathe.',
    'Halloran leaves. The stairwell exhales with you.',
  ],
});

/** Dawn messages from contacts (picked by rep/situation). */
export const CONTACT_MESSAGES = freezeDeep({
  mama_ostra: [
    'Ostra: Eat something today. I mean it.',
    "Ostra: The Okonedo kid's asking for you. Says your gum is the best gum.",
    "Ostra: Saw Vantage boots on the lower landing. Shiny ones. Careful.",
    "Ostra: My knees say rain. My knees always say rain. Today they're serious.",
  ],
  rook: [
    'Rook: Big week! Lot of shops forgetting their friends. You won’t, right? :)',
    "Rook: Heard a crew has something nice. I'll send them to you first.",
    'Rook: Missed you last night. Dues-wise. Just noticing.',
  ],
  wren: [
    'wren: your power bill is very honest. how boring. how safe.',
    'wren: someone was asking about you on the mesh. i told them you were a florist.',
    'wren: tracer pings off your block last night. not you? good. stay not you.',
  ],
  halloran: [
    'VANTAGE (D. Halloran): Reminder that unpermitted med-grade chrome is a finable offence.',
    'VANTAGE (D. Halloran): Bounties available for hot goods. Think about it.',
  ],
  old_tamsin: [
    "Tamsin: Tide's out tonight. The drains are calling. They call me 'Tam'.",
    'Tamsin: Found a thing. A good thing. A wet thing. Come diving.',
  ],
});

/** Overnight / sleep-time incident reports. */
export const INCIDENTS = freezeDeep({
  break_in: [
    'Break-in! The shutter was jimmied overnight. Missing: {item}.',
    "Someone got in last night. They took {item}. They left muddy footprints and a lantern drawing.",
    "Your lock is in pieces on the landing. So is your trust in people. Missing: {item}.",
  ],
  break_in_machine: [
    'Break-in! They smashed your {item} on the way out. Just to make a point.',
  ],
  grid_fire: [
    "FIRE. The grid tap sparked overnight. You saved most of the stall. Most.",
    'Smoke in the stairwell! The tap overheated. Lost: {item}.',
  ],
  food_poisoning: [
    "Half the stairwell is sick. They're saying it was your noodles. They're right.",
    'Food poisoning on Kettle Row. Mama Ostra is furious. With you.',
  ],
  brand_raid: [
    'Brand enforcement raid! Lawyers with scanners took {count} counterfeits. Fine: {fine}¢.',
    'A Spire brand agent in a beautiful suit seized your knock-offs. Fine: {fine}¢.',
  ],
  chrome_refund: [
    'A customer came back with a glitchy {item}. Refund paid. Reputation dented.',
    "Lawsuit notice: your {item} malfunctioned inside a client. Settlement: {fine}¢.",
  ],
  chit_bounced: [
    "A chit bounced overnight. The {amount}¢ you took evaporated like steam.",
    'Ghost chit! {amount}¢ gone. Somewhere a forger is laughing.',
  ],
  spoiled: [
    'Spoiled overnight: {item}. The smell is educational.',
    '{item} went off. Into the drain it goes.',
  ],
  machine_broke: [
    'Your {item} broke down overnight. Repair needed.',
    'Something went clunk in the night. It was your {item}.',
  ],
  injury: [
    'You wake sore and bandaged. Fewer customers today while you limp.',
  ],
  perk_point: [
    "Another week survived. You've learned something. (Perk point earned.)",
    'Seven more days in the Sump. You are getting good at this. (Perk point earned.)',
  ],
});

/** Sleep summary quips by how the day went. */
export const SUMMARY_QUIPS = freezeDeep({
  great: ['A good day. Even the rain sounded like applause.', 'Profitable. Suspiciously profitable. Enjoy it.'],
  ok: ['Not bad. Not great. Very Sump.', 'The shutter comes down on another honest-ish day.'],
  bad: ['A loss. Tomorrow is another day. With rent.', "Rough one. Mama Ostra sends noodles. Of course she does."],
});
