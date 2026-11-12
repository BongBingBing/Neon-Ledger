import { h, btn, actBtn, fmt, meter } from '../dom.js';
import { get, nameOf, prettify } from '../content.js';
import { leaseCard, deedButton, repBars, heatMeter, safeSel } from '../components/common.js';

// Rendered as a sheet (openSheet('ledger')) or as a screen; root gets data-screen="ledger".
export function render(root, ctx) {
  const s = ctx.state;
  if (!s) return;
  const net = safeSel(ctx, 'netWorth');
  const stock = safeSel(ctx, 'stockValue');
  const deedPct = Math.max(0, Math.min(100, (s.creds / (s.deedPrice || 1)) * 100));
  const st = s.stats || {};
  const wrap = h('div', { 'data-screen': 'ledger' });

  wrap.append(h('div.card.glow-cyan',
    h('div.row.between', h('div', h('div.tiny.muted', s.shopName), h('div.big-num', { class: s.creds < 0 ? 'neg' : 'pos' }, fmt.creds(s.creds))),
      h('div', { style: { textAlign: 'right' } }, h('div.tiny.muted', 'Net worth'), h('div.mono', fmt.creds(net)), h('div.tiny.muted', `stock ${fmt.creds(stock)}`))),
    h('div', { style: { marginTop: '10px' } },
      h('div.row.between.small', h('span', 'The Deed'), h('span.mono', `${fmt.creds(Math.max(0, s.creds))} / ${fmt.creds(s.deedPrice)}`)),
      meter(deedPct, 100, { cls: 'deed', label: `${Math.floor(deedPct)}%` })),
    deedButton(ctx) ? h('div', { style: { marginTop: '10px' } }, deedButton(ctx)) : null));

  wrap.append(leaseCard(ctx));
  wrap.append(h('div.card', heatMeter(ctx)));
  wrap.append(h('div.card', h('h3', 'Reputation'), repBars(ctx)));

  // perks & permits
  const perks = s.perks || [];
  wrap.append(h('div.card', h('h3', 'Perks'),
    perks.length ? h('div.stack', perks.map((p) => { const d = get('perks', p) || {}; return h('div', h('div', { style: { fontWeight: 700 } }, d.name || prettify(p)), h('div.tiny.muted', d.blurb || '')); })) : h('div.small.muted', 'None yet. One perk point per week survived.'),
    (s.perkPoints || 0) > 0 ? h('div', { style: { marginTop: '8px' } },
      h('div.small', { style: { color: 'var(--mag)' } }, `${s.perkPoints} perk point(s) to spend:`),
      h('div.stack', { style: { marginTop: '6px' } }, ctx.legalList('CHOOSE_PERK').map((a) => { const d = get('perks', a.perkId) || {}; return h('div.li.no-icon', h('div', h('div.li-title', d.name || prettify(a.perkId)), h('div.li-sub', d.blurb || '')), actBtn(ctx, 'Take', a, { small: true, variant: 'primary', match: { perkId: a.perkId } })); }))) : null,
    (s.permits?.length || s.licences?.length) ? h('div', { style: { marginTop: '10px' } }, h('h3', 'Papers'),
      h('div.tells', (s.permits || []).map((p) => h('span.pill.cyan', nameOf('permits', p))), (s.licences || []).map((p) => h('span.pill.amber', nameOf('licences', p))))) : null));

  // events
  const act = s.events?.active || [], fc = s.events?.forecast || [];
  if (act.length || fc.length) {
    wrap.append(h('div.card', h('h3', 'Events'),
      act.map((e) => h('div.small', h('span.pill.mag', 'Now'), ' ', nameOf('events', e.id), e.untilDay ? h('span.tiny.muted', ` until day ${e.untilDay}`) : null)),
      fc.map((e) => h('div.small', { style: { marginTop: '4px' } }, h('span.pill.cyan', `Day ${e.startDay}`), ' ', nameOf('events', e.id)))));
  }

  wrap.append(h('div.card', h('h3', 'Stats'), h('div.kv',
    h('span', 'Day'), h('span', String(s.day)),
    h('span', 'Appeal'), h('span', String(s.appeal ?? '—')),
    h('span', 'Customers served'), h('span', fmt.num(st.customersServed)),
    h('span', 'Best single sale'), h('span', fmt.creds(st.bestSale)),
    h('span', 'Ghost chits caught'), h('span', fmt.num(st.ghostChitsCaught)),
    h('span', 'Audits survived'), h('span', fmt.num(st.auditsSurvived)),
    h('span', 'Total earned'), h('span', fmt.creds(st.totalEarned)),
    h('span', 'Total spent'), h('span', fmt.creds(st.totalSpent)),
    h('span', 'Capacity'), h('span', `${s.capacity?.shelf ?? 0} / ${s.capacity?.storage ?? 0} / ${s.capacity?.stash ?? 0}`))));
  root.append(wrap);
  if (ctx.foot) ctx.foot.append(btn('Close', ctx.closeSheet, { variant: 'primary', ui: 'ledger-close' }));
}
