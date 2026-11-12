// Neon Ledger — endings (DESIGN §13). Texts are 80–150 words.
//
// Fields: id, title, win, faction? (win flavour chosen by highest rep ≥ minRep), minRep?,
//   trigger (machine-readable summary of the condition; the engine owns the actual rule),
//   epitaph (one line for the stats card), text ({shop} = shop name)
// Win selection: highest faction rep if ≥ 40 → that faction's ending, else 'own_name'.

import { freezeDeep } from './util.js';

const RAW = [
  {
    id: 'franchise_of_the_spire', title: 'Franchise of the Spire', win: true, faction: 'vantage', minRep: 40,
    trigger: { type: 'deed', faction: 'vantage' },
    epitaph: 'Licensed, laminated, and finally left alone.',
    text: "The Deed arrives by courier, embossed, with a Vantage seal you didn't ask for. Inspector Halloran comes by on his last day before retirement and hangs a little brass plaque by the shutter: APPROVED VENDOR. Within a month, Meridian offers to license {shop} as a template for \"safe neighbourhood commerce\". There are twelve of you now, in twelve stairwells, all with the same teal paint. The audits stopped. So did some of the customers who used to come at midnight with things wrapped in cloth. You sleep well. Mostly. Some nights you hear the rain on the shutter and wonder who the Sump goes to now, when it needs something nobody is allowed to sell.",
  },
  {
    id: 'made_in_the_sump', title: 'Made in the Sump', win: true, faction: 'lantern', minRep: 40,
    trigger: { type: 'deed', faction: 'lantern' },
    epitaph: 'Nobody touches your shop. Nobody would dare.',
    text: "You pay for the Deed in a single transfer, and Rook throws you a party on the landing that goes until the pumps change shift. Paper lanterns on every railing. A cake shaped like a padlock. \"You're one of us now,\" Rook says, warmly, and you understand it is both a gift and a contract. {shop} never gets robbed again. Never gets audited, either; Halloran's replacement learns which stalls to skip. The crews bring you their best first, and you take your cut, and you send flowers when someone doesn't come home. The Stall is yours. The stairwell is theirs. You have made your peace with the difference, most days.",
  },
  {
    id: 'free_node', title: 'Free Node', win: true, faction: 'static', minRep: 40,
    trigger: { type: 'deed', faction: 'static' },
    epitaph: 'The signal is free. So, finally, are you.',
    text: "The morning the Deed clears, the cracked screen in the corner flickers on by itself. \"congratulations, landlord,\" 0xWREN writes. \"now let's make it useful.\" By nightfall there is a mesh repeater on your roof, and another on the next landing, and another. {shop} becomes a free node: open signal for the whole stairwell, no meter, no Meridian. Kids do homework on your counter. Old Tamsin video-calls a sister she hasn't seen in fifteen years. Vantage hates it and cannot prove anything. You still sell noodles and cells and the occasional strange shard, but mostly you keep the lights on for other people's voices. It hums. It's yours.",
  },
  {
    id: 'heart_of_the_stairwell', title: 'Heart of the Stairwell', win: true, faction: 'sump', minRep: 40,
    trigger: { type: 'deed', faction: 'sump' },
    epitaph: 'Everyone knows your name. Everyone brings soup.',
    text: "When word gets out that you bought the Deed, the stairwell fills with people. Mama Ostra arrives first with a pot so large two neighbours carry it. Someone strings fairy lights. Someone else cries, then claims it's the steam. You were the one who gave credit when the pumps failed, who sold cells at cost during the blackouts, who never called Vantage on a desperate kid. {shop} isn't a kiosk anymore; it's where the Sump comes to borrow tools, leave messages, wait out the floods. Your aunt's photo hangs over the counter now. On wet nights, which is every night, the light in your window is the first thing people see coming home.",
  },
  {
    id: 'own_name', title: 'Your Own Name on the Door', win: true,
    trigger: { type: 'deed', faction: null },
    epitaph: 'Owed to no one. Owned by you.',
    text: "You transfer the last creds and LEASEHOLD sends one final message: \"Congratulations on your transition from tenant to owner! We'll miss you! :)\" Then, for the first time since your aunt died, your phone is quiet. You belong to no syndicate, no collective, no badge. You just kept the shutter up, day after day, and made more than you lost. You paint your own name on the door in careful letters, one coat, then another. {shop}. The rain runs down over it and doesn't wash it away. Mama Ostra brings noodles. Rook sends a card. The screen in the corner blinks once, like a wink. Tomorrow you open at the usual time.",
  },

  // ── Losses ──
  {
    id: 'evicted', title: 'Evicted', win: false,
    trigger: { type: 'lease_missed', count: 2 },
    epitaph: 'Thank you for your tenancy! :)',
    text: "LEASEHOLD's message arrives at 06:00 sharp, with a smiley face. \"Your tenancy has concluded! A Meridian Transition Associate will assist you with your belongings.\" The associate is a drone and a lock. By noon the shutter has a new padlock and your stock is in a skip on the landing, rained on. Mama Ostra lets you sleep behind her stand for three nights and doesn't ask questions. By the end of the week the Stall has a new tenant, a hopeful kid from the Stacks with a box of chargers. You think about warning them. Instead you buy a bowl of noodles from Ostra and watch them lift the shutter for the first time.",
  },
  {
    id: 'arrested', title: 'Arrested', win: false,
    trigger: { type: 'audit_unpayable', contrabandOver: 1000 },
    epitaph: 'Processed, filed, and forgotten.',
    text: "Halloran looks at the pile on your counter for a long time. \"I can't make this go away,\" he says finally, and he sounds sorry, which is somehow worse. The cuffs are cold and the lift ride up to the Vantage holding floors is the first time you've seen daylight in months: a grey smear through armoured glass. The fine is more than the Stall was ever worth. Meridian re-lets the kiosk within a week. In the holding block, someone from the Sump recognises you and slips you half a rice bar. \"You sold my mum her pacer,\" they say. \"It works.\" You hold onto that. It's the only thing they didn't confiscate.",
  },
  {
    id: 'taken_for_a_ride', title: 'Taken for a Ride', win: false,
    trigger: { type: 'lantern_wrath', maxRep: -60, unpaidNights: 5 },
    epitaph: "Rook still says you were a lovely neighbour.",
    text: "It's raining harder than usual when Rook comes by, alone, smiling. \"Let's go for a walk, neighbour. Just a little one.\" There's a car waiting at the top of the stairs, which is strange, because cars don't come down here. The ride is long and quiet and nobody says anything unkind. They leave you at the very edge of the city where the drowned towers stand in the sea like broken teeth, with a poncho and a pocket cell and the clear understanding that the Sump is closed to you now. The Stall's shutter is open again the next morning. Different face behind it. Same dues.",
  },
  {
    id: 'underwater', title: 'Underwater', win: false,
    trigger: { type: 'debt', below: -2000, days: 3 },
    epitaph: 'The debt rose faster than the tide.',
    text: "The numbers stop meaning anything after a while. Minus two thousand. Minus two thousand three hundred. The suppliers stop extending credit, then stop answering. The machines go quiet one by one as the power company cuts you off. LEASEHOLD sends a cheerful link to a \"debt consolidation partner\" whose terms are written in a font too small to read. On the third morning you pull the shutter down yourself, quietly, before anyone can do it for you. You leave the key under Mama Ostra's ladle with a note that just says sorry. Outside, the water is up to the fourth step. It always rises. You just couldn't climb fast enough.",
  },
];

export const ENDINGS = freezeDeep(RAW);
export const ENDING_BY_ID = Object.freeze(Object.fromEntries(ENDINGS.map((e) => [e.id, e])));

/** Map faction → win ending id (used when highest rep ≥ 40). */
export const WIN_BY_FACTION = Object.freeze({
  vantage: 'franchise_of_the_spire',
  lantern: 'made_in_the_sump',
  static: 'free_node',
  sump: 'heart_of_the_stairwell',
});
export const DEFAULT_WIN = 'own_name';
export const WIN_MIN_REP = 40;
