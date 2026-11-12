import { h, btn, fmt } from '../dom.js';
import { listSlots } from '../../platform/storage.js';
import { drawPortrait } from '../art/portrait.js';

export function render(root, ctx) {
  root.classList.add('center');
  const slots = listSlots().sort((a, b) => b.savedAt - a.savedAt);
  const latest = slots[0];

  const art = h('canvas', { width: 48, height: 48, 'aria-hidden': 'true', style: { width: '120px', height: '120px', imageRendering: 'pixelated', borderRadius: '14px', border: '2px solid var(--line)', boxShadow: '0 0 30px rgba(255,63,216,.25)' } });
  drawPortrait(art, { seed: 77 + new Date().getDate(), traits: { faction: 'sump' } }, { mood: 'neutral' });

  root.append(h('div.title-wrap', { 'data-screen': 'title' },
    art,
    h('h1.logo.flicker', 'NEON', h('br'), h('span.l2', 'LEDGER')),
    h('div.tagline', '“Every deal leaves a mark.”'),
    h('div.title-menu',
      latest ? btn([h('div', 'Continue'), h('div.tiny.muted', `${latest.shopName} · Day ${latest.day} · ${fmt.creds(latest.creds)}`)], () => ctx.loadSlot(latest.slot), { variant: 'primary', ui: 'continue' }) : null,
      btn('New game', () => ctx.go('newgame'), { variant: latest ? '' : 'primary', ui: 'new-game' }),
      slots.length ? btn('Load slot', () => ctx.openSheet('slots'), { ui: 'load' }) : null,
      btn('Settings', () => ctx.go('settings'), { variant: 'ghost', ui: 'settings' }),
      btn('How it works', () => ctx.openSheet('help'), { variant: 'ghost', ui: 'help' }),
    ),
    h('div.version', `v${ctx.app.engine?.ENGINE_VERSION ?? '?'} · ${ctx.app.engineName} · offline-ready`),
  ));
}
