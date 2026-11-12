import { h, btn, fmt } from '../dom.js';
import { listSlots } from '../../platform/storage.js';
import { stockManager } from '../components/items.js';

export function renderStock(root, ctx) {
  const s = ctx.state;
  if (!s) return;
  const canMove = ctx.legalList('MOVE_ITEM').length > 0;
  root.append(h('div', { 'data-screen': 'stock' },
    !canMove ? h('div.card.small.muted', s.phase === 'open' ? 'The shop is open. You can only rearrange stock at dawn or night. Only shelf items can be sold at the counter.' : 'Nothing can be moved right now.') : null,
    s.audit ? h('div.card.warn.small', 'Inspector Halloran is outside. Anything not in the stash will be checked.') : null,
    stockManager(ctx, { extraRight: s.phase === 'night' ? 'sell' : null })));
  ctx.foot.append(btn('Done', ctx.closeSheet, { variant: 'primary', ui: 'stock-done' }));
}

export function renderSlots(root, ctx) {
  const slots = listSlots().sort((a, b) => b.savedAt - a.savedAt);
  if (!slots.length) { root.append(h('div.empty', 'No saves yet.')); return; }
  root.append(h('div.list', { 'data-screen': 'slots' }, slots.map((m) => h('div.li.no-icon.tap', { role: 'button', tabindex: '0', 'data-ui': 'slot-' + m.slot, onclick: () => ctx.loadSlot(m.slot) },
    h('div', h('div.li-title', `${m.slot === 'auto' ? 'Autosave' : 'Slot ' + m.slot}: ${m.shopName}`),
      h('div.li-sub', `Day ${m.day} · ${fmt.creds(m.creds)} · ${new Date(m.savedAt).toLocaleString()}`)),
    h('span.pill.cyan', 'Load')))));
}

export function renderHelp(root) {
  const p = (t) => h('p.small', t);
  root.append(h('div', { 'data-screen': 'help' },
    p('Each day: read the Feed at DAWN, run the COUNTER, then work the BACK ROOM at night and SLEEP.'),
    p('Buyers want something from your shelf: pick an item, name a price, haggle. Sellers bring goods: inspect before you pay.'),
    p('Watch the payment chit. Wrong name, wrong ward, glitching sigil or an expired date means a ghost chit: the creds vanish overnight.'),
    p('Illegal goods build Heat. High Heat brings an audit at dawn. Stash what you can before the inspector arrives.'),
    p('The lease is due every 7 days and it grows every week. Miss it twice and you are out. Raise enough creds to buy the Deed and the Stall is yours.'),
  ));
}
