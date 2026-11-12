// Procedural pixel-art portraits. Deterministic from portrait.seed (+ optional traits).
// drawPortrait(canvas, portrait, { mood, faction }) draws a 48x48 bust.
// drawFeet(canvas, portrait, { faction }) draws a 48x12 footwear strip (the "boots tell").
// Original art: built from simple seeded shapes; no external assets.

export const P_SIZE = 48;

function rng(seed) {
  let s = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickR = (r, arr) => arr[Math.floor(r() * arr.length)];
const pickOr = (r, v, arr) => { const x = pickR(r, arr); return v || x; }; // always consume r for stable sequences

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}
function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }

const SKINS = ['#f6d2b8', '#eab48f', '#d39a6f', '#b87b52', '#9a6040', '#7a4a30', '#5c3523', '#3f2418', '#c8c4d6', '#9fb6c2'];
const HAIRS = ['#151018', '#2c1c14', '#5a3a22', '#8a5a2c', '#c9a15a', '#e8e0d0', '#9a9aa8', '#ff3fd8', '#2ef6ff', '#b8ff3c', '#ff6a3c', '#7a4dff'];
const EYES = ['#2a1a10', '#3b5a8a', '#3a7a4a', '#6a4a2a', '#202020', '#5a3a6a'];

const FACTION_STYLE = {
  vantage: { cloth: ['#1c2a4a', '#22325a', '#151f38'], accent: '#5fa8ff', bg: '#101a33' },
  lantern: { cloth: ['#3a1a12', '#2a1a1a', '#4a2412'], accent: '#ff9a3c', bg: '#2a1408' },
  static: { cloth: ['#141a14', '#1a1f1a', '#202820'], accent: '#b8ff3c', bg: '#0a160a' },
  sump: { cloth: ['#2a4a48', '#3a3a2a', '#4a3a2a', '#2a3a4a'], accent: '#3cf0c4', bg: '#0a2024' },
  spire: { cloth: ['#e8e2d0', '#2a2238', '#d8c8a0', '#40344a'], accent: '#f5d76e', bg: '#221a30' },
  none: { cloth: ['#3a3450', '#4a3a3a', '#2a3a3a', '#3a3a3a'], accent: '#a99cc9', bg: '#161028' },
};

/** Resolve the look from seed + traits. Exported so tests/dev tools can inspect determinism. */
const kw = (str, table) => { const v = String(str || '').toLowerCase(); for (const [k, out] of table) if (v.includes(k)) return out; return null; };
const HAIR_KW = [['bald', 'bald'], ['shav', 'bald'], ['crop', 'buzz'], ['buzz', 'buzz'], ['mohawk', 'mohawk'], ['crest', 'mohawk'], ['bun', 'topknot'], ['knot', 'topknot'], ['long', 'long'], ['bob', 'bob'], ['spik', 'spiky'], ['wild', 'curly'], ['curl', 'curly'], ['afro', 'curly'], ['side', 'sideshave'], ['undercut', 'sideshave'], ['slick', 'slick'], ['back', 'slick']];
const HAIRC_KW = [['grey', '#9a9aa8'], ['gray', '#9a9aa8'], ['silver', '#c8c8d4'], ['white', '#e8e0d0'], ['black', '#151018'], ['brown', '#5a3a22'], ['red', '#ff6a3c'], ['blond', '#c9a15a'], ['pink', '#ff3fd8'], ['magenta', '#ff3fd8'], ['blue', '#2ef6ff'], ['cyan', '#2ef6ff'], ['green', '#b8ff3c'], ['purple', '#7a4dff']];
const SKIN_KW = [['pale_olive', '#d8c29a'], ['olive', '#c9a878'], ['pale', '#f6d2b8'], ['pink', '#efb9a4'], ['light', '#eab48f'], ['tan', '#d39a6f'], ['warm', '#c88a5e'], ['deep', '#5c3523'], ['dark', '#3f2418'], ['brown', '#7a4a30'], ['grey', '#c8c4d6'], ['synth', '#9fb6c2'], ['chrome', '#9fb6c2']];
const EYE_KW = [['tired', 'tired'], ['cloud', 'cyber'], ['lens', 'cyber'], ['cyber', 'cyber'], ['sharp', 'narrow'], ['narrow', 'narrow'], ['squint', 'narrow'], ['bright', 'wide'], ['wide', 'wide']];
const IMPL_KW = [['jaw', 'jaw'], ['lens', 'none'], ['goggle', 'none'], ['cochlear', 'antenna'], ['ear', 'antenna'], ['antenna', 'antenna'], ['port', 'ports'], ['circuit', 'circuit'], ['jack', 'jack'], ['glow', 'glowlines'], ['tattoo', 'glowlines'], ['plate', 'plate'], ['none', 'none']];
const ACC_KW = [['cap', 'cap'], ['visor', 'visor'], ['badge', 'earpiece'], ['earpiece', 'earpiece'], ['lantern', 'lanternpin'], ['chain', 'chain'], ['tat', 'necktat'], ['hood', 'hood'], ['goggle', 'goggles'], ['headlamp', 'goggles'], ['beanie', 'beanie'], ['collar', 'raincollar'], ['monocle', 'holomonocle'], ['gold', 'goldear']];
const OUTFIT_KW = [['coat', 'coat'], ['hood', 'hoodie'], ['collar', 'collar'], ['vest', 'vest'], ['apron', 'vest'], ['wader', 'vest'], ['bomber', 'jacket'], ['jacket', 'jacket']];
const ACC_BY_INDEX = ['none', 'beanie', 'goggles', 'chain', 'earpiece', 'holomonocle', 'raincollar', 'necktat'];

/** Accept engine traits (numbers / faction ids) and content traits (descriptive strings). */
export function normalizeTraits(raw = {}, faction = 'none') {
  const t = {};
  const f = raw.faction || faction;
  if (raw.drone) t.form = 'drone';
  if (raw.screen) t.form = 'screen';
  if (raw.form || raw.type) t.form = raw.form || raw.type;
  t.faction = FACTION_STYLE[f] ? f : 'none';
  if (raw.head) t.head = ({ wide: 'round', narrow: 'long' })[raw.head] || raw.head;
  if (raw.skin != null) t.skin = typeof raw.skin === 'number' ? SKINS[raw.skin % SKINS.length] : String(raw.skin)[0] === '#' ? raw.skin : kw(raw.skin, SKIN_KW);
  if (raw.hair) { t.hair = kw(raw.hair, HAIR_KW); t.hairColor = raw.hairColor || kw(raw.hair, HAIRC_KW); if (String(raw.hair).includes('tattoo')) t.implant = 'circuit'; }
  if (raw.eyes) t.eyes = kw(raw.eyes, EYE_KW) || 'normal';
  if (raw.implant) { const im = kw(raw.implant, IMPL_KW); if (im) t.implant = im; if (/lens|cloud/.test(raw.implant)) t.eyes = 'cyber'; if (/goggle/.test(raw.implant)) t.accessory = 'goggles'; }
  if (raw.facialHair) t.beard = !/none|clean/.test(raw.facialHair);
  if (typeof raw.accessory === 'number') t.accessory = ACC_BY_INDEX[raw.accessory % ACC_BY_INDEX.length] === 'none' ? null : ACC_BY_INDEX[raw.accessory % ACC_BY_INDEX.length];
  else if (raw.accessory) t.accessory = kw(raw.accessory, ACC_KW) || t.accessory;
  if (raw.outfit && FACTION_STYLE[raw.outfit]) t.outfitFaction = raw.outfit;
  else if (raw.outfit) t.outfit = kw(raw.outfit, OUTFIT_KW) || raw.outfit;
  if (raw.clothing) { t.outfit = kw(raw.clothing, OUTFIT_KW) || 'jacket'; const cf = kw(raw.clothing, [['vantage', 'vantage'], ['lantern', 'lantern']]); if (cf) t.outfitFaction = cf; if (/red/.test(raw.clothing)) t.cloth = '#6a1a1a'; }
  if (raw.boots) t.boots = raw.boots === 'vantage' ? 'vantage' : ({ street: null, rubber: 'work', waders: 'wrap' })[raw.boots] ?? raw.boots;
  if (raw.vantageBoots) t.boots = 'vantage';
  t.nervous = !!raw.nervous; t.verifier = !!raw.verifier;
  return t;
}

export function resolveLook(portrait = {}, faction = 'none') {
  const traits = normalizeTraits(portrait.traits || {}, faction);
  const r = rng(portrait.seed ?? 1);
  const f = traits.faction;
  const fs = FACTION_STYLE[traits.outfitFaction || f];
  const look = {
    faction: f,
    form: traits.form || 'human',
    nervous: traits.nervous, verifier: traits.verifier,
    head: traits.head || pickR(r, ['oval', 'square', 'long', 'round', 'oval', 'heart']),
    skin: pickOr(r, traits.skin, SKINS),
    hair: traits.hair || pickR(r, ['bald', 'buzz', 'mohawk', 'long', 'bob', 'spiky', 'sideshave', 'topknot', 'curly', 'slick', 'buzz', 'bob']),
    hairColor: traits.hairColor || (r() < 0.22 ? pickR(r, HAIRS.slice(7)) : pickR(r, HAIRS.slice(0, 7))),
    eyeColor: pickR(r, EYES),
    eyes: traits.eyes || pickR(r, ['normal', 'normal', 'narrow', 'wide', 'cyber', 'normal', 'tired']),
    implant: traits.implant || pickR(r, ['none', 'none', 'jaw', 'ports', 'circuit', 'antenna', 'jack', 'glowlines', 'none', 'plate']),
    implantColor: pickR(r, ['#2ef6ff', '#ff3fd8', '#b8ff3c', '#ff4d6a', '#ffb547']),
    cloth: traits.cloth || pickR(r, fs.cloth),
    accent: fs.accent,
    bg: fs.bg,
    beard: traits.beard ?? (r() < 0.18),
    scar: traits.scar ?? (r() < 0.15),
    earring: r() < 0.3,
    glasses: traits.glasses ?? (r() < 0.12),
    accessory: traits.accessory !== undefined ? (traits.accessory || 'none') : factionAccessory(r, f),
    outfit: traits.outfit || pickR(r, ['jacket', 'hoodie', 'collar', 'coat', 'vest']),
    boots: traits.boots || pickR(r, f === 'spire' ? ['sleek', 'sleek', 'sneaker'] : ['sneaker', 'wrap', 'work', 'sandal', 'sneaker', 'work']),
    bgSign: pickR(r, ['#ff3fd8', '#2ef6ff', '#b8ff3c', '#ffb547']),
    w: 8 + Math.floor(r() * 3),
    r,
  };
  if (look.form === 'drone' || look.form === 'screen') look.boots = 'none';
  return look;
}

function factionAccessory(r, f) {
  const roll = r();
  switch (f) {
    case 'vantage': return roll < 0.5 ? 'cap' : roll < 0.75 ? 'visor' : 'earpiece';
    case 'lantern': return roll < 0.45 ? 'lanternpin' : roll < 0.75 ? 'necktat' : 'chain';
    case 'static': return roll < 0.4 ? 'hood' : roll < 0.8 ? 'goggles' : 'none';
    case 'sump': return roll < 0.4 ? 'beanie' : roll < 0.65 ? 'raincollar' : 'none';
    case 'spire': return roll < 0.4 ? 'holomonocle' : roll < 0.75 ? 'goldear' : 'none';
    default: return roll < 0.2 ? 'beanie' : 'none';
  }
}

function makeCtx(canvas, w, h) {
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const px = (x, y, c) => { if (c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); } };
  const rect = (x, y, rw, rh, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, rw | 0, rh | 0); };
  return { ctx, px, rect };
}

function headWidth(shape, t, W) {
  // t in [0,1] from crown to chin → half width
  const clampT = Math.max(0, Math.min(1, t));
  switch (shape) {
    case 'square': return t < 0.08 ? W - 3 : t < 0.16 ? W - 1 : t > 0.9 ? W - 3 : t > 0.8 ? W - 1 : W;
    case 'long': return Math.round((W - 1) * Math.sqrt(Math.max(0, 1 - Math.pow((clampT - 0.42) / 0.6, 2))) + 0.4);
    case 'round': return Math.round((W + 1) * Math.sqrt(Math.max(0, 1 - Math.pow((clampT - 0.5) / 0.56, 2))) + 0.3);
    case 'heart': return Math.round(W * (t < 0.55 ? Math.sqrt(Math.max(0, 1 - Math.pow((clampT - 0.45) / 0.52, 2))) : 1 - (clampT - 0.55) * 1.35) + 0.4);
    default: return Math.round(W * Math.sqrt(Math.max(0, 1 - Math.pow((clampT - 0.46) / 0.58, 2))) + 0.45);
  }
}

export function drawPortrait(canvas, portrait = {}, opts = {}) {
  const S = P_SIZE;
  const { px, rect, ctx } = makeCtx(canvas, S, S);
  const L = resolveLook(portrait, opts.faction);
  const mood = opts.mood || 'neutral';
  const r = rng((portrait.seed ?? 1) ^ 0x5bd1e995);

  // --- background: dark wall, neon sign block, rain streaks
  for (let y = 0; y < S; y++) rect(0, y, S, 1, mix(shade(L.bg, 0.12), shade(L.bg, -0.4), y / S));
  const sx = Math.floor(r() * 30) + 2;
  rect(sx, 3, 12, 5, shade(L.bgSign, -0.55));
  rect(sx + 1, 4, 10, 3, shade(L.bgSign, -0.2));
  for (let i = 0; i < 10; i++) { const x = Math.floor(r() * S), y = Math.floor(r() * 30); px(x, y, 'rgba(150,200,255,0.18)'); px(x, y + 1, 'rgba(150,200,255,0.1)'); }

  if (L.form === 'drone') return drawDrone(px, rect, L, mood);
  if (L.form === 'screen') return drawScreen(px, rect, L, mood, r);

  const cx = 24;
  const top = L.head === 'long' ? 8 : L.head === 'round' ? 11 : 10;
  const chin = L.head === 'long' ? 35 : L.head === 'round' ? 33 : 34;
  const H = chin - top;
  const skin = L.skin, skinD = shade(skin, -0.22), skinL = shade(skin, 0.12);
  const cloth = L.cloth, clothD = shade(cloth, -0.35), clothL = shade(cloth, 0.18);

  // --- shoulders/clothes
  for (let y = 37; y < S; y++) {
    const hw = Math.min(23, 9 + Math.round((y - 37) * 1.7));
    rect(cx - hw, y, hw * 2, 1, cloth);
    px(cx - hw, y, clothD); px(cx + hw - 1, y, clothD);
  }
  // neck
  rect(cx - 4, chin - 1, 8, 39 - chin + 1, skinD);
  rect(cx - 3, chin - 1, 6, 39 - chin, skin);
  // outfit details
  switch (L.outfit) {
    case 'hoodie':
      for (let y = 36; y < 41; y++) { const hw = 8 + (y - 36); rect(cx - hw, y, 3, 1, clothL); rect(cx + hw - 3, y, 3, 1, clothL); }
      px(cx - 2, 42, '#ddd'); px(cx - 2, 43, '#ddd'); px(cx + 1, 42, '#ddd'); px(cx + 1, 43, '#ddd');
      break;
    case 'collar':
      for (let y = 36; y < 42; y++) { px(cx - 6 + (y - 36) / 2, y, clothL); px(cx + 5 - (y - 36) / 2, y, clothL); }
      rect(cx - 1, 40, 2, 8, clothD);
      break;
    case 'coat':
      for (let y = 39; y < S; y++) { px(cx - 3 - Math.floor((y - 39) / 3), y, clothD); px(cx + 2 + Math.floor((y - 39) / 3), y, clothD); }
      rect(cx - 2, 39, 4, 9, shade(cloth, -0.15));
      break;
    case 'vest':
      rect(cx - 3, 39, 6, 9, shade(L.skin, -0.1));
      rect(cx - 3, 39, 6, 9, mix('#2a2a2a', cloth, 0.3));
      for (let y = 41; y < S; y += 2) px(cx, y, L.accent);
      break;
    default: // jacket with zip
      rect(cx - 1, 39, 1, 9, clothD); px(cx - 1, 39, '#ccc');
      for (let y = 38; y < 43; y++) { px(cx - 5 - (y - 38), y, clothL); px(cx + 4 + (y - 38), y, clothL); }
  }
  // faction clothing marks
  if (L.faction === 'vantage') { rect(cx - 19, 43, 4, 1, L.accent); rect(cx + 15, 43, 4, 1, L.accent); px(cx + 7, 42, '#e0e8ff'); px(cx + 8, 42, '#5fa8ff'); }
  if (L.faction === 'spire') { rect(cx - 6, 37, 12, 1, L.accent); }
  if (L.faction === 'static') { for (let i = 0; i < 5; i++) px(cx + 6 + i, 44 + (i % 2), L.accent); }
  if (L.faction === 'sump') { rect(cx - 14, 44, 4, 3, shade(cloth, 0.25)); px(cx - 13, 45, clothD); }

  // --- ears
  const eyeY = top + Math.round(H * 0.46);
  const wAt = (y) => headWidth(L.head, (y - top) / H, L.w);
  for (const s of [-1, 1]) {
    const ew = wAt(eyeY);
    const ex = s < 0 ? cx - ew - 1 : cx + ew;
    rect(ex, eyeY - 1, 1, 4, skinD);
    if (L.earring && s > 0) px(ex, eyeY + 3, '#f5d76e');
  }

  // --- head fill
  for (let y = top; y <= chin; y++) {
    const hw = wAt(y);
    if (hw <= 0) continue;
    rect(cx - hw, y, hw * 2, 1, skin);
    px(cx - hw, y, skinD);
    rect(cx + hw - 2, y, 2, 1, skinD); // shadow side
    if (y > top + 2 && y < eyeY) px(cx - hw + 1, y, skinL);
  }
  // jaw shadow
  { const hw = wAt(chin); rect(cx - hw + 1, chin, Math.max(0, hw * 2 - 2), 1, skinD); }

  // beard
  if (L.beard) {
    const bc = shade(L.hairColor, -0.1);
    for (let y = eyeY + 4; y <= chin; y++) {
      const hw = wAt(y);
      for (let x = cx - hw; x < cx + hw; x++) if (((x + y) & 1) || y > eyeY + 6) px(x, y, bc);
    }
  }

  // --- eyes & brows (mood)
  const exL = cx - 4, exR = cx + 3;
  const white = '#f4f0ff';
  const eyeCol = L.eyeColor;
  const drawEye = (x, cyber) => {
    if (L.eyes === 'narrow' || mood === 'angry') { rect(x - 1, eyeY, 3, 1, '#1a0f12'); px(x, eyeY, cyber ? L.implantColor : eyeCol); return; }
    if (L.eyes === 'tired') { rect(x - 1, eyeY, 3, 1, white); px(x, eyeY, eyeCol); rect(x - 1, eyeY - 1, 3, 1, skinD); rect(x - 1, eyeY + 1, 3, 1, shade(skin, -0.3)); return; }
    const hgt = L.eyes === 'wide' ? 2 : 1;
    rect(x - 1, eyeY, 3, hgt, white);
    rect(x, eyeY, 1, hgt, cyber ? L.implantColor : eyeCol);
    if (mood === 'happy') rect(x - 1, eyeY + hgt, 3, 1, skinD);
  };
  drawEye(exL, false);
  drawEye(exR, L.eyes === 'cyber');
  if (L.eyes === 'cyber') { px(exR + 2, eyeY - 1, L.implantColor); rect(exR - 2, eyeY - 2, 5, 1, '#6a6a7a'); rect(exR - 2, eyeY + 2, 5, 1, '#6a6a7a'); }
  const browC = shade(L.hair === 'bald' ? skin : L.hairColor, -0.3);
  const by = eyeY - 2;
  if (mood === 'angry') {
    px(exL - 1, by - 1, browC); px(exL, by, browC); px(exL + 1, by + 1, browC);
    px(exR + 1, by - 1, browC); px(exR, by, browC); px(exR - 1, by + 1, browC);
  } else if (mood === 'annoyed') {
    rect(exL - 1, by + 1, 3, 1, browC); rect(exR - 1, by + 1, 3, 1, browC);
  } else if (mood === 'happy') {
    rect(exL - 1, by - 1, 3, 1, browC); rect(exR - 1, by - 1, 3, 1, browC);
  } else {
    rect(exL - 1, by, 3, 1, browC); rect(exR - 1, by, 3, 1, browC);
  }
  // nose
  px(cx - 1, eyeY + 2, skinD); px(cx - 1, eyeY + 3, skinD); px(cx, eyeY + 4, skinD);
  // mouth
  const my = eyeY + 7 > chin - 1 ? chin - 2 : eyeY + 7;
  const lip = shade(skin, -0.42);
  switch (mood) {
    case 'happy': px(cx - 3, my - 1, lip); rect(cx - 2, my, 4, 1, lip); px(cx + 2, my - 1, lip); break;
    case 'annoyed': rect(cx - 2, my, 3, 1, lip); px(cx + 1, my - 1, lip); break;
    case 'angry': rect(cx - 2, my, 4, 2, '#2a0a0e'); rect(cx - 2, my, 4, 1, '#e8e0d8'); px(cx - 3, my + 1, lip); px(cx + 2, my + 1, lip); break;
    default: rect(cx - 2, my, 4, 1, lip);
  }
  if (L.scar) { for (let i = 0; i < 4; i++) px(exR + 1 - i, eyeY + 1 + i, shade(skin, 0.3)); }

  // --- implants
  const ic = L.implantColor;
  switch (L.implant) {
    case 'jaw': { const hw = wAt(chin - 2); rect(cx + 1, chin - 3, hw - 1, 3, '#7a7f90'); rect(cx + 1, chin - 3, hw - 1, 1, '#b8bfd0'); px(cx + 3, chin - 2, ic); break; }
    case 'ports': px(cx - 6, eyeY + 3, '#333'); px(cx - 6, eyeY + 5, '#333'); px(cx - 6, eyeY + 3 + 0, ic); break;
    case 'circuit': for (let i = 0; i < 6; i++) px(cx - 3 + i, top + 3 + (i % 3 === 0 ? 1 : 0), ic); px(cx - 3, top + 5, ic); break;
    case 'antenna': { const ew = wAt(eyeY); rect(cx + ew, eyeY - 7, 1, 6, '#8a8f9a'); px(cx + ew, eyeY - 8, ic); break; }
    case 'jack': rect(cx - 4, chin + 1, 2, 2, '#222'); px(cx - 4, chin + 1, ic); break;
    case 'glowlines': for (let i = 0; i < 4; i++) { px(exL - 2 - (i >> 1), eyeY + 2 + i, ic); } break;
    case 'plate': { const hw = wAt(eyeY - 4); rect(cx - hw + 1, eyeY - 5, 4, 3, '#9aa0b0'); px(cx - hw + 2, eyeY - 4, ic); break; }
    default: break;
  }

  // --- hair
  const hc = L.hairColor, hcD = shade(hc, -0.3), hcL = shade(hc, 0.2);
  const hairRow = (y, extra = 1, color = hc) => { const hw = wAt(y) + extra; rect(cx - hw, y, hw * 2, 1, color); };
  switch (L.hair) {
    case 'bald': px(cx - 3, top + 2, skinL); px(cx - 2, top + 1, skinL); break;
    case 'buzz': for (let y = top; y < top + 4; y++) { const hw = wAt(y); for (let x = cx - hw; x < cx + hw; x++) if ((x + y) % 2 === 0 || y < top + 2) px(x, y, hcD); } break;
    case 'mohawk': for (let y = top - 5; y < top + 4; y++) rect(cx - 2, y, 4, 1, y % 2 ? hc : hcL); for (let y = top; y < top + 4; y++) { const hw = wAt(y); px(cx - hw + 1, y, hcD); px(cx + hw - 2, y, hcD); } break;
    case 'long':
      for (let y = top - 1; y < top + 4; y++) hairRow(y, 1);
      for (let y = top + 4; y < chin + 6; y++) { const hw = wAt(Math.min(y, eyeY)) + 1; rect(cx - hw - 1, y, 3, 1, y % 3 ? hc : hcD); rect(cx + hw - 2, y, 3, 1, y % 3 ? hc : hcD); }
      break;
    case 'bob':
      for (let y = top - 1; y < top + 4; y++) hairRow(y, 1);
      for (let y = top + 4; y < chin - 2; y++) { const hw = wAt(y) + 1; rect(cx - hw, y, 2, 1, hc); rect(cx + hw - 2, y, 2, 1, hc); }
      rect(cx - 6, top + 3, 7, 1, hcD);
      break;
    case 'spiky':
      for (let y = top - 1; y < top + 3; y++) hairRow(y, 1);
      for (let i = -3; i <= 3; i++) { const x = cx + i * 3; px(x, top - 2, hc); px(x, top - 3, hc); px(x, top - 4, hcL); }
      break;
    case 'sideshave':
      for (let y = top - 2; y < top + 4; y++) { const hw = wAt(Math.max(top, y)) + 1; rect(cx - 2, y, hw + 2, 1, y % 2 ? hc : hcL); }
      for (let y = top + 4; y < eyeY + 2; y++) rect(cx + wAt(y) - 1, y, 2, 1, hc);
      for (let y = top + 1; y < eyeY; y += 2) px(cx - wAt(y) + 1, y, hcD);
      break;
    case 'topknot':
      for (let y = top; y < top + 3; y++) hairRow(y, 1);
      rect(cx - 2, top - 4, 4, 4, hc); rect(cx - 1, top - 5, 2, 1, hcL);
      break;
    case 'curly':
      for (let y = top - 3; y < top + 5; y++) { const hw = wAt(Math.max(top, y)) + 2; for (let x = cx - hw; x < cx + hw; x++) if ((x * 7 + y * 3) % 5 !== 0) px(x, y, (x + y) % 3 ? hc : hcL); }
      break;
    case 'slick':
      for (let y = top - 1; y < top + 3; y++) hairRow(y, 1, y === top ? hcL : hc);
      for (let y = top + 3; y < eyeY - 1; y++) { const hw = wAt(y); px(cx - hw, y, hc); px(cx + hw - 1, y, hc); }
      break;
  }

  // --- accessories
  const acc = L.accent;
  switch (L.accessory) {
    case 'cap': {
      for (let y = top - 2; y < top + 3; y++) hairRow(y, 1, '#1c2a4a');
      rect(cx - wAt(top + 3) - 1, top + 3, wAt(top + 3) * 2 + 6, 2, '#0f1830');
      px(cx - 1, top, acc); px(cx, top, '#e0e8ff'); px(cx - 1, top - 1, acc);
      break;
    }
    case 'visor': rect(cx - L.w, eyeY - 1, L.w * 2, 3, 'rgba(95,168,255,0.8)'); rect(cx - L.w, eyeY - 1, L.w * 2, 1, '#bfe0ff'); break;
    case 'earpiece': { const ew = wAt(eyeY); rect(cx + ew, eyeY, 2, 2, '#222'); px(cx + ew + 1, eyeY, acc); break; }
    case 'lanternpin': rect(cx + 9, 42, 3, 4, acc); px(cx + 10, 41, '#ffd89b'); px(cx + 10, 43, '#fff3c0'); break;
    case 'necktat': for (let i = 0; i < 4; i++) px(cx - 3 + i * 2, chin + 2 + (i % 2), acc); break;
    case 'chain': for (let x = cx - 6; x <= cx + 6; x++) px(x, 38 + Math.round(Math.abs(x - cx) / 3) * -1 + 2, x % 2 ? '#f5d76e' : '#a88a30'); break;
    case 'hood': {
      for (let y = top - 3; y < chin + 4; y++) {
        const hw = wAt(Math.min(Math.max(top, y), eyeY)) + 3;
        rect(cx - hw, y, 3, 1, shade(cloth, 0.08)); rect(cx + hw - 3, y, 3, 1, shade(cloth, 0.08));
        if (y < top + 2) rect(cx - hw, y, hw * 2, 1, shade(cloth, 0.08));
      }
      break;
    }
    case 'goggles': rect(cx - 7, eyeY - 1, 14, 3, '#1a1a1a'); rect(exL - 1, eyeY - 1, 3, 3, mix(acc, '#000', 0.3)); rect(exR - 1, eyeY - 1, 3, 3, mix(acc, '#000', 0.3)); px(exL - 1, eyeY - 1, '#eaffc0'); px(exR - 1, eyeY - 1, '#eaffc0'); break;
    case 'beanie': for (let y = top - 3; y < top + 3; y++) hairRow(y, 2, y === top + 2 ? shade(cloth, 0.3) : y % 2 ? cloth : shade(cloth, 0.12)); px(cx, top - 4, shade(cloth, 0.3)); break;
    case 'raincollar': for (let y = 34; y < 40; y++) { const hw = 8 + Math.floor((y - 34) / 2); rect(cx - hw, y, 2, 1, '#e0c040'); rect(cx + hw - 2, y, 2, 1, '#e0c040'); } break;
    case 'holomonocle': rect(exR - 2, eyeY - 2, 5, 5, 'rgba(245,215,110,0.35)'); px(exR + 2, eyeY - 2, acc); px(exR - 2, eyeY + 2, acc); break;
    case 'goldear': { const ew = wAt(eyeY); px(cx - ew - 1, eyeY + 3, acc); px(cx + ew, eyeY + 3, acc); px(cx + ew, eyeY + 4, acc); break; }
  }
  if (L.glasses && !['goggles', 'visor'].includes(L.accessory)) {
    rect(exL - 2, eyeY - 1, 5, 1, '#111'); rect(exR - 2, eyeY - 1, 5, 1, '#111'); px(cx - 1, eyeY - 1, '#111'); px(cx, eyeY - 1, '#111');
    px(exL - 2, eyeY, '#111'); px(exL + 2, eyeY, '#111'); px(exR - 2, eyeY, '#111'); px(exR + 2, eyeY, '#111');
  }
  if (L.nervous) { const ew = wAt(top + 4); px(cx + ew - 1, top + 4, '#bfe8ff'); px(cx + ew - 1, top + 5, '#8fd0ff'); px(cx - ew + 1, eyeY - 3, '#bfe8ff'); }
  if (L.verifier) { rect(cx + 13, 36, 2, 10, '#30343f'); rect(cx + 13, 35, 2, 2, '#ff4d6a'); px(cx + 13, 35, '#ffd0d8'); }
  // rim light from neon sign
  ctx.globalAlpha = 0.18; rect(0, 0, S, S, L.bgSign); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return L;
}

function drawDrone(px, rect, L, mood) {
  const cx = 24;
  rect(cx - 14, 18, 28, 12, '#3a3f50'); rect(cx - 14, 18, 28, 2, '#6a7090'); rect(cx - 12, 30, 24, 3, '#2a2e3a');
  rect(cx - 20, 14, 10, 2, '#555c70'); rect(cx + 10, 14, 10, 2, '#555c70');
  rect(cx - 22, 12, 14, 1, 'rgba(200,220,255,0.4)'); rect(cx + 8, 12, 14, 1, 'rgba(200,220,255,0.4)');
  const eye = mood === 'angry' ? '#ff4d6a' : mood === 'happy' ? '#b8ff3c' : '#2ef6ff';
  rect(cx - 5, 22, 10, 5, '#0a0a12'); rect(cx - 3, 23, 6, 3, eye); px(cx - 2, 23, '#fff');
  rect(cx - 8, 33, 16, 10, '#5a4a2a'); rect(cx - 8, 33, 16, 1, '#8a7040'); rect(cx - 1, 33, 2, 10, '#3a2a10');
  for (let x = cx - 6; x < cx + 6; x += 3) px(x, 38, '#f5d76e');
  return L;
}

function drawScreen(px, rect, L, mood, r) {
  const cx = 24;
  rect(cx - 16, 8, 32, 26, '#222'); rect(cx - 14, 10, 28, 22, '#041004');
  for (let y = 10; y < 32; y += 2) rect(cx - 14, y, 28, 1, '#072a07');
  const g = '#b8ff3c';
  rect(cx - 7, 17, 4, 2, g); rect(cx + 3, 17, 4, 2, g);
  if (mood === 'happy') { px(cx - 4, 25, g); rect(cx - 3, 26, 6, 1, g); px(cx + 3, 25, g); } else rect(cx - 4, 25, 8, 1, g);
  for (let i = 0; i < 8; i++) { const x = cx - 14 + Math.floor(r() * 28), y = 10 + Math.floor(r() * 22); px(x, y, '#eaffc0'); }
  for (let i = 0; i < 9; i++) px(cx + 4 + i, 11 + i * 2, '#ddd'); // crack
  rect(cx - 3, 34, 6, 4, '#333'); rect(cx - 10, 38, 20, 10, '#1a1a1a');
  return L;
}

const BOOTS = {
  sneaker: (rect, px, x, c) => { rect(x, 4, 9, 4, c); rect(x, 7, 11, 2, '#eee'); px(x + 3, 5, '#fff'); },
  wrap: (rect, px, x) => { rect(x, 3, 9, 6, '#6a5a44'); for (let i = 0; i < 4; i++) rect(x, 3 + i * 2, 9, 1, '#4a3a2a'); },
  work: (rect, px, x) => { rect(x, 1, 8, 7, '#5a3a20'); rect(x, 7, 11, 2, '#2a1a10'); px(x + 2, 3, '#c9a15a'); px(x + 2, 5, '#c9a15a'); },
  sleek: (rect, px, x) => { rect(x + 1, 4, 9, 3, '#c8b070'); rect(x + 8, 7, 1, 2, '#c8b070'); rect(x, 7, 11, 1, '#8a7030'); },
  sandal: (rect, px, x, c, skin) => { rect(x, 6, 10, 2, skin); rect(x, 8, 11, 1, '#4a3a2a'); rect(x + 3, 5, 1, 3, '#4a3a2a'); },
  vantage: (rect, px, x) => {
    rect(x, 0, 9, 8, '#0b0e18'); rect(x, 7, 12, 2, '#05060a'); rect(x + 1, 2, 7, 1, '#5fa8ff');
    rect(x + 8, 5, 3, 2, '#9ab0d0'); px(x + 2, 1, '#2a3a5a'); px(x + 4, 5, '#2a3a5a');
  },
};

/** Footwear strip glimpsed under the counter (48x12). The Vantage-issue boots are a tell. */
export function drawFeet(canvas, portrait = {}, opts = {}) {
  const { px, rect } = makeCtx(canvas, 48, 12);
  const L = resolveLook(portrait, opts.faction);
  rect(0, 0, 48, 12, '#0d0820');
  rect(0, 10, 48, 2, '#1d1436');
  for (let x = 0; x < 48; x += 4) px(x, 10, '#2c2050');
  const pants = shade(L.cloth, -0.2);
  if (L.boots === 'none') { rect(18, 6, 12, 2, 'rgba(46,246,255,0.25)'); return L; }
  rect(12, 0, 7, 3, pants); rect(29, 0, 7, 3, pants);
  const f = BOOTS[L.boots] || BOOTS.sneaker;
  const c = L.r ? L.accent : '#888';
  f(rect, px, 11, c, L.skin);
  f(rect, px, 28, c, L.skin);
  return L;
}
