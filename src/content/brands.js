// Neon Ledger — Upper-Spire luxury brands (all fictional, original).
// Each brand has 3 genuine maker's marks (the Reference Index shows these).
// `fakeMarksBySlot[i]` lists near-miss forgeries of marks[i]; a counterfeit swaps
// exactly one genuine mark for one fake from the matching slot.
// `fakeMarks` is the flat list required by the schema (all slots concatenated).

import { freezeDeep } from './util.js';

const RAW = [
  {
    id: 'aubade',
    name: 'Maison Aubade',
    line: 'silks',
    tagline: 'Woven for the first light above the cloud deck.',
    marks: ['Lark sigil, wings raised', 'Gold hem, 9 stitches per inch', "Tag: 'maison aubade', all lower-case"],
    fakeMarksBySlot: [
      ['Lark sigil, wings folded', 'Swallow sigil, wings raised', 'Lark sigil, facing right'],
      ['Gold hem, 7 stitches per inch', 'Yellow hem, 9 stitches per inch'],
      ["Tag: 'Maison Aubade', capitalised", "Tag: 'maison aubades', all lower-case"],
    ],
  },
  {
    id: 'corvane',
    name: 'Corvane',
    line: 'wristpieces',
    tagline: 'Time, kept the way the Spire keeps it: precisely, and for itself.',
    marks: ["Crown set at 4 o'clock", "Caseback serial begins 'CV-'", 'Second hand sweeps, never ticks'],
    fakeMarksBySlot: [
      ["Crown set at 3 o'clock", "Crown set at 5 o'clock"],
      ["Caseback serial begins 'CY-'", "Caseback serial begins 'C-V'", "Caseback serial begins 'CV_'"],
      ['Second hand ticks once a second', 'Second hand stutters, then sweeps'],
    ],
  },
  {
    id: 'ninefold',
    name: 'Ninefold',
    line: 'bags',
    tagline: 'Folded nine times, opened by invitation.',
    marks: ['Nine-crease fold on the flap', 'Clasp of matte black ceramic', 'Lining tide-grey with wave print'],
    fakeMarksBySlot: [
      ['Eight-crease fold on the flap', 'Ten-crease fold on the flap'],
      ['Clasp of glossy black plastic', 'Clasp of matte black metal'],
      ['Lining slate-blue with wave print', 'Lining tide-grey, unprinted'],
    ],
  },
  {
    id: 'halvard',
    name: 'Halvard Oro',
    line: 'jewellery',
    tagline: 'Gold that remembers your hand.',
    marks: ["Hallmark 'HO' inside a hexagon", "Purity stamp '750'", 'Band warms faintly when held'],
    fakeMarksBySlot: [
      ["Hallmark 'HO' inside a pentagon", "Hallmark 'OH' inside a hexagon"],
      ["Purity stamp '75O'", "Purity stamp '570'", "Purity stamp '7S0'"],
      ['Band stays cold when held', 'Band buzzes faintly when held'],
    ],
  },
  {
    id: 'kestrel',
    name: 'Kestrel Atelier',
    line: 'visors',
    tagline: 'See the city the way the birds do. From above.',
    marks: ['Lens tint drifts amber to violet', 'Hinge engraved with one feather', "Arm reads 'KESTREL • ATELIER'"],
    fakeMarksBySlot: [
      ['Lens tint drifts amber to green', 'Lens tint fixed violet'],
      ['Hinge engraved with two feathers', 'Hinge engraved with a leaf'],
      ["Arm reads 'KESTRAL • ATELIER'", "Arm reads 'KESTREL ATELIER'"],
    ],
  },
  {
    id: 'varga',
    name: 'Lumen Varga',
    line: 'scent',
    tagline: 'Bottled weather from a sky you will never stand under.',
    marks: ['Cap is a hand-cut glass sphere', 'Batch code etched on base, 6 digits', 'Top note: rain on warm stone'],
    fakeMarksBySlot: [
      ['Cap is a moulded plastic sphere', 'Cap is a hand-cut glass cube'],
      ['Batch code printed on base, 6 digits', 'Batch code etched on base, 5 digits'],
      ['Top note: lemon floor cleaner', 'Top note: wet cardboard'],
    ],
  },
];

export const BRANDS = freezeDeep(
  RAW.map((b) => ({ ...b, fakeMarks: b.fakeMarksBySlot.flat() })),
);

export const BRAND_BY_ID = Object.freeze(Object.fromEntries(BRANDS.map((b) => [b.id, b])));
