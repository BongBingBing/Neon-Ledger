import { h, btn, fmt } from '../dom.js';
import { list } from '../content.js';

// Display-only fallbacks in case content fails to load (ids per ARCHITECTURE R8).
const FALLBACK_BG = [
  { id: 'tinker', name: 'Tinker', creds: 400, twist: 'Chrome Refurb. Starts with a Repair Bench.' },
  { id: 'shard_diver', name: 'Shard Diver', creds: 400, twist: 'Data Shards. Starts with a Shard Scanner. +5 Static.' },
  { id: 'sparky', name: 'Sparky', creds: 450, twist: 'Power Cells. Starts with a Cell Charger.' },
  { id: 'line_cook', name: 'Line Cook', creds: 450, twist: 'Synth Kitchen. Starts with a Vat Cooker. +10 Sump.' },
  { id: 'fence', name: 'Fence', creds: 350, twist: 'Fencing. 2 stash slots. +15 Lantern, −10 Vantage.' },
  { id: 'nobody', name: 'Nobody', creds: 60, twist: 'Nothing. Hard mode start.' },
];
const FALLBACK_DIFF = [
  { id: 'drizzle', name: 'Drizzle', tagline: 'Easy', description: 'Lease ×1.10/wk, +1 patience, less Heat.' },
  { id: 'acid', name: 'Acid Rain', tagline: 'Normal', description: 'The Sump as it is.' },
  { id: 'downpour', name: 'Downpour', tagline: 'Hard', description: 'Lease ×1.20/wk, Deed +25%, −1 patience.' },
];

const NAME_IDEAS = ['The Stall', 'Merle’s Corner', 'Drip & Deal', 'Stairwell 9', 'Wet Ledger', 'Last Light Kiosk'];

export function render(root, ctx) {
  const ui = ctx.ui;
  ui.ng ||= { shopName: NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)], background: 'tinker', difficulty: 'acid' };
  const ng = ui.ng;
  const bgs = list('backgrounds').length ? list('backgrounds') : FALLBACK_BG;
  const diffs = list('difficulties').length ? list('difficulties') : FALLBACK_DIFF;

  const input = h('input.text-input', {
    type: 'text', maxlength: '24', value: ng.shopName, 'data-ui': 'shop-name', id: 'shop-name',
    autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'done',
    oninput: (e) => { ng.shopName = e.target.value; },
  });

  const choice = (opt, key, ui2) => h('button.choice', {
    type: 'button', 'aria-pressed': String(ng[key] === opt.id), 'data-ui': ui2 + '-' + opt.id,
    onclick: () => { ng[key] = opt.id; ctx.render(); },
  },
  h('div.c-title', h('span', opt.name), key === 'background' && opt.creds != null ? h('span.mono', { style: { color: 'var(--acid)' } }, fmt.creds(opt.creds)) : h('span.tiny.muted', opt.tagline || '')),
  h('div.c-desc', key === 'background' ? (opt.twist || '') : (opt.description || '')),
  key === 'background' && opt.blurb && ng.background === opt.id ? h('div.c-desc', { style: { fontStyle: 'italic', color: 'var(--amber)' } }, opt.blurb) : null);

  root.append(h('div', { 'data-screen': 'newgame' },
    h('div.row.between', { style: { marginBottom: '10px' } },
      btn('‹ Back', () => ctx.go('title'), { variant: 'ghost', small: true, ui: 'back' }),
      h('h2', { style: { margin: 0, fontSize: '18px', letterSpacing: '.1em', color: 'var(--mag)' } }, 'NEW LEASE'),
      h('span', { style: { width: '60px' } })),
    h('div.card',
      h('div.field', h('label', { for: 'shop-name' }, 'Shop name'), input),
      h('div.tiny.muted', 'Aunt Merle left you a stairwell kiosk in the Sump, and her debts. LEASEHOLD sends its regards. :)')),
    h('div.section-title', 'Background'),
    h('div.choice-list', bgs.map((b) => choice(b, 'background', 'bg'))),
    h('div.section-title', 'Weather (difficulty)'),
    h('div.choice-list', diffs.map((d) => choice(d, 'difficulty', 'diff'))),
  ));

  ctx.bar.append(btn('Open the Stall', () => {
    const name = (ng.shopName || '').trim() || 'The Stall';
    ctx.startNewGame({ shopName: name.slice(0, 24), background: ng.background, difficulty: ng.difficulty, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
  }, { variant: 'primary', ui: 'start' }));
}
