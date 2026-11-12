import { h, btn, actBtn, fmt } from '../dom.js';
import { get } from '../content.js';
import { repBars, safeSel } from '../components/common.js';
import { drawPortrait } from '../art/portrait.js';

export function render(root, ctx) {
  const s = ctx.state;
  const e = s.ending || { title: 'The End', text: '', win: false };
  const def = get('endings', e.id) || {};
  const st = { ...(s.stats || {}), ...(e.stats || {}) };
  const art = h('canvas', { width: 48, height: 48, 'aria-hidden': 'true', style: { width: '112px', height: '112px', imageRendering: 'pixelated', borderRadius: '12px', border: '2px solid var(--line)', display: 'block', margin: '0 auto' } });
  drawPortrait(art, { seed: s.seed || 1, traits: { faction: 'sump' } }, { mood: e.win ? 'happy' : 'angry' });
  root.append(h('div', { 'data-screen': 'ending' },
    h('div', { style: { textAlign: 'center', marginTop: '8px' } }, art,
      h('div', { style: { color: 'var(--dim)', letterSpacing: '.18em', fontSize: '12px', marginTop: '10px' } }, e.win ? 'YOU OWN THE STALL' : 'THE STALL IS LOST'),
      h('div.ending-title', { class: e.win ? 'win' : 'lose' }, e.title || def.title || def.name || 'The End'),
      h('p', { style: { margin: '0 6px 12px' } }, e.text || def.text || '')),
    h('div.card', h('h3', 'The numbers'), h('div.kv',
      h('span', 'Days survived'), h('span', String(st.daysSurvived ?? s.day)),
      h('span', 'Net worth'), h('span', fmt.creds(st.netWorth ?? safeSel(ctx, 'netWorth'))),
      h('span', 'Best single sale'), h('span', fmt.creds(st.bestSale)),
      h('span', 'Customers served'), h('span', fmt.num(st.customersServed)),
      h('span', 'Ghost chits caught'), h('span', fmt.num(st.ghostChitsCaught)),
      h('span', 'Audits survived'), h('span', fmt.num(st.auditsSurvived)))),
    h('div.card', h('h3', 'Standing'), repBars(ctx)),
  ));
  ctx.bar.append(
    ctx.legal('CONTINUE_ENDLESS') ? actBtn(ctx, 'Keep trading', { type: 'CONTINUE_ENDLESS' }, { variant: 'good' }) : null,
    btn('New game', () => { ctx.quitToTitle(); ctx.go('newgame'); }, { variant: 'primary', ui: 'new-game' }),
    btn('Title', () => ctx.quitToTitle(), { variant: 'ghost', ui: 'title' }),
  );
}
