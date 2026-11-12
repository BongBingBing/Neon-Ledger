# NEON LEDGER — Game Design Document (v1)

> *"Every deal leaves a mark."*
> A cyberpunk shopkeeper sim for iPhone (installable web app / PWA).

Owner: Overseer (manager). Changes to this document go through the Overseer.

---

## 0. Originality rule (read first)

Neon Ledger is an **original game** in the shopkeeper-sim genre. It is inspired by the *genre* (running a shady shop under rent pressure, à la Papers Please / shop sims) but it is **not** a port, clone, or recreation of any existing game.

- Do **not** open, decompile, or extract anything from any installed commercial game on this machine.
- Do **not** use names, characters, items, places, dialogue, art, or UI from any existing game. In particular, none of the following may appear anywhere in code, content, or docs (other than this list): *Probably Stolen, augs / AI-chip hosts, Joe Wild, Dr. Jackson, Sawyer, Lou, Georgio, Officer Lun, Serpico, Eleanor, Rock Bottom, Questing Goose, tinyBuild*. No rat breeding, no water-grade/purification trade, no space-station setting.
- All art is generated procedurally in code (canvas / SVG / CSS). All text is written fresh.

---

## 1. Pitch

You inherit your late aunt's debt-soaked kiosk, **"the Stall"**, wedged into a stairwell of the **Sump** — the flooded bottom levels of **Halcyon Spire**, a mile-high arcology rising out of a drowned coastal megacity. The landlord, **Meridian Property Trust**, communicates only through **LEASEHOLD**, a relentlessly polite AI that texts you rent reminders with smiley faces.

The lease goes up every week. To be free, you must raise enough creds to **buy the Deed**. Honest work alone won't get you there fast enough. The best margins live in the grey: stolen goods, knock-offs, bootleg power, untested chrome, data that someone powerful wants to stay buried. Every one of those pays — and every one of them has its own way of ruining you.

Tone: neon-noir, wry, humane. Rain on the shutters, synth noodles, people trying to get by. Factions aren't good or evil — each one helps you and costs you.

## 2. Platform & feel

- iPhone, **portrait-first**, one-handed. Target viewport 390×844 (iPhone 14/15), must work 375×667 (SE) through 430×932 (Pro Max).
- Installable PWA ("Add to Home Screen"), fullscreen standalone, **fully offline**, autosaves.
- **No real-time pressure.** Customers wait patiently; the player can stop at any moment and resume exactly where they left off. (Players of the genre love the "just one more day" chill pacing.)
- A day takes ~3–6 minutes. Session-friendly.
- All tap targets ≥ 44×44 pt. Primary actions in the bottom third of the screen.

## 3. Core loop (one day)

1. **DAWN — the Feed.** A phone-style feed: news ticker (price shifts, upcoming events), messages from contacts, LEASEHOLD's countdown, Hot List (wanted stolen serials), audit warning if one is coming. Player may rearrange stock (shelf ↔ storage ↔ stash) before opening — critical on audit mornings. If an audit is pending it resolves now (§7.3).
2. **OPEN — the Counter.** Customers arrive one at a time (queue size from Appeal, §8). Each is a **Buyer**, **Seller**, or **Special**. Per customer the player can: inspect, haggle, deal, refuse, or report. Player taps **Close Shop** when the queue is empty (or early).
3. **NIGHT — the Back Room.** Tabs: **Market** (buy stock from suppliers; daily prices), **Workshop** (run machines: refurbish, scan, charge, cook, print labels), **Upgrades & Permits**, **Contacts** (faction favours), **Night Job** (one per night, optional). Pay or skip **Lantern dues**.
4. **SLEEP — Resolution.** Machines finish, food spoils, power bill charged, dues consequences (break-in?), heat decays/accumulates, audit check, events roll, lease charged on due day, autosave. Summary card shows the day's P&L.

## 4. Money IN — the six Trades

Each Trade is a product line with its own profit curve and its own way to hurt you. The player's **Background** (§10) picks a starting Trade; others unlock by buying the required machine/licence at night.

| Trade | How you profit | How it ruins you | Needs |
|---|---|---|---|
| **Chrome Refurb** | Buy busted second-hand implants cheap, diagnose & repair, sell refurbished. | Selling untested/glitchy chrome → it comes back: refund + rep loss, or a lawsuit fine. Unpermitted med-grade chrome adds Heat. | Repair Bench; Med-Tech Permit for grade-A |
| **Data Shards** | Buy used memory shards from scavengers, scan them. Junk → wipe & sell cheap (legal). Memories → sell to collectors. Corp secrets → sell to The Static (huge), return to Vantage (bounty), or hold. | Corp-secret shards carry a **tracer**: holding/selling them spikes Heat; scanning costs power. | Shard Scanner |
| **Power Cells** | Charge cells and sell to neighbours; demand ×3 during Blackouts. | Legit grid charging costs power. **Grid tap** (illegal) is free but adds Heat nightly and has a fire chance (lose stock / machine). | Cell Charger; optional Grid Tap |
| **Synth Kitchen** | Cook vat-noodles from feedstock; steady daily demand from Sump Folk. | Food spoils (freshness timer). **Stretch with filler** = more portions, but risk a food-poisoning event (big Sump rep hit, fine). | Vat Cooker |
| **Knock-offs** | Print fake labels on cheap goods and sell to slumming Spire tourists as genuine for huge markups. | Some tourists carry a **verifier** → refund + Heat. Brand-enforcement raids during Gala weeks. | Label Printer; Lantern licence |
| **Fencing** | Buy stolen goods from street crews at a steep discount, flip them. | Items on the morning **Hot List** are evidence; selling them is risky; reporting them gives a bounty but angers the Lanterns. | Nothing (but stash helps) |

Plus general goods anyone can trade: salvage, sundries, tech junk (low margin, legal) — the safety net.

## 5. Money OUT

- **The Lease.** Due every 7 days (day 7, 14, …). Normal: base 350¢, ×1.15 each week, plus occasional LEASEHOLD "market adjustment" hikes. Can pay early from the Ledger. Miss it → one week of **grace** with a 25% late fee added. Miss again → **Evicted** (game over).
- **Lantern dues** (protection). Offered nightly: max(15¢, 5% of total stock value). Skipping raises a break-in chance (25% + 10% per consecutive skip; reset on payment) that steals 1–3 items or breaks a machine.
- **Audits & fines** (§7.3). Confiscation + fine = 1.5× value of illegal goods found.
- **Bad buys.** Sellers lie about condition. Skipping inspection risks paying good money for junk.
- **Ghost chits** (§7.1). Accept a spoofed payment and the creds evaporate overnight.
- **Upkeep.** Nightly power bill per active machine; small breakdown chance (repair cost).
- **Spoilage, theft, fire, refunds, lawsuits.**

## 6. The Counter — customers & haggling

### 6.1 Customer card
Top of screen: procedural pixel portrait, name, faction badge, mood face, one line of dialogue. Middle: the item in question (theirs or the one they want) with condition, flags known to the player, and the asking/offer price. Bottom: action bar.

### 6.2 Customer kinds
- **Buyer** — wants a category ("anything to keep the lights on") or a specific item. Player picks a matching item from shelf (only shelf items can be sold at the counter). Has hidden **max price**.
- **Seller** — offers an item. Has hidden **min price**. The item may be stolen, counterfeit, damaged, or lied about.
- **Special** — recurring NPCs (contacts, collectors, Rook collecting dues, Inspector Halloran), the **Auction Drone**, desperate neighbours asking for credit/charity, story beats.

### 6.3 Haggling
- Customer has a hidden reservation price and **Patience** (3–5 pips).
- Player sets an offer with a big slider (snaps to 5¢) + **Offer** button; quick buttons for "their price", "+10%", "−10%".
- Each counter-offer the customer doesn't accept costs 1 patience; outrageous offers (>35% past their limit) cost 2. At 0 patience they walk out, small rep loss with their faction.
- Customer responds with a counter (moves partway toward the player) and a mood change shown on the portrait.
- Perk *Silver Tongue*: +1 patience. Faction rep shifts reservation prices ±10%.

### 6.4 Counter actions
**Deal** (at current price) · **Haggle** · **Inspect** (tool-dependent, §7) · **Refuse** · **Report** (calls Vantage: bounty if the customer was actually doing something illegal; −Lantern rep; if wrong, −Sump rep and the customer is gone).

## 7. Spot-the-tell systems (the "papers please" layer)

### 7.1 Ghost chits (spoofed payment)
Some buyers pay with a spoofed credchit. When a buyer pays, a **chit panel** shows: holder name, ward code, hologram sigil (animated), expiry. Tells (each ghost chit has 1–2):
- Name on chit ≠ customer's name (subtle misspelling).
- Ward code doesn't match the customer's stated home ward / faction.
- Hologram sigil glitches (flicker frame shown in the panel).
- Expired date.
Player can **Accept** or **Refuse** (or **Report** for a bounty). ~6% of buyers on day 1 rising to ~15% by day 40. Perk *Eagle Eye* highlights one suspicious field.

### 7.2 Undercover auditors
When Heat > 30, ~5% of customers are Vantage plants asking for illegal goods. Tells (1–2): Vantage-issue boots in the portrait, overly formal phrasing, knows too much, faction badge doesn't fit outfit. Selling to one: +25 Heat immediately and the sale is confiscated.

### 7.3 Heat & audits
- **Heat** 0–100. Sources: each illegal item on the shelf +2/day; selling contraband +3–8; corp-tracer shards +5/day held; grid tap +4/night; failed report; undercover sale +25. Natural decay −5/day. Perk *Low Profile*: −25% heat gain.
- At Sleep, if Heat ≥ threshold (60 Normal; 40 during a Crackdown event) → **Audit pending**; the Feed warns at dawn.
- **Dawn audit.** Before the inspector arrives the player can move items into the **stash** (limited slots, upgradable). Inspector Halloran checks shelf + storage (not stash; at high Heat he may check 1 stash slot). For each illegal item found: confiscate + fine 1.5× value. Options: **Comply** or **Bribe** (cost 20% of total penalty × (1 − vantageRep/200); success 50% + vantageRep/2 %; failure doubles the fine and −10 Vantage).
- If the fine can't be paid and the contraband value > 1,000¢ → **Arrested** (game over). Otherwise creds go negative (debt) and the lease still looms.
- After an audit, Heat resets to 20.

### 7.4 Inspection mini-games (short, touch, skippable at a cost)
- **Probe (Chrome):** 4×4 circuit grid; tap nodes to probe (5 probes); reveals faulty nodes. Finding all faults → accurate condition; repair cost known. Skipping = buy blind.
- **Appraise (Knock-offs/valuables):** item shows 3 maker's marks; compare with the **Reference Index** (unlockable book with genuine marks per brand). Fakes have 1 wrong mark.
- **Serial check (Fencing):** item serial vs today's Hot List.
- **Scan (Shards):** run the scanner overnight (costs power) to reveal shard contents.

## 8. Shop & progression

- **Shelf slots** (what customers see & can buy; drives which customers come): start 6, upgrades to 12.
- **Storage slots** (back room): start 10, upgrades to 30.
- **Stash slots** (hidden floor cavity, audit-safe): start 0, upgrades 2 → 4 → 6.
- **Appeal** 0–100: from Neon Sign, cleanliness, shelf variety, Sump rep. Customers/day = 6 + floor(Appeal/10), cap 14. Variety on the shelf attracts richer buyers.
- **Machines:** Repair Bench, Shard Scanner, Cell Charger, Grid Tap, Vat Cooker, Label Printer, Security Shutter (−50% break-in), Neon Sign (+Appeal), Floor Cavity (stash).
- **Permits** (legal, from Vantage): Med-Tech, Power Resale — make a trade's goods legal (no Heat) but cost creds + weekly fee.
- **Licences** (black market, from Lanterns): Knock-off licence, Hot Goods licence (better fence prices) — require Lantern rep.
- **Perks:** 1 perk point at the end of each week survived. Examples: *Silver Tongue* (+1 patience), *Eagle Eye*, *Low Profile*, *Night Owl* (2 night jobs), *Thrifty* (−10% supplier prices), *Good Neighbour* (+Sump rep gains), *Iron Stomach*… (≈10 perks).

## 9. Factions & contacts

Reputation tracks −100…+100.

| Faction | Who | High rep gives | Contact (original NPC) |
|---|---|---|---|
| **Vantage Security** | Corp police of the Spire | Lower fines, higher audit threshold, cheaper permits, bounties | **Inspector Dace Halloran** — tired, by-the-book, open to "fees" |
| **Lantern Syndicate** | Street mob running the Sump | Cheaper dues, better fence prices, black-market licences, stock | **Rook** — collects dues, cheerful, terrifying |
| **The Static** | Hacker collective | Buys corp shards, can scrub Heat for a price, tip-offs of events | **0xWREN** — only ever appears as a voice on a cracked screen |
| **Sump Folk** | Your neighbours | More customers, discounts, early warnings, help after disasters | **Mama Ostra** — runs the noodle stand across the stairwell |

Other recurring NPCs: **Old Tamsin** (drain scavenger, sells junk with tall tales, occasionally a treasure), **The Auction Drone** (a corp liquidation drone that hovers in on Sundays selling sealed repossessed lots blind — maybe treasure, maybe trash), **LEASEHOLD** (landlord AI, texts only).

Actions trade off: reporting a Lantern fence → +Vantage, −Lantern. Selling a corp shard to the Static → +Static, Heat. Giving a neighbour credit/charity → +Sump, −creds.

## 10. Backgrounds & difficulty

| Background | Start creds | Start Trade / kit | Twist |
|---|---|---|---|
| Tinker | 400 | Chrome Refurb, Repair Bench | — |
| Shard Diver | 400 | Data Shards, Shard Scanner | +5 Static |
| Sparky | 450 | Power Cells, Cell Charger | — |
| Line Cook | 450 | Synth Kitchen, Vat Cooker | +10 Sump |
| Fence | 350 | Fencing, 2 stash slots | +15 Lantern, −10 Vantage |
| Nobody | 60 | nothing | hard mode start |

Difficulty: **Drizzle** (easy: lease ×1.10/wk, +1 patience, Heat −25%), **Acid Rain** (normal), **Downpour** (hard: lease ×1.20/wk, Deed +25%, −1 patience, ghost chits more common).

## 11. Events (calendar)

Rolled at Sleep; most are forecast 1–3 days ahead in the Feed (more warning with Static/Sump rep or a paid tip-off from 0xWREN).
- **Blackout** (2–3 days): Power Cell demand ×3, machines without cells idle.
- **Flood Week**: foot traffic −30%, food & cell demand up.
- **Spire Gala**: tourists flood the Sump: Knock-off demand ×2, brand raids possible.
- **Crackdown**: audit threshold 40, undercover auditors ×2.
- **Chrome Recall**: refurb demand & prices up.
- **Shard Leak**: shard prices spike; tracer shards everywhere.
- **Turf War**: Lantern dues ×2, break-ins more likely if unpaid.
- **Market Adjustment**: LEASEHOLD hikes next lease +10%.
- **Sunday**: the Auction Drone visits.

## 12. Night jobs (one per night, optional)
- **Drain diving** with Old Tamsin: random salvage, small injury chance (injury = −1 customer next day).
- **Courier run** for the Static: pay + Static rep, +Heat.
- **Help at Mama Ostra's**: small pay, +Sump rep.
- **Collection run** for Rook (needs Lantern ≥ 20): good pay, −Sump rep.

## 13. Endings

**Win — Buy the Deed** (Normal 30,000¢; Downpour 37,500¢; Drizzle 24,000¢). Ending flavour by highest faction rep (if ≥ 40), else "Your Own Name on the Door":
- *Franchise of the Spire* (Vantage), *Made in the Sump* (Lantern), *Free Node* (Static — you turn the Stall into a free mesh hub), *Heart of the Stairwell* (Sump Folk).

**Lose:** *Evicted* (missed lease twice), *Arrested* (unpayable audit with major contraband), *Taken for a Ride* (Lantern rep ≤ −60 and dues unpaid 5+ nights), *Underwater* (debt below −2,000¢ for 3 days).

Ending screen shows stats: days survived, net worth, best single sale, customers served, ghost chits caught, audits survived, faction standings. Option to continue playing after a Deed win (endless mode).

## 14. Presentation

- **Art direction:** chunky pixel-art portraits generated from seeded parts (head shape, skin, hair, eyes, implants, clothing, faction accessories, Vantage boots, etc.), drawn to canvas at low res and scaled with `image-rendering: pixelated`. Palette: deep indigo/near-black background, neon magenta, cyan, acid green, warm amber for LEASEHOLD texts. Subtle CSS scanlines + rain animation on the Counter (respect `prefers-reduced-motion`).
- **Item icons:** small inline SVG/pixel icons per category, tinted by quality.
- **Typography:** system monospace for numbers/ledger, system UI font for body text (no external fonts — offline).
- **Audio:** optional WebAudio synth blips (cha-ching, rain loop, buzzer). Off by default until first tap (iOS requirement). Settings toggle.
- **Haptics:** `navigator.vibrate` where available (not on iOS Safari — degrade silently).

## 15. Milestones

- **M1 — Core loop playable:** title/new game, Dawn→Open→Night→Sleep loop, Buyer/Seller customers, haggling, Fencing + Power Cells + Synth Kitchen + general goods, lease + eviction, Heat + audits + stash, Lantern dues + break-ins, ghost chits, night market, a few upgrades, save/load/autosave, PWA install + offline.
- **M2 — Full game:** Chrome Refurb (probe mini-game), Data Shards, Knock-offs (appraise), all factions & contacts, undercover auditors, events calendar, perks, night jobs, permits/licences, all backgrounds & difficulties, all endings, audio.
- **M3 — Balance & polish:** balance simulator results (target: a decent player on Normal buys the Deed around day 45–70; a reckless one gets evicted or arrested; an all-legal player can win but slowly), onboarding/tutorial hints, accessibility, performance.
