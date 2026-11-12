import { h, btn, actBtn, fmt } from '../dom.js';
import { nameOf, get, prettify, MOD } from '../content.js';
import { itemCard, itemRow, defOf } from '../components/items.js';
import { portraitEl, factionBadge, patiencePips, safeSel, FACTION_LABEL } from '../components/common.js';
import { renderInspection } from '../components/minigames.js';
import { sigilSvg } from '../art/icons.js';
import { itemIconEl } from '../art/icons.js';

const snap = (v) => Math.max(0, Math.round(v / 5) * 5);

function wardName(id) {
  const w = get('names', id) || MOD.names?.WARD_BY_ID?.[id];
  return w?.name || prettify(id);
}

function custLine(c) {
  const d = c.dialogue || {};
  return d.current || d.line || d.last || d.greet || '…';
}

function queueIndicator(ctx) {
  const s = ctx.state;
  const left = (s.queue || []).length;
  const total = safeSel(ctx, 'customerCountToday');
  const pips = [];
  for (let i = 0; i < Math.min(left, 14); i++) pips.push(h('i'));
  return h('div.queue-ind', { 'aria-label': `${left} waiting` }, s.customer ? h('i.cur') : null, pips, h('span', { style: { marginLeft: '6px' } }, `${left} waiting${total != null ? '' : ''}`));
}

export function render(root, ctx) {
  const s = ctx.state;
  const wrap = h('div.counter-wrap', { 'data-screen': 'counter' });
  root.append(wrap);

  if (s.inspection) {
    renderInspection(wrap, ctx);
    return;
  }
  const c = s.customer;
  if (!c) return renderDoor(wrap, ctx);

  // reset haggle state per customer
  const ui = ctx.ui;
  if (!ui.haggle || ui.haggle.cid !== c.id || ui.haggle.item !== (c.selectedUid || c.item?.uid)) {
    ui.haggle = { cid: c.id, item: c.selectedUid || c.item?.uid, price: null, lastAsk: null };
  }
  const ask = c.agreedPrice ?? c.askPrice ?? 0;
  if (ui.haggle.lastAsk !== ask) { ui.haggle.price = ask; ui.haggle.lastAsk = ask; }

  // --- customer card
  const kindLabel = c.kind === 'buyer' ? 'Buying' : c.kind === 'seller' ? 'Selling' : 'Visitor';
  wrap.append(h('div.card.glow-cyan',
    h('div.row.between', { style: { marginBottom: '8px' } }, queueIndicator(ctx), h('span.pill.dim', kindLabel)),
    h('div.cust-card',
      portraitEl(c),
      h('div', { style: { minWidth: 0 } },
        h('div.cust-name', c.name),
        h('div.row', { style: { flexWrap: 'wrap', gap: '4px', marginTop: '2px' } }, factionBadge(c.faction), c.homeWard ? h('span.tiny.muted', 'from ' + wardName(c.homeWard)) : null),
        h('div.speech', { 'data-ui': 'dialogue' }, custLine(c)),
        c.patienceMax ? patiencePips(c) : null))));

  const chitPending = ctx.legal('ACCEPT_CHIT') || ctx.legal('REJECT_CHIT');
  if (chitPending && c.chit) {
    renderChit(wrap, ctx, c);
    return;
  }
  if (c.kind === 'special') return renderSpecial(wrap, ctx, c);
  if (c.kind === 'buyer') renderBuyer(wrap, ctx, c);
  else renderSeller(wrap, ctx, c);
}

function renderDoor(wrap, ctx) {
  const s = ctx.state;
  const left = (s.queue || []).length;
  wrap.append(h('div.card', { style: { textAlign: 'center', padding: '28px 14px' } },
    h('div', { style: { fontSize: '13px', letterSpacing: '.14em', color: 'var(--cyan)', textTransform: 'uppercase' } }, 'Counter'),
    h('div', { style: { fontSize: '20px', fontWeight: 800, margin: '8px 0' } }, left ? 'Someone’s waiting under the awning.' : 'The stairwell is empty.'),
    queueIndicator(ctx),
    h('div.small.muted', { style: { marginTop: '10px' } }, left ? 'Take your time. Nobody here is in a hurry except the rain.' : 'You can close up and head to the back room.')));
  shelfPreview(wrap, ctx);
  ctx.bar.append(
    btn('Stock', () => ctx.openSheet('stock'), { ui: 'open-stock' }),
    ctx.legal('NEXT_CUSTOMER') ? actBtn(ctx, 'Next customer', { type: 'NEXT_CUSTOMER' }, { variant: 'primary' }) : null,
    actBtn(ctx, 'Close shop', { type: 'CLOSE_SHOP' }, {
      variant: left ? 'ghost' : 'primary',
      before: (go) => (left ? ctx.confirmBox('Close early?', `${left} customer(s) still waiting will leave.`, 'Close shop', go, 'warn') : go()),
    }),
  );
}

function shelfPreview(wrap, ctx) {
  const items = safeSel(ctx, 'shelfItems') || [];
  wrap.append(h('div.card', h('div.row.between', h('h3', 'On the shelf'), h('span.mono.tiny.muted', `${items.length}/${ctx.state.capacity?.shelf ?? '?'}`)),
    items.length ? h('div.row', { style: { flexWrap: 'wrap', gap: '6px' } }, items.map((it) => { const d = defOf(ctx, it.itemId); return h('div', { title: d.name }, itemIconEl(d.category, it.quality, { small: true, label: d.name })); }))
      : h('div.empty.tiny', 'Your shelf is bare. Buyers can only buy what’s on the shelf.')));
}

function wantText(ctx, c) {
  const w = c.wants || {};
  if (w.itemId) return nameOf('items', w.itemId);
  if (w.category) {
    const lbl = MOD.items?.CATEGORY_LABELS?.[w.category];
    return lbl || prettify(w.category);
  }
  return 'something';
}

function renderBuyer(wrap, ctx, c) {
  const s = ctx.state;
  const selectable = ctx.legalList('SELECT_ITEM');
  const shelf = safeSel(ctx, 'shelfItems') || [];
  const selected = shelf.find((i) => i.uid === c.selectedUid);
  wrap.append(h('div.card',
    h('div.row.between', h('h3', { style: { margin: 0 } }, 'Wants'), h('span.pill.cyan', wantText(ctx, c))),
    selected ? null : h('div.tiny.muted', { style: { marginTop: '6px' } }, 'Pick something from your shelf to offer.')));

  if (selected) {
    wrap.append(itemCard(ctx, selected, { price: c.agreedPrice ?? c.askPrice, priceLabel: c.agreed ? 'Agreed' : 'Their offer' }));
  }
  // shelf picker (always visible so the player can switch items)
  const matches = (it) => { const d = defOf(ctx, it.itemId); return (c.wants?.itemId && it.itemId === c.wants.itemId) || (c.wants?.category && d.category === c.wants.category); };
  const sorted = [...shelf].sort((a, b) => Number(matches(b)) - Number(matches(a)));
  if (!selected || shelf.length > 1) {
    wrap.append(h('div.section-title', selected ? 'Offer something else' : 'Your shelf'),
      sorted.length ? h('div.list', sorted.map((it) => {
        const ok = selectable.some((a) => a.uid === it.uid);
        return itemRow(ctx, it, {
          selected: it.uid === c.selectedUid,
          onTap: ok ? () => ctx.dispatch({ type: 'SELECT_ITEM', uid: it.uid }) : null,
          right: matches(it) ? h('span.pill.acid', 'match') : null,
        });
      })) : h('div.empty', 'Nothing on the shelf to offer.'));
    // tag rows for tests
    wrap.querySelectorAll('.li.tap').forEach((el) => el.setAttribute('data-action', 'SELECT_ITEM'));
  }
  if (selected) haggle(wrap, ctx, c, 'buyer');
  actionBar(ctx, c, !!selected);
}

function renderSeller(wrap, ctx, c) {
  if (c.item) wrap.append(itemCard(ctx, c.item, { price: c.agreedPrice ?? c.askPrice, priceLabel: c.agreed ? 'Agreed' : 'Their ask' }));
  const inspects = ctx.legalList('INSPECT');
  if (inspects.length) {
    wrap.append(h('div.card', h('h3', 'Inspect'),
      h('div.btn-row', inspects.map((a) => actBtn(ctx, toolLabel(a.tool), a, { small: true, variant: 'cyan', match: { tool: a.tool } }))),
      h('div.tiny.muted', { style: { marginTop: '6px' } }, 'Sellers lie. Checking costs nothing but a moment.')));
  }
  const free = (safeSel(ctx, 'freeSlots', 'storage') ?? 0) + (safeSel(ctx, 'freeSlots', 'shelf') ?? 0);
  if (free <= 0) wrap.append(h('div.card.warn.small', 'No free shelf or storage slot. You can’t take this item.'));
  haggle(wrap, ctx, c, 'seller');
  actionBar(ctx, c, true);
}

function toolLabel(t) {
  return { probe: 'Probe circuits', appraise: 'Appraise marks', serial: 'Check serial vs Hot List', scan: 'Scan' }[t] || prettify(t);
}

function haggle(wrap, ctx, c, mode) {
  if (!ctx.legal('OFFER')) return;
  const hs = ctx.ui.haggle;
  const ask = c.agreedPrice ?? c.askPrice ?? 0;
  const it = c.item || ctx.state.inventory.find((i) => i.uid === c.selectedUid) || {};
  const ref = defOf(ctx, it.itemId).basePrice || ask || 50;
  const max = snap(Math.max(ref * 2.2, ask * 1.6, 50));
  if (hs.price == null) hs.price = ask;
  hs.price = Math.max(0, Math.min(max, hs.price));

  const priceEl = h('div.haggle-price', { 'aria-live': 'polite' });
  const diff = h('div.tiny.muted', { style: { textAlign: 'center' } });
  const offer = btn('', () => ctx.dispatch({ type: 'OFFER', price: hs.price }), { variant: 'cyan', action: 'OFFER', cls: 'btn-block' });
  const slider = h('input.slider', {
    type: 'range', min: '0', max: String(max), step: '5', value: String(hs.price), 'data-ui': 'offer-slider', 'aria-label': 'Offer price',
    oninput: (e) => { hs.price = snap(Number(e.target.value)); update(); },
  });
  function update() {
    priceEl.textContent = fmt.creds(hs.price);
    offer.textContent = 'Offer ' + fmt.creds(hs.price);
    if (Number(slider.value) !== hs.price) slider.value = String(hs.price);
    const d = hs.price - ask;
    const who = mode === 'buyer' ? 'their offer' : 'their ask';
    diff.textContent = (ask ? (d === 0 ? `= ${who}` : `${d > 0 ? '+' : '−'}${Math.abs(d)}¢ vs ${who}`) + ' · ' : '') + `ref ${fmt.creds(ref)}`;
  }
  const set = (v) => { hs.price = Math.max(0, Math.min(max, snap(v))); update(); };
  const quick = h('div.quick',
    btn('−10%', () => set(hs.price * 0.9), { small: true, ui: 'q-minus10' }),
    btn('Their price', () => set(ask), { small: true, ui: 'q-their' }),
    btn('Ref', () => set(ref), { small: true, ui: 'q-ref' }),
    btn('+10%', () => set(hs.price * 1.1), { small: true, ui: 'q-plus10' }));
  update();
  wrap.append(h('div.card.haggle',
    h('div.row.between', h('h3', { style: { margin: 0 } }, 'Haggle'), h('span.tiny.muted', mode === 'buyer' ? 'Higher = more for you' : 'Lower = cheaper for you')),
    priceEl, diff, slider, quick, h('div', { style: { marginTop: '8px' } }, offer)));
}

function actionBar(ctx, c, haveItem) {
  const price = c.agreedPrice ?? c.askPrice ?? 0;
  const dealLabel = c.kind === 'buyer' ? `Sell @ ${fmt.creds(price)}` : `Buy @ ${fmt.creds(price)}`;
  ctx.bar.append(
    h('div.row',
      actBtn(ctx, 'Refuse', { type: 'REFUSE' }, { variant: 'ghost' }),
      actBtn(ctx, 'Report', { type: 'REPORT' }, {
        variant: 'danger',
        before: (go) => ctx.confirmBox('Call Vantage?', `Report ${c.name}. If they're up to something you get a bounty (Lanterns won't love it). If not, the stairwell remembers.`, 'Report', go, 'danger'),
      })),
    h('div.row', actBtn(ctx, dealLabel, { type: 'DEAL' }, { variant: 'primary', disabled: !haveItem })),
  );
}

function renderChit(wrap, ctx, c) {
  const s = ctx.state;
  const ch = c.chit;
  const hl = ch.highlight || ch.suspect || null; // Eagle Eye perk hint, if the engine provides one
  const row = (key, label, val) => h('div.chit-row', { class: hl === key ? 'flag' : '' }, h('span', label), h('span', val));
  wrap.append(h('div.card',
    h('h3', 'Payment: credchit'),
    h('div.tiny.muted', { style: { marginBottom: '8px' } }, `Compare with the customer: ${c.name}, ${c.homeWard ? wardName(c.homeWard) : 'unknown ward'} (${FACTION_LABEL[c.faction] || c.faction}). Today is day ${s.day}.`),
    h('div.chit', { 'data-ui': 'chit-panel' },
      h('div.sigil', { class: ch.sigilGlitch ? 'glitch' : '', html: sigilSvg(ch.ward || ch.name) }),
      h('div', { style: { fontSize: '11px', letterSpacing: '.2em', color: 'var(--cyan)', marginBottom: '6px' } }, 'HALCYON CREDCHIT'),
      row('name', 'Holder', ch.name),
      row('ward', 'Ward', ch.ward ? wardName(ch.ward) : '—'),
      row('expiry', 'Expires', ch.expiryDay != null ? `Day ${ch.expiryDay}` : '—'),
      row('amount', 'Amount', fmt.creds(c.agreedPrice ?? c.askPrice)),
      h('div.tiny', { style: { marginTop: '6px', color: 'var(--dim)' } }, 'Hologram sigil should rotate smoothly.'))));
  ctx.bar.append(
    h('div.row',
      actBtn(ctx, 'Refuse chit', { type: 'REJECT_CHIT' }, { variant: 'ghost' }),
      ctx.legal('REPORT') ? actBtn(ctx, 'Report', { type: 'REPORT' }, { variant: 'danger', before: (go) => ctx.confirmBox('Report a ghost chit?', 'Bounty if the chit is spoofed. If it is real, you insulted a paying customer.', 'Report', go, 'danger') }) : null),
    h('div.row', actBtn(ctx, 'Accept payment', { type: 'ACCEPT_CHIT' }, { variant: 'good' })));
}

function renderSpecial(wrap, ctx, c) {
  if (c.item) wrap.append(itemCard(ctx, c.item, { price: c.askPrice || null, priceLabel: 'Price' }));
  const opts = ctx.legalList('SPECIAL_CHOICE');
  const optInfo = (id) => (c.options || c.special?.options || []).find((o) => o.id === id) || {};
  wrap.append(h('div.card', h('h3', 'Your answer'),
    opts.length ? h('div.stack', opts.map((a) => {
      const info = optInfo(a.optionId);
      return h('div', actBtn(ctx, a.label || info.label || prettify(a.optionId), a, { cls: 'btn-block', variant: info.variant || '', match: { optionId: a.optionId } }),
        info.desc ? h('div.tiny.muted', { style: { margin: '2px 4px 0' } }, info.desc) : null);
    })) : h('div.small.muted', 'They just wanted to talk.')));
  if (c.selectedUid || c.item) haggle(wrap, ctx, c, c.item ? 'seller' : 'buyer');
  ctx.bar.append(h('div.row',
    ctx.legal('REFUSE') ? actBtn(ctx, 'Send away', { type: 'REFUSE' }, { variant: 'ghost' }) : null,
    ctx.legal('DEAL') ? actBtn(ctx, 'Deal', { type: 'DEAL' }, { variant: 'primary' }) : null,
    ctx.legal('REPORT') ? actBtn(ctx, 'Report', { type: 'REPORT' }, { variant: 'danger' }) : null));
}
