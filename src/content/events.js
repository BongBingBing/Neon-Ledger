// Neon Ledger — calendar events (DESIGN §11, plus originals).
//
// Fields: id, name, durationDays: [min, max], weight (random roll weight; 0 = scheduled only),
//   minDay (earliest start), cooldownDays (min gap before it can roll again), forecastDays: [min, max] warning,
//   recurring? ({ everyNDays, offset } — e.g. Sunday auction on day % 7 === 0),
//   effects (vocabulary below), feedText: { forecast, start, end } ({days} = days until start)
//
// Effect vocabulary (engine consumes what it supports; unknown keys are ignored):
//   demandMult: { category|trade: mult }   buyer frequency for a category
//   sellPriceMult: { category: mult }      buyers' reservation prices
//   marketPriceMult: { category|itemId: mult } supplier prices at night
//   sellerMult: { category: mult }         how often sellers bring that category
//   footTrafficMult                        customers/day multiplier
//   touristMult                            share of 'spire' customers
//   auditThreshold                         overrides Heat audit threshold
//   undercoverMult, ghostChitMult, breakInMult, duesMult
//   gridDown                               machines need a charged cell to run (consumes 1 cell_pocket+ per machine)
//   brandRaidChance                        nightly chance of a brand-enforcement raid (counterfeits on shelf/storage)
//   leaseHike                              one-off fractional hike to the next lease
//   tracerWeightMult                       multiplier on corp-shard outcomes when scanning
//   recallReturnMult                       chance multiplier of old chrome sales coming back
//   spoilFaster                            perishables lose this many extra days
//   scanPowerMult                          Shard Scanner power cost multiplier
//   appeal                                 flat appeal bonus while active
//   repGainMult: { faction: mult }
//   auction                                the Auction Drone visits today

import { freezeDeep } from './util.js';

const RAW = [
  {
    id: 'blackout', name: 'Blackout', durationDays: [2, 3], weight: 10, minDay: 5, cooldownDays: 8, forecastDays: [1, 2],
    effects: { demandMult: { power: 3, food: 1.2 }, sellPriceMult: { power: 1.4 }, gridDown: true, breakInMult: 1.3 },
    feedText: {
      forecast: 'Pump-house crews say the lower grid is failing. Blackout likely in {days} days.',
      start: 'BLACKOUT. The Sump goes dark. Every cell you own just became gold.',
      end: 'Power is back. The stairwell cheers, then complains about the bill.',
    },
  },
  {
    id: 'flood_week', name: 'Flood Week', durationDays: [4, 6], weight: 7, minDay: 8, cooldownDays: 14, forecastDays: [2, 3],
    effects: { footTrafficMult: 0.7, demandMult: { food: 1.6, power: 1.5, sundry: 1.3 } },
    feedText: {
      forecast: 'Tide charts are ugly. Flood Week expected in {days} days. Stock up, move up.',
      start: 'FLOOD WEEK. Water on the third landing. Fewer customers, hungrier ones.',
      end: 'The water drains back to the sea. It leaves a smell and a lot of opinions.',
    },
  },
  {
    id: 'spire_gala', name: 'Spire Gala', durationDays: [3, 4], weight: 6, minDay: 10, cooldownDays: 14, forecastDays: [2, 3],
    effects: { touristMult: 3, demandMult: { luxury: 2 }, sellPriceMult: { luxury: 1.2 }, brandRaidChance: 0.18 },
    feedText: {
      forecast: 'The Spire Gala starts in {days} days. Expect tourists. Expect brand lawyers.',
      start: 'GALA WEEK. The express lifts are full of sequins heading down for "authentic nightlife".',
      end: 'The Gala ends. The Sump sweeps up glitter for a month.',
    },
  },
  {
    id: 'crackdown', name: 'Crackdown', durationDays: [3, 5], weight: 6, minDay: 12, cooldownDays: 12, forecastDays: [1, 2],
    effects: { auditThreshold: 40, undercoverMult: 2 },
    feedText: {
      forecast: 'Vantage announces a "community safety initiative" in {days} days. That means you.',
      start: 'CRACKDOWN. Extra patrols, extra audits, extra polite strangers asking for contraband.',
      end: "Vantage's initiative concludes. Safety has been achieved, says a press release.",
    },
  },
  {
    id: 'chrome_recall', name: 'Chrome Recall', durationDays: [3, 4], weight: 5, minDay: 9, cooldownDays: 15, forecastDays: [1, 2],
    effects: { demandMult: { chrome: 2 }, sellPriceMult: { chrome: 1.3 }, sellerMult: { chrome: 1.5 }, recallReturnMult: 1.5 },
    feedText: {
      forecast: 'Rumour: a big implant maker is about to recall a whole product line. Watch chrome prices.',
      start: 'RECALL. Half the Stacks just got told their chrome might explode. Refurbs are in demand.',
      end: 'The recall settles. Lawyers win, as tradition requires.',
    },
  },
  {
    id: 'shard_leak', name: 'Shard Leak', durationDays: [2, 4], weight: 5, minDay: 10, cooldownDays: 15, forecastDays: [1, 1],
    effects: { sellPriceMult: { shard: 1.6 }, sellerMult: { shard: 2 }, tracerWeightMult: 3, demandMult: { shard: 1.5 } },
    feedText: {
      forecast: '0xWREN: "a corp vault is about to spring a leak. shards will rain. so will tracers."',
      start: 'SHARD LEAK. A corp data vault spilled. Every scavenger has shards. Many of them ping.',
      end: 'The leak is "contained", which means the good shards are already gone.',
    },
  },
  {
    id: 'turf_war', name: 'Turf War', durationDays: [3, 5], weight: 5, minDay: 14, cooldownDays: 16, forecastDays: [1, 2],
    effects: { duesMult: 2, breakInMult: 1.5, demandMult: { chrome: 1.3, stolen_goods: 1.3 } },
    feedText: {
      forecast: 'Lantern crews and a Stacks gang are squaring up. Trouble in {days} days.',
      start: 'TURF WAR. Lantern dues doubled. Skipping them now would be very brave.',
      end: 'The turf war ends with a handshake and a lot of new tattoos.',
    },
  },
  {
    id: 'market_adjustment', name: 'Market Adjustment', durationDays: [1, 1], weight: 4, minDay: 6, cooldownDays: 13, forecastDays: [1, 3],
    effects: { leaseHike: 0.10 },
    feedText: {
      forecast: 'LEASEHOLD: Exciting news! A market adjustment is coming to your lease soon! :)',
      start: 'LEASEHOLD: Your next lease payment has been adjusted by +10%! Thank you for growing with us! :)',
      end: '',
    },
  },
  {
    id: 'sunday_auction', name: 'Sunday Auction', durationDays: [1, 1], weight: 0, minDay: 7, cooldownDays: 0, forecastDays: [1, 1],
    recurring: { everyNDays: 7, offset: 0 },
    effects: { auction: true },
    feedText: {
      forecast: 'Meridian Liquidations: the auction drone visits tomorrow with sealed lots.',
      start: 'SUNDAY. A white drone hums down the stairwell, crates swinging beneath it.',
      end: '',
    },
  },

  // ── Original additions ─────────────────────────────────────────────────
  {
    id: 'low_tide_feast', name: 'Feast of the Low Tide', durationDays: [2, 2], weight: 4, minDay: 9, cooldownDays: 20, forecastDays: [2, 3],
    effects: { demandMult: { food: 2, sundry: 1.3 }, appeal: 10, repGainMult: { sump: 1.5 } },
    feedText: {
      forecast: 'The lowest tide of the season comes in {days} days. The Sump will feast on the dry steps.',
      start: 'LOW TIDE FEAST. Lanterns on the water, food on every step. Everyone is hungry and kind.',
      end: 'The tide comes back. The feast ends. Someone always cries, happily.',
    },
  },
  {
    id: 'algae_bloom', name: 'Algae Bloom', durationDays: [3, 4], weight: 4, minDay: 8, cooldownDays: 15, forecastDays: [1, 2],
    effects: { marketPriceMult: { feedstock: 2, kelp_bundle: 2.5, krill_paste: 1.8 }, spoilFaster: 1, demandMult: { sundry: 1.2 } },
    feedText: {
      forecast: 'The vats in the Stacks are going green. Feedstock prices will spike in {days} days.',
      start: 'ALGAE BLOOM. Feedstock doubles in price. Everything smells like a pond.',
      end: 'The bloom fades. Feedstock is beige again. Hooray for beige.',
    },
  },
  {
    id: 'move_out_day', name: 'Move-Out Day', durationDays: [1, 2], weight: 4, minDay: 7, cooldownDays: 12, forecastDays: [1, 2],
    effects: { sellerMult: { tech: 2.5, salvage: 2, sundry: 1.5 }, marketPriceMult: { tech: 0.7, salvage: 0.7 }, repGainMult: { sump: 1.2 } },
    feedText: {
      forecast: 'Meridian is "rebalancing occupancy" in the lower Stacks. Evictions in {days} days.',
      start: "MOVE-OUT DAY. Evicted Stacks tenants are selling everything they can't carry.",
      end: 'The stairwell is full of new faces and old furniture.',
    },
  },
  {
    id: 'mesh_storm', name: 'Mesh Storm', durationDays: [1, 3], weight: 4, minDay: 11, cooldownDays: 12, forecastDays: [1, 1],
    effects: { ghostChitMult: 2, scanPowerMult: 2, demandMult: { tech: 1.4 } },
    feedText: {
      forecast: '0xWREN: "sun flare inbound. the mesh will stutter. check chits twice."',
      start: 'MESH STORM. Chit networks lag; forgers love lag. Scanners are struggling.',
      end: 'Signal returns. Everyone checks their balance and screams.',
    },
  },
  {
    id: 'lantern_wedding', name: 'Lantern Wedding', durationDays: [2, 2], weight: 3, minDay: 15, cooldownDays: 25, forecastDays: [2, 3],
    effects: { duesMult: 0, demandMult: { luxury: 1.5, food: 1.3 }, breakInMult: 0.5, repGainMult: { lantern: 1.5 } },
    feedText: {
      forecast: "Rook's cousin is getting married in {days} days. Lantern dues are waived for the party.",
      start: 'LANTERN WEDDING. Paper lanterns on every landing. Dues waived. Nobody robs anyone. Tradition.',
      end: 'The wedding ends. The dues come back. Romance is dead.',
    },
  },
];

export const EVENTS = freezeDeep(RAW);
export const EVENT_BY_ID = Object.freeze(Object.fromEntries(EVENTS.map((e) => [e.id, e])));
