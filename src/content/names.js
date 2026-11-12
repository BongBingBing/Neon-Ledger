// Neon Ledger — random customer names and the wards of Halcyon Spire.
//
// NAMES[faction] = { first: [...], last: [...], handles?: [...], style }
//   style: 'first_last' | 'handle' (Static folk mostly go by handles) (Spire folk often double-barrelled)
//   vantage.titles: rank prefixes used only for on-duty officers (undercover plants use plain names)
// WARDS: { id, name, code (shown on credchits), tier: 'sump'|'stacks'|'spire', factions: [likely residents] }
// A ghost chit can show a ward code that doesn't fit the customer's faction/home ward.

import { freezeDeep } from './util.js';

const RAW_NAMES = {
  sump: {
    style: 'first_last',
    first: ['Mio', 'Bex', 'Tull', 'Ossie', 'Pell', 'Rana', 'Dobbin', 'Kesh', 'Yuli', 'Marro', 'Nell', 'Fen', 'Agathe', 'Sunny',
      'Pilar', 'Rudi', 'Lark', 'Ines', 'Hob', 'Teodor', 'Wim', 'Cass', 'Juniper', 'Bao', 'Ezra', 'Moll'],
    last: ['Brack', 'Saltwell', 'Okonedo', 'Pumpley', 'Vargo', 'Dunmore', 'Ferrous', 'Galloway', 'Mbeki', 'Tidewater',
      'Quill', 'Ashdown', 'Nakamura', 'Riverside', 'Coppersmith', 'Larkin', 'Drummond', 'Abara', 'Silt', 'Ponder'],
  },
  lantern: {
    style: 'first_last',
    first: ['Vic', 'Marguerite', 'Sal', 'Jojo', 'Tamas', 'Benedetta', 'Ike', 'Dusa', 'Corin', 'Mags', 'Renzo', 'Kit',
      'Ludo', 'Petra', 'Hux', 'Ondine', 'Bram', 'Zuzu', 'Faro', 'Nico'],
    last: ['Wick', 'Candela', 'Smoke', 'Ferro', 'Ashgrove', 'Vellacott', 'Black', 'Moretti-Shaw', 'Kettle', 'Flint',
      'Sorrel', 'Dimmock', 'Ember', 'Garza', 'Tallow', 'Cinder'],
  },
  static: {
    style: 'handle',
    first: ['Ada', 'Pax', 'Imre', 'Sol', 'Ren', 'Tov', 'Lio', 'Esh', 'Mara', 'Quin', 'Oz', 'Vey'],
    last: ['Null', 'Byrne', 'Kade', 'Okafor', 'Lindqvist', 'Hex', 'Morrow', 'Patel', 'Vance', 'Ilic'],
    handles: ['hollowbyte', 'mothlight', 'ghost_in_the_gutter', 'p1nhole', 'saltwire', 'lowtide_', 'kettlebell.exe',
      'quietcrow', 'drift//', 'nine_lives', 'f0g', 'bitterbloom', 'stairwell_oracle', 'rustsong', 'umbra', 'tinfoil_saint',
      'paperlantern', 'deadpixel', 'brine.daemon', 'softfail'],
  },
  vantage: {
    style: 'first_last',
    titles: ['Officer', 'Agent', 'Sgt.', 'Lt.'],
    first: ['Harlan', 'Joss', 'Mercer', 'Talia', 'Grant', 'Imogen', 'Desmond', 'Priya', 'Cole', 'Odette', 'Brigid', 'Marcus',
      'Sloane', 'Ezekiel', 'Rhoda', 'Tobias'],
    last: ['Cartwright', 'Steele', 'Lindgren', 'Abernathy', 'Okoro', 'Pryce', 'Whitlock', 'Danvers', 'Kowalczyk', 'Reyes',
      'Holt', 'Fairbairn', 'Strand', 'Ishikawa'],
  },
  spire: {
    style: 'first_last',
    first: ['Aurelio', 'Cressida', 'Peregrine', 'Seraphine', 'Lysander', 'Octavia', 'Thaddeus', 'Isolde', 'Florian',
      'Marisol', 'Caspian', 'Ottilie', 'Benedikt', 'Valentina', 'Crispin', 'Delphine'],
    last: ['Ashcombe-Reyes', 'van der Lune', 'Holloway-Pike', 'Sternfeld', 'de Marchetti', 'Albescu', 'Fairweather',
      'Okonkwo-Hale', 'Lindenhurst', 'Castellane', 'Montclair', 'Vasquez-Orr', 'Whitcombe', 'Ravensworth'],
  },
  none: {
    style: 'first_last',
    first: ['Sam', 'Ali', 'Jun', 'Dee', 'Rory', 'Lin', 'Max', 'Toni', 'Kai', 'Noor', 'Ash', 'Ben', 'Gus', 'Mina', 'Ola', 'Yan'],
    last: ['Smith', 'Chen', 'Novak', 'Haddad', 'Moreau', 'Silva', 'Kim', 'Adeyemi', 'Brennan', 'Sato', 'Ivanova', 'Ortiz',
      'Lund', 'Farah'],
  },
};

const RAW_WARDS = [
  // The Sump (flooded bottom levels)
  { id: 'kettle_row', name: 'Kettle Row', code: 'SMP-01', tier: 'sump', factions: ['sump', 'lantern'] },
  { id: 'pumpwell', name: 'Pumpwell', code: 'SMP-02', tier: 'sump', factions: ['sump'] },
  { id: 'saltglass', name: 'Saltglass', code: 'SMP-04', tier: 'sump', factions: ['sump', 'static'] },
  { id: 'lowtide_steps', name: 'Lowtide Steps', code: 'SMP-05', tier: 'sump', factions: ['sump', 'lantern'] },
  { id: 'cistern_nine', name: 'Cistern Nine', code: 'SMP-09', tier: 'sump', factions: ['static', 'sump'] },
  { id: 'lanternside', name: 'Lanternside', code: 'SMP-11', tier: 'sump', factions: ['lantern'] },
  { id: 'drowned_market', name: 'The Drowned Market', code: 'SMP-13', tier: 'sump', factions: ['sump', 'lantern', 'none'] },
  // The Stacks (middle levels)
  { id: 'gantry', name: 'The Gantry', code: 'STK-20', tier: 'stacks', factions: ['none', 'vantage'] },
  { id: 'hollins_terrace', name: 'Hollins Terrace', code: 'STK-24', tier: 'stacks', factions: ['none', 'static'] },
  { id: 'tier_forty', name: 'Tier Forty', code: 'STK-40', tier: 'stacks', factions: ['none', 'vantage'] },
  { id: 'carillon', name: 'Carillon Ward', code: 'STK-47', tier: 'stacks', factions: ['none', 'vantage', 'static'] },
  // Upper Spire
  { id: 'aurum_heights', name: 'Aurum Heights', code: 'SPR-81', tier: 'spire', factions: ['spire'] },
  { id: 'meridian_gardens', name: 'Meridian Gardens', code: 'SPR-88', tier: 'spire', factions: ['spire', 'vantage'] },
  { id: 'skyglass', name: 'Skyglass', code: 'SPR-93', tier: 'spire', factions: ['spire'] },
  { id: 'the_crown', name: 'The Crown', code: 'SPR-99', tier: 'spire', factions: ['spire'] },
];

export const NAMES = freezeDeep(RAW_NAMES);
export const WARDS = freezeDeep(RAW_WARDS);
export const WARD_BY_ID = Object.freeze(Object.fromEntries(WARDS.map((w) => [w.id, w])));

/** The ward the Stall sits in. */
export const HOME_WARD = 'kettle_row';

/** Character swaps a forger might make (ghost-chit name misspellings). */
export const MISSPELL_SWAPS = freezeDeep([
  ['i', 'l'], ['l', 'i'], ['o', '0'], ['e', 'a'], ['a', 'e'], ['m', 'rn'], ['rn', 'm'], ['c', 'k'], ['k', 'c'],
  ['y', 'i'], ['u', 'v'], ['v', 'u'], ['s', 'z'], ['n', 'nn'], ['tt', 't'], ['ll', 'l'],
]);
