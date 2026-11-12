// Inline pixel-style SVG icons. Item icons per category, tinted by quality.
// Maps: '.' empty, a = main tint, b = dark outline, c = highlight, d = accent, e = white.

const MAPS = {
  power: [
    '....bbbb....',
    '....bccb....',
    '..bbbbbbbb..',
    '..baaaaaab..',
    '..baaddaab..',
    '..baadaaab..',
    '..badddaab..',
    '..baaadaab..',
    '..baadaaab..',
    '..baaaaaab..',
    '..bccccccb..',
    '..bbbbbbbb..',
  ],
  food: [
    '............',
    '..e..e..e...',
    '...e..e..e..',
    '..e..e..e...',
    'bbbbbbbbbbbb',
    'bddddddddddb',
    '.baaaaaaaab.',
    '.baacaaaaab.',
    '..baaaaaab..',
    '..baaaaaab..',
    '...bbbbbb...',
    '............',
  ],
  salvage: [
    '............',
    '.....bb.....',
    '....bccb....',
    '..bbbaabbb..',
    '.bcaaaaaaab.',
    '.baab..baab.',
    '.bab....bab.',
    '.baab..baab.',
    '.baaaaaaaab.',
    '..bbbaabbb..',
    '....bddb....',
    '.....bb.....',
  ],
  sundry: [
    '............',
    '...bbbbbb...',
    '..bccccccb..',
    '..baaaaaab..',
    '..baddddab..',
    '..baaaaaab..',
    '..baddddab..',
    '..baaaaaab..',
    '..baaaaaab..',
    '..baaaaaab..',
    '...bbbbbb...',
    '............',
  ],
  chrome: [
    '.....bbb....',
    '....bcccb...',
    '....bcaab...',
    '.....baab...',
    '....bdaab...',
    '...bcaaab...',
    '...baaadb...',
    '..bcaaab....',
    '..baadab....',
    '.bcaaab.....',
    '.baaab......',
    '.bbbb.......',
  ],
  shard: [
    '............',
    '....bbbb....',
    '...bccccb...',
    '..bcaaaaab..',
    '..baadaaab..',
    '..baaaadab..',
    '..badaaaab..',
    '..baaadaab..',
    '...baaaab...',
    '....baab....',
    '....bddb....',
    '.....bb.....',
  ],
  luxury: [
    '............',
    '...bbbbbb...',
    '..bcceeccb..',
    '.bcaaaaaacb.',
    'bcaabaabaacb',
    '.baaaaaaaab.',
    '..baaaaaab..',
    '...baaaab...',
    '....baab....',
    '.....bb.....',
    '............',
    '............',
  ],
  tech: [
    '............',
    'bbbbbbbbbbbb',
    'bccccccccccb',
    'bcdddddddddb',
    'bcdaddadddcb',
    'bcddddddadcb',
    'bcdddadddddb',
    'bbbbbbbbbbbb',
    '....baab....',
    '..bbbbbbbb..',
    '..baaaaaab..',
    '..bbbbbbbb..',
  ],
  stolen_goods: [
    '...bbbbbb...',
    '..bb....bb..',
    '..b......b..',
    'bbbbbbbbbbbb',
    'baaaaaaaaaab',
    'bacaaaaaaaab',
    'baaaabbaaaab',
    'baaaaddaaaab',
    'baaaabbaaaab',
    'baaaaaaaaaab',
    'baaaaaaaaaab',
    'bbbbbbbbbbbb',
  ],
};

const TINTS = {
  A: { a: '#b8ff3c', c: '#eaffc0' },
  B: { a: '#2ef6ff', c: '#c8fcff' },
  C: { a: '#ffb547', c: '#ffe2b0' },
  X: { a: '#a99cc9', c: '#e0d8f8' },
};
const CAT_ACCENT = { power: '#fff36a', food: '#ff6a3c', salvage: '#7d6fa3', sundry: '#ff3fd8', chrome: '#ff3fd8', shard: '#ff3fd8', luxury: '#f5d76e', tech: '#2ef6ff', stolen_goods: '#ff4d6a' };

function mapSvg(map, colors, label) {
  let rects = '';
  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    for (let x = 0; x < row.length; x++) {
      const k = row[x];
      if (k === '.') continue;
      rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${colors[k] || '#fff'}"/>`;
    }
  }
  return `<svg viewBox="0 0 12 12" shape-rendering="crispEdges" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

export function itemIconSvg(category, quality = 'B', label = category) {
  const map = MAPS[category] || MAPS.sundry;
  const t = TINTS[quality] || TINTS.X;
  return mapSvg(map, { a: t.a, b: '#130b24', c: t.c, d: CAT_ACCENT[category] || '#ff3fd8', e: '#f4f0ff' }, label);
}

export function itemIconEl(category, quality, { small = false, label } = {}) {
  const d = document.createElement('div');
  d.className = 'item-icon' + (small ? ' sm' : '') + ' q-' + (quality || 'B');
  d.innerHTML = itemIconSvg(category, quality, label || category);
  return d;
}

// --- UI icons (stroke SVGs) ---
const UI = {
  ledger: '<path d="M5 3h11a2 2 0 0 1 2 2v15H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h11"/><path d="M9 7h6M9 10h6"/>',
  box: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>',
  door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M3 21h18"/><circle cx="15" cy="12" r="1"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  flame: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-8z"/>',
};

export function uiIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI[name] || ''}</svg>`;
}

/** Hologram sigil for credchits. Deterministic from a string. */
export function sigilSvg(seedStr = 'x') {
  let h = 2166136261;
  for (const ch of String(seedStr)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const n = 5 + (h % 4);
  let pts = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const rr = i % 2 ? 14 + ((h >> (i % 16)) & 7) : 28;
    pts += `${(32 + Math.cos(a) * rr).toFixed(1)},${(32 + Math.sin(a) * rr).toFixed(1)} `;
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="hg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#2ef6ff"/><stop offset=".5" stop-color="#ff3fd8"/><stop offset="1" stop-color="#b8ff3c"/></linearGradient></defs><polygon points="${pts}" fill="none" stroke="url(#hg)" stroke-width="2.5"/><circle cx="32" cy="32" r="7" fill="url(#hg)" opacity=".8"/></svg>`;
}

/** Maker's mark glyph for appraisal (from mark text). */
export function markSvg(text = '') {
  let h = 5381;
  for (const ch of String(text)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  const shapes = [];
  const col = ['#f5d76e', '#2ef6ff', '#ff3fd8', '#b8ff3c'][h % 4];
  const kind = h % 5;
  if (kind === 0) shapes.push('<circle cx="16" cy="16" r="11"/>');
  if (kind === 1) shapes.push('<rect x="5" y="5" width="22" height="22" rx="3"/>');
  if (kind === 2) shapes.push('<polygon points="16,3 29,27 3,27"/>');
  if (kind === 3) shapes.push('<polygon points="16,3 29,16 16,29 3,16"/>');
  if (kind === 4) shapes.push('<path d="M4 24 L10 8 L16 20 L22 8 L28 24"/>');
  const inner = (h >> 3) % 4;
  if (inner === 0) shapes.push('<circle cx="16" cy="16" r="3"/>');
  if (inner === 1) shapes.push('<path d="M10 16h12M16 10v12"/>');
  if (inner === 2) shapes.push('<path d="M11 11l10 10M21 11l-10 10"/>');
  if (inner === 3) shapes.push('<path d="M10 20 Q16 8 22 20"/>');
  return `<svg viewBox="0 0 32 32" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">${shapes.join('')}</svg>`;
}

const MOOD_COL = { happy: '#b8ff3c', neutral: '#2ef6ff', annoyed: '#ffb547', angry: '#ff4d6a' };
const MOOD_MOUTH = {
  happy: '<path d="M7 14 Q12 19 17 14"/>',
  neutral: '<path d="M8 15h8"/>',
  annoyed: '<path d="M8 16 L16 14"/>',
  angry: '<path d="M7 17 Q12 12 17 17"/>',
};
const MOOD_BROW = { happy: '', neutral: '', annoyed: '<path d="M6 8h4M14 8h4"/>', angry: '<path d="M6 7l4 2M18 7l-4 2"/>' };
export function moodSvg(mood = 'neutral') {
  const c = MOOD_COL[mood] || MOOD_COL.neutral;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" role="img" aria-label="mood: ${mood}"><circle cx="12" cy="12" r="10"/><circle cx="9" cy="10.5" r=".6" fill="${c}"/><circle cx="15" cy="10.5" r=".6" fill="${c}"/>${MOOD_BROW[mood] || ''}${MOOD_MOUTH[mood] || MOOD_MOUTH.neutral}</svg>`;
}
