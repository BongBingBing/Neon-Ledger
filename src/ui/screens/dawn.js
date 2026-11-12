import { h, btn, actBtn, fmt } from '../dom.js';
import { nameOf, get } from '../content.js';
import { itemRow } from '../components/items.js';
import { leaseCard, deedButton, machinesCollect } from '../components/common.js';

const AVATAR = { lease: 'LH', news: 'SW', hotlist: 'VB', warning: '!!', system: '··', msg: '' };

export function feedMessage(f) {
  const kind = f.kind || 'system';
  const from = f.from || { lease: 'LEASEHOLD', news: 'SumpWire', hotlist: 'Vantage Bulletin', warning: 'Warning', system: 'System' }[kind] || 'Message';
  const av = AVATAR[kind] || from.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return h('div.msg', { class: kind },
    h('div.avatar', { 'aria-hidden': 'true' }, av || from.slice(0, 2).toUpperCase()),
    h('div.bubble', h('div.from', from), h('div', f.text)));
}

export function render(root, ctx) {
  const s = ctx.state, sel = ctx.sel;
  const today = (s.feed || []).filter((f) => f.day === s.day);
  const feed = today.length ? today : (s.feed || []).slice(-8);
  const news = feed.filter((f) => f.kind === 'news');
  const msgs = feed.filter((f) => f.kind !== 'news' && f.kind !== 'hotlist');

  const wrap = h('div', { 'data-screen': 'dawn' });
  if (news.length) wrap.append(h('div.ticker', { 'aria-label': 'News ticker' }, h('span', news.map((n) => '▸ ' + n.text).join('     '))));

  // Audit panel (live preview recomputed by the engine after each MOVE_ITEM)
  if (s.audit) wrap.append(auditPanel(ctx));

  wrap.append(h('div.phone',
    h('div.phone-head', h('span', `${s.shopName}`), h('span', `DAY ${s.day} · 06:12`)),
    msgs.length ? msgs.map(feedMessage) : h('div.empty.tiny', 'No messages. Suspiciously quiet.')));

  // Hot list
  if (s.hotList?.length) {
    wrap.append(h('div.card.glow-mag',
      h('h3', { style: { color: 'var(--mag)' } }, 'Vantage Hot List'),
      h('div.tiny.muted', { style: { marginBottom: '6px' } }, 'Wanted serials today. Holding or selling these is evidence.'),
      h('div.hotlist', s.hotList.map((sn) => h('span', sn)))));
  }

  // Forecast & active events
  const act = s.events?.active || [], fc = s.events?.forecast || [];
  if (act.length || fc.length) {
    wrap.append(h('div.card',
      h('h3', 'Weather & word on the stairs'),
      act.map((e) => h('div.row.small', h('span.pill.mag', 'Now'), h('span', nameOf('events', e.id)), h('span.muted.tiny', e.untilDay ? `until day ${e.untilDay}` : ''))),
      fc.map((e) => h('div.row.small', { style: { marginTop: '4px' } }, h('span.pill.cyan', `Day ${e.startDay}`), h('span', nameOf('events', e.id)),
        e.certainty != null ? h('span.muted.tiny', `${Math.round(e.certainty * 100)}% sure`) : null))));
  }

  wrap.append(leaseCard(ctx));
  const mc = machinesCollect(ctx);
  if (mc) wrap.append(mc);
  const deed = deedButton(ctx);
  if (deed) wrap.append(h('div.card.glow-cyan', deed));

  root.append(wrap);

  // action bar
  ctx.bar.append(
    btn('Stock', () => ctx.openSheet('stock'), { ui: 'open-stock' }),
    s.audit ? null : actBtn(ctx, 'Open shop', { type: 'OPEN_SHOP' }, { variant: 'primary' }),
  );
  if (s.audit) {
    ctx.bar.append(h('div.row',
      actBtn(ctx, 'Comply', { type: 'AUDIT_RESPOND', choice: 'comply' }, { variant: 'warn' }),
      actBtn(ctx, `Bribe ${fmt.creds(s.audit.bribeCost)}`, { type: 'AUDIT_RESPOND', choice: 'bribe' }, { variant: 'danger', before: (go) => ctx.confirmBox('Offer a “fee”?', `Costs ${fmt.creds(s.audit.bribeCost)}. ${Math.round((s.audit.bribeChance ?? 0) * 100)}% chance Halloran looks the other way. If he doesn't, the fine doubles.`, 'Bribe', go, 'danger') })));
  }
}

function auditPanel(ctx) {
  const s = ctx.state;
  const a = s.audit;
  const found = a.found || [];
  const npc = get('npcs', 'halloran') || get('npcs', 'inspector_halloran');
  return h('div.card.danger.pulse', { 'data-ui': 'audit-panel' },
    h('h3', { style: { color: 'var(--red)' } }, 'AUDIT THIS MORNING'),
    h('div.small', `${npc?.name || 'Inspector Dace Halloran'} is coming down the stairwell. He'll check the shelf and back room${s.heat >= 80 ? ' — and maybe one stash slot' : ''}. Move contraband into the stash first.`),
    h('div.kv', { style: { margin: '10px 0' } },
      h('span', 'Items he would find'), h('span', String(found.length)),
      h('span', 'Fine if you comply'), h('span', { style: { color: 'var(--red)' } }, fmt.creds(a.fine)),
      h('span', 'Bribe cost'), h('span', fmt.creds(a.bribeCost)),
      h('span', 'Bribe odds'), h('span', Math.round((a.bribeChance ?? 0) * 100) + '%')),
    found.length ? h('div.list', found.map((it) => itemRow(ctx, it))) : h('div.small', { style: { color: 'var(--acid)' } }, 'Nothing illegal in view. Comply with a smile.'),
    h('div', { style: { marginTop: '10px' } }, btn('Move items to stash', () => ctx.openSheet('stock'), { variant: 'cyan', cls: 'btn-block', ui: 'audit-stash' })));
}
