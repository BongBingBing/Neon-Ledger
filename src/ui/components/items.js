import { h, fmt, btn } from '../dom.js';
import { itemIconEl } from '../art/icons.js';
import { itemDef as contentItem, prettify } from '../content.js';

export function defOf(ctx, itemId) {
  let d = null;
  try { d = ctx.sel?.itemDef?.(itemId); } catch { d = null; }
  return d || contentItem(itemId) || { id: itemId, name: prettify(itemId), category: 'sundry', basePrice: 0 };
}

const FLAG_PILLS = {
  stolen: ['Stolen', 'red'], counterfeit: ['Fake', 'red'], tracer: ['Tracer', 'mag'], untested: ['Untested', 'amber'],
  cut: ['Cut w/ filler', 'amber'], labelled: ['Labelled', 'mag'], hotListed: ['HOT LIST', 'red'], hot: ['HOT LIST', 'red'],
  glitchy: ['Glitchy', 'amber'], corpSecret: ['Corp secret', 'mag'], scanned: ['Scanned', 'cyan'], genuine: ['Genuine', 'acid'],
  junk: ['Junk', 'dim'], memories: ['Memories', 'cyan'], wiped: ['Wiped', 'dim'], charged: ['Charged', 'acid'], fresh: ['Fresh', 'acid'],
};

/** Pills describing what the player KNOWS about an item (never reads invItem.flags). */
export function knownPills(ctx, it) {
  const out = [];
  const k = it.known || {};
  for (const [key, val] of Object.entries(k)) {
    if (val === true && FLAG_PILLS[key]) out.push(h('span.pill', { class: FLAG_PILLS[key][1] }, FLAG_PILLS[key][0]));
    else if (val === false && key === 'untested') out.push(h('span.pill.acid', 'Tested'));
    else if (val === false && (key === 'counterfeit')) out.push(h('span.pill.acid', 'Genuine'));
    else if (val === false && (key === 'stolen' || key === 'hotListed')) out.push(h('span.pill.acid', 'Clean'));
    else if (typeof val === 'string' && key === 'contents') out.push(h('span.pill.cyan', prettify(val)));
  }
  let illegal = false;
  try { illegal = !!ctx.sel?.isIllegal?.(ctx.state, it); } catch { illegal = false; }
  if (illegal) out.push(h('span.pill.mag', 'Illegal'));
  if (it.spoilsDay != null && ctx.state) {
    const d = it.spoilsDay - ctx.state.day;
    out.push(h('span.pill', { class: d <= 0 ? 'red' : d <= 1 ? 'amber' : 'dim' }, d <= 0 ? 'Spoils tonight' : `Spoils ${d}d`));
  }
  return out;
}

export function condText(it) {
  const k = it.known || {};
  if (k.untested === true && k.conditionEstimate == null) return 'Cond ?';
  const c = k.conditionEstimate ?? it.condition;
  return c == null ? '' : `Cond ${Math.round(c)}%`;
}

export function itemTitle(ctx, it) {
  const d = defOf(ctx, it.itemId);
  return d.name || prettify(it.itemId);
}

/** Compact list row. right: element(s) on the right. */
export function itemRow(ctx, it, { right = null, onTap = null, selected = false, sub = null } = {}) {
  const d = defOf(ctx, it.itemId);
  const meta = [condText(it), it.quality ? 'Grade ' + it.quality : '', it.serial ? it.serial : ''].filter(Boolean).join(' · ');
  return h('div.li', {
    class: [onTap && 'tap', selected && 'sel'].filter(Boolean).join(' '),
    role: onTap ? 'button' : null, tabindex: onTap ? '0' : null,
    'aria-pressed': onTap ? String(!!selected) : null,
    onclick: onTap ? () => onTap(it) : null,
    'data-uid': it.uid,
  },
  itemIconEl(d.category, it.quality, { small: true, label: d.category }),
  h('div.grow',
    h('div.li-title', d.name || prettify(it.itemId)),
    h('div.li-sub', sub ?? meta),
    h('div.tells', knownPills(ctx, it))),
  right ? h('div', right) : null);
}

/** Big item card for the counter. */
export function itemCard(ctx, it, { price = null, priceLabel = 'Ask' } = {}) {
  const d = defOf(ctx, it.itemId);
  const cond = (it.known?.conditionEstimate ?? it.condition);
  return h('div.card.item-card', { 'data-uid': it.uid },
    itemIconEl(d.category, it.quality, { label: d.category }),
    h('div',
      h('div.item-name', d.name || prettify(it.itemId)),
      h('div.item-meta', h('span', prettify(d.category)), it.quality ? h('span', 'Grade ' + it.quality) : null, it.serial ? h('span.mono', it.serial) : null, d.basePrice ? h('span', 'Ref ' + fmt.creds(d.basePrice)) : null),
      cond != null && it.known?.untested !== true ? h('div.cond-bar', h('i', { style: { width: Math.max(0, Math.min(100, cond)) + '%' } })) : null,
      h('div.item-meta', condText(it)),
      h('div.tells', knownPills(ctx, it)),
      d.flavor ? h('div.tiny.muted', { style: { marginTop: '4px' } }, d.flavor) : null,
    ),
    price != null ? h('div.price-tag', h('small', priceLabel), fmt.creds(price)) : null,
  );
}

const LOCS = [
  { id: 'shelf', label: 'Shelf', short: 'Shelf' },
  { id: 'storage', label: 'Back room', short: 'Store' },
  { id: 'stash', label: 'Stash (audit-safe)', short: 'Stash' },
];

/** Stock manager: shelf / storage / stash with move buttons driven by legalActions. */
export function stockManager(ctx, { compact = false, extraRight = null } = {}) {
  const s = ctx.state;
  const moves = ctx.legalList('MOVE_ITEM');
  const sells = ctx.legalList('SELL_TO_MARKET');
  const inspects = ctx.legalList('INSPECT').filter((a) => a.target && a.target !== 'customer');
  const wrap = h('div.stock');
  for (const loc of LOCS) {
    const cap = s.capacity?.[loc.id] ?? 0;
    const items = (s.inventory || []).filter((i) => i.location === loc.id);
    if (loc.id === 'stash' && cap <= 0 && !items.length) {
      wrap.append(h('div.loc-head.loc-stash', h('h4', 'Stash'), h('span.cap', 'locked')),
        h('div.empty.tiny', 'No stash yet. A Floor Cavity upgrade hides goods from audits.'));
      continue;
    }
    wrap.append(h('div.loc-head', { class: 'loc-' + loc.id }, h('h4', loc.label), h('span.cap', `${items.length}/${cap}`)));
    if (!items.length) { wrap.append(h('div.empty.tiny', 'Empty')); continue; }
    const list = h('div.list');
    for (const it of items) {
      const btns = [];
      for (const to of LOCS) {
        if (to.id === loc.id) continue;
        const ok = moves.some((a) => a.uid === it.uid && a.to === to.id);
        if (ok || (moves.length && s.capacity?.[to.id] > 0)) {
          btns.push(btn('→' + to.short, () => ctx.dispatch({ type: 'MOVE_ITEM', uid: it.uid, to: to.id }), { small: true, disabled: !ok, action: 'MOVE_ITEM', aria: `Move ${itemTitle(ctx, it)} to ${to.label}` }));
        }
      }
      for (const a of inspects.filter((x) => x.target === it.uid)) {
        btns.push(btn(prettify(a.tool), () => ctx.dispatch({ type: 'INSPECT', tool: a.tool, target: it.uid }), { small: true, variant: 'cyan', action: 'INSPECT' }));
      }
      if (extraRight === 'sell' && sells.some((a) => a.uid === it.uid)) {
        btns.push(btn('Dump', () => ctx.dispatch({ type: 'SELL_TO_MARKET', uid: it.uid }), { small: true, variant: 'warn', action: 'SELL_TO_MARKET', aria: `Sell ${itemTitle(ctx, it)} to market` }));
      }
      list.append(itemRow(ctx, it, { right: btns.length ? h('div.move-btns', { style: { flexDirection: compact ? 'row' : 'column' } }, btns) : null }));
    }
    wrap.append(list);
  }
  return wrap;
}
