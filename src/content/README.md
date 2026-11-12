# src/content — Neon Ledger game content

Pure data ES modules, no DOM, no side effects. Every export is deep-frozen (`util.js#freezeDeep`).
Ids are unique `snake_case`; money is integer ¢. Import everything via `index.js`.
Each list module also exports a `*_BY_ID` lookup map (for example `ITEM_BY_ID` or `MACHINE_BY_ID`).

All names, items, brands, characters, places and lines are original writing (DESIGN §0).

## Files

| File | Exports | Contents |
|---|---|---|
| `items.js` | `ITEMS`, `ITEM_BY_ID`, `CATEGORIES`, `CATEGORY_LABELS`, `TRADES` | 70 items across all 9 categories and all 6 Trades plus general goods |
| `brands.js` | `BRANDS`, `BRAND_BY_ID` | 6 Upper-Spire luxury brands, 3 genuine marks each, plus fakes per slot |
| `npcs.js` | `NPCS`, `NPC_BY_ID` | Halloran, Rook, 0xWREN, Mama Ostra, Old Tamsin, Auction Drone LQ-7, LEASEHOLD |
| `names.js` | `NAMES`, `WARDS`, `WARD_BY_ID`, `HOME_WARD`, `MISSPELL_SWAPS` | Name parts per faction (incl. `spire`, `none`), 15 wards with chit codes |
| `dialogue.js` | `DIALOGUE`, `DIALOGUE_SITUATIONS`, `TELLS` | 32 counter situations, at least 8 lines each; tells for undercover auditors and ghost chits |
| `events.js` | `EVENTS`, `EVENT_BY_ID` | The 9 DESIGN §11 events plus 5 originals |
| `machines.js` | `MACHINES`, `MACHINE_BY_ID` | The 9 machines from DESIGN §8 |
| `recipes.js` | `RECIPES`, `RECIPE_BY_ID` | 17 workshop recipes (refurb, scan, wipe, charge, cook, label) |
| `upgrades.js` | `UPGRADES`, `UPGRADE_BY_ID` | 15 shop upgrades (shelf, storage, stash, utility) |
| `permits.js` | `PERMITS`, `PERMIT_BY_ID` | Med-Tech and Power Resale permits (Vantage) |
| `licences.js` | `LICENCES`, `LICENCE_BY_ID` | Knock-off and Hot Goods licences (Lantern) |
| `perks.js` | `PERKS`, `PERK_BY_ID` | 12 perks |
| `jobs.js` | `JOBS`, `JOB_BY_ID` | 4 DESIGN night jobs plus Pump Watch (honest, low pay) |
| `backgrounds.js` | `BACKGROUNDS`, `BACKGROUND_BY_ID` | The 6 canonical backgrounds |
| `difficulties.js` | `DIFFICULTIES`, `DIFFICULTY_BY_ID` | drizzle, acid, downpour |
| `endings.js` | `ENDINGS`, `ENDING_BY_ID`, `WIN_BY_FACTION`, `DEFAULT_WIN`, `WIN_MIN_REP` | 5 wins and 4 losses, 106–115 words each |
| `feed.js` | `LEASEHOLD`, `NEWS`, `HOTLIST`, `AUDIT_WARNINGS`, `CONTACT_MESSAGES`, `INCIDENTS`, `SUMMARY_QUIPS` | Dawn Feed text: 45 news lines, LEASEHOLD pools, overnight incident reports |
| `util.js` | `freezeDeep` | Helper only |
| `index.js` | everything | Barrel re-export |

Placeholders used in text: `{item} {price} {name} {category} {shop} {ward} {amount} {days} {day} {count} {fine}`.
The validator checks that no other placeholder appears.

## Extra fields (beyond ARCHITECTURE §5)

The engine may ignore any of these. Each one is also documented in the header comment of its file.

### items.js
- `trade` is the Trade the item belongs to: `chrome`, `shards`, `power`, `kitchen`, `knockoff`, `fencing` or `general`.
- `market` is the relative weight for appearing in the night market. `0` means suppliers never sell it; it only comes from sellers, machines, jobs or the auction.
  - Chrome in the market is meant to be sold as-is: low condition (about 20–60) and `untested`.
- `buyers` lists the customer factions most likely to ask for the item. It is a hint for buyer generation.
- `grade` (chrome only) is `'A'` for med-grade, which is `legality:'permit'` with `permit:'med_tech'`, or `'B'` for street-grade, which is legal.
- `tracer: true` marks corp shards (`legality:'contraband'`).
- `blank` on a luxury item points to the cheap blank it is forged from. `knockoffOf` on the blank points back.
- `serialPrefix` (stolen_goods) is a 2-letter prefix for generating serials, e.g. `SH-48213`.
- `marks` is filled automatically from the item's brand.
- `basePrice` is street value at full condition. Audit fines use it (R2).
  - Chrome basePrice is the refurbished, fully working price.
  - Counterfeit luxury items use the genuine item's id, so they carry the genuine basePrice. That is the "genuine" price they sell for, and it is also what a fine on them costs.
- Legality choices:
  - All `stolen_goods` are `contraband`. They are fenced by definition.
  - Stack and brick cells need the `power_resale` permit. Pocket cells are legal, so a Sparky start is not illegal on day 1.

### brands.js
- `fakeMarksBySlot[i]` holds near-miss forgeries of `marks[i]`. A counterfeit swaps exactly one genuine mark for one fake from the same slot. `fakeMarks` is the flat list the schema asks for.
- `line` and `tagline` are flavour.

### machines.js
- `kind` is `'workshop'` (runs recipes) or `'passive'` (always-on effect).
- Other fields: `powerPerNight`, `breakdownChance`, `repairCost`, `requires {machines?, licence?}`, `illegal`, `effects`.
- Effects:

  | Machine | Effects |
  |---|---|
  | `cell_charger` | `maxBatch: 4` |
  | `grid_tap` | `illegal: true`, `chargePowerMult: 0`, `heatPerNight: 4`, `fireChance: 0.04`, `fireDestroys {items:[1,3], machineChance:0.3}` |
  | `security_shutter` | `breakInMult: 0.5` |
  | `neon_sign` | `appeal: 15` |
  | `floor_cavity` | `stash: 2` (the Fence background owns it, which gives DESIGN's 2 stash slots) |

- `label_printer` requires the `knockoff` licence, following DESIGN §4 ("Label Printer; Lantern licence").

### recipes.js
- `kind` is one of `refurb`, `scan`, `wipe`, `charge`, `cook` or `label`.
- `inputs` lists one input set: `[{ itemId? | category?, qty, exclude? }]`.
- `outputs` is `[{ itemId, qty, flags? }]`.
- `outcomes` is `[{ itemId, weight, flags? }]` and is used by scan.
- `transform` is `{ conditionGain, conditionCap, clearFlags, revealCondition }`. Refurb keeps the same uid.
- `maxBatch` is the number of input sets per run. `days` is how long a run takes.
- `powerCost` and `partsCost` are ¢ per input set.
- `risk` holds `{ poisonChance }` for stretched noodles or `{ failChance }` for refurbs.
- Scanning junk returns `shard_blank` directly (the scanner auto-wipes junk).
- `wipe_shard` turns any shard, corp shards included, into a legal `shard_blank`. It is the "bury it" option and it clears the tracer.
- Stretched noodles produce `vat_noodles` with `flags.cut`.
- Label recipes produce the luxury item with `flags {counterfeit, labelled}`.

### backgrounds.js
- Fields: `capacity` (overrides; machine effects apply on top), `rep`, `startInventory [{itemId, qty, location, condition?, quality?, flags?}]`, `twist`, `blurb`, `intro`.
- The intro mentions the late aunt by name: **Aunt Merle**.

### difficulties.js
- Fields: `leaseBase`, `leaseGrowth`, `lateFee`, `deedPrice`, `patienceMod`, `heatGainMult`, `ghostChitMult`, `auditThreshold`, `crackdownThreshold`, `undercoverMinHeat`, `priceMult`.

### npcs.js
- Fields: `personality`, `homeWard`, `screenOnly` (0xWREN and LEASEHOLD never get a portrait), `portraitTraits` (descriptive hints; the UI maps or ignores them).
- `favors` is `[{ id, name, cost, minRep, effects, text }]` for `CONTACT_FAVOR`. Effect keys used: `heat`, `revealForecast`, `forecastCertainty`, `revealAuditOdds`, `marketHotGoods`, `breakInChance`, `breakInMult`, `nights`, `supplierPriceMult`, `sellTracerShardMult`, `creds` with `repayDays`/`repayAmount` (loan), `appeal`, `nextDrainTreasure`.

### events.js
- Fields: `cooldownDays`, `forecastDays [min,max]`, `recurring { everyNDays, offset }` (Sunday auction: `weight 0`, every 7 days).
- Effect vocabulary is listed in the file header: `demandMult`, `sellPriceMult`, `marketPriceMult`, `sellerMult`, `footTrafficMult`, `touristMult`, `auditThreshold`, `undercoverMult`, `ghostChitMult`, `breakInMult`, `duesMult`, `gridDown`, `brandRaidChance`, `leaseHike`, `tracerWeightMult`, `recallReturnMult`, `spoilFaster`, `scanPowerMult`, `appeal`, `repGainMult`, `auction`.
- Original events: `low_tide_feast`, `algae_bloom`, `move_out_day`, `mesh_storm`, `lantern_wedding`.

### dialogue.js
- Each line is `{ text, faction?, mood?, tell? }`. `tell` marks an undercover line whose phrasing expresses that tell.
- `TELLS.undercover` (`vantage_boots`, `formal_phrasing`, `knows_too_much`, `badge_mismatch`) and `TELLS.ghost` (`name_mismatch`, `ward_mismatch`, `sigil_glitch`, `expired`) give a label, where it shows (`portrait`/`dialogue`/`chit`) and a hint for onboarding.

### names.js
- `vantage.titles` holds rank prefixes for on-duty officers only. `static.handles` holds Static handles (style `'handle'`).
- `WARDS[].code` is the chit ward code. `tier` is `sump`, `stacks` or `spire`. `factions` lists likely residents, for detecting ghost-chit ward mismatches.
- `MISSPELL_SWAPS` lists letter swaps for forged chit names.
- `HOME_WARD` is `kettle_row`, the ward the Stall is in.

### endings.js
- Fields: `trigger` (a descriptive machine-readable summary; the engine owns the rule), `epitaph` (one line for the stats card), `faction` and `minRep` (wins).
- Text placeholder: `{shop}`.

### upgrades / permits / licences / perks / jobs
- `upgrades.effects` keys: `shelf`, `storage`, `stash`, `appeal`, `referenceIndex`, `chitLamp`, `floodTrafficBonus`, `spoilDaysBonus`, `chargeBatchBonus`, `refurbConditionBonus`, `probeBonus`.
- `permits`:
  - Fields: `minRep`, `repDiscount` (fraction off per +10 Vantage rep), `maxDiscount`, `legalizes`.
  - `med_tech` also has `effects.chromeRefundMult`.
- `licences`:
  - Fields: `minRep`, `loseBelowRep`, `weeklyFee`.
  - Effects: `unlocksMachines`, `brandRaidMult`, `fenceSellMult`, `fenceBuyMult`, `hotSellerMult`.
- `perks.effects` keys: `patienceBonus`, `highlightChitField`, `heatGainMult`, `nightJobs`, `supplierPriceMult`, `sumpRepGainMult`, `poisonChanceMult`, `spoilDaysBonus`, `probeBonus`, `refurbFailMult`, `showReservationHint`, `bribeChanceBonus`, `bribeCostMult`, `drainSalvageBonus`, `injuryChanceMult`, `tracerHeatMult`, `gridFireMult`.
- `jobs`:
  - Fields: `requires.rep`, `pay [min,max]`, `rep`, `heat`, `salvageRolls`, `salvageTable`, `risk {injuryChance, heatSpikeChance}`, `text {offer, success[], injury?, fail?}`.
  - `courier_static` requires Static ≥ −20. `collection_rook` requires Lantern ≥ 20 (DESIGN).

## Values taken from DESIGN
- Lease: base 350¢, ×1.15 per week (×1.10 Drizzle, ×1.20 Downpour), 25% late fee.
- Deed: 30,000¢ normal, 24,000¢ Drizzle, 37,500¢ Downpour.
- Background starting creds and rep: Tinker 400, Shard Diver 400 (+5 Static), Sparky 450, Line Cook 450 (+10 Sump), Fence 350 (+15 Lantern, −10 Vantage, 2 stash slots), Nobody 60.
- Heat: Drizzle heat gain ×0.75 and +1 patience. Downpour −1 patience. Audit threshold 60, 40 during a Crackdown. Undercover auditors appear above 30 Heat.
- Grid Tap adds +4 Heat per night. Security Shutter halves break-ins. Market Adjustment is +10% on the next lease.
- Capacities: shelf 6→12, storage 10→30, stash 2→4→6.
- Collection run needs Lantern ≥ 20. Win flavour needs rep ≥ 40.

## Tuning guesses (not in DESIGN — please balance-test)
- **Machine costs:**

  | Machine | Cost |
  |---|---|
  | Repair Bench | 300¢ |
  | Shard Scanner | 350¢ |
  | Cell Charger | 250¢ |
  | Grid Tap | 200¢ |
  | Vat Cooker | 280¢ |
  | Label Printer | 400¢ |
  | Security Shutter | 300¢ |
  | Neon Sign | 220¢ |
  | Floor Cavity | 350¢ |

- **Machine running costs:**
  - Power per active night: 2–8¢.
  - Breakdown chance: 1–3% per active night. Repair: 40–90¢.
  - Grid Tap fire chance is 4% per night. A fire destroys 1–3 items, with a 30% chance it also breaks a machine.
- **Recipe economics:**
  - Charging costs 6¢ (pocket), 10¢ (stack) or 16¢ (brick) per cell.
  - Normal noodles: 2 feedstock make 4 bowls. Stretched noodles: 2 feedstock plus 1 filler make 6 bowls, with a 12% poisoning chance.
  - Krill cakes and kelp broth: 1 ingredient plus 1 feedstock make 3 portions.
  - Patch refurb: +25 condition, capped at 85, 15¢ parts, 5% fail chance. Full rebuild: +55 condition, capped at 100, 60¢ parts, 2 days.
  - Scan: 5¢ per shard. Wipe: 2¢.
  - Label: 3¢ power plus 1 Label Stock (10¢) per item.
- **Scan outcome weights:** blank/junk 50, concert 16, family 12, skyline 7, mailbox 7, ledger 5, schematic 3. About 15% of scans turn up corp data.
- **Perishables:**

  | Item | Spoils after |
  |---|---|
  | cooked food | 2 days |
  | kelp broth | 3 days |
  | kelp | 3 days |
  | krill paste | 4 days |
  | feedstock | 6 days |
  | rice bars | 14 days |

- **Upgrades:**

  | Upgrade | Steps and costs |
  |---|---|
  | Shelf | 150 / 300 / 550¢ (+2 each step) |
  | Storage | 100 / 220 / 450¢ (+5 / +5 / +10) |
  | Stash | 300 / 500¢ |
  | Reference Index | 200¢ |
  | Chit Lamp | 180¢ |
  | Awning | 120¢ |
  | Paint | 90¢ |
  | Cold Box | 180¢ |
  | Charging Rack | 160¢ |
  | Precision Tools | 240¢ |

- **Permits:**
  - Med-Tech: 600¢ plus 40¢ per week. Power Resale: 300¢ plus 20¢ per week.
  - Minimum Vantage rep −20. 3% off per +10 rep, capped at 30%.
- **Licences:**
  - Knock-off: 350¢ plus 25¢ per week, Lantern ≥ 15.
  - Hot Goods: 400¢ plus 30¢ per week, Lantern ≥ 25. Fence sell prices ×1.15, buy prices ×0.9.
- **Night job pay:**

  | Job | Pay |
  |---|---|
  | Courier | 60–110¢, +6 Heat |
  | Ostra's | 15–30¢ |
  | Collection run | 90–160¢ |
  | Pump Watch | 30–45¢ |
  | Drain diving | 2 salvage rolls, 12% injury chance |

- **Event weights, durations and cooldowns:** see `events.js`.
  - Blackout sell-price multiplier for power cells: ×1.4.
  - Gala brand-raid chance: 18% per night.
- **Favors:**

  | Favor | Cost | Effect |
  |---|---|---|
  | 0xWREN scrub | 150¢ | −20 Heat |
  | Tip-off | 60¢ | reveals the forecast |
  | Halloran friendly word | 200¢ | −15 Heat |
  | Ostra loan | free | 200¢, repay 220¢ after 7 days |

- **Neon Sign:** +15 Appeal.
