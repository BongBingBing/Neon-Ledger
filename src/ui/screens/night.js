import { h, btn, actBtn, fmt } from '../dom.js';
import { list, get, nameOf, prettify, MOD } from '../content.js';
import { itemIconEl } from '../art/icons.js';
import { defOf, itemTitle, stockManager } from '../components/items.js';
import { npcPortrait, safeSel, leaseCard, deedButton, machinesCollect, FACTION_LABEL } from '../components/common.js';

const TABS = [
  ['market', 'Market'], ['workshop', 'Workshop'], ['upgrades', 'Upgrades & Permits'],
  ['contacts', 'Contacts'], ['job', 'Night Job'], ['dues', 'Dues'],
];

export function render(root, ctx) {
  const s = ctx.state;
  const ui = ctx.ui;
  if (!TABS.some(([id]) => id === ui.tab)) ui.tab = 'market';
  const dot = {
    dues: ctx.legal('PAY_DUES'),
    job: ctx.legal('NIGHT_JOB'),
    workshop: ctx.legal('COLLECT_MACHINE'),
    upgrades: ctx.legal('CHOOSE_PERK'),
  };
  const wrap = h('div', { 'data-screen': 'night' });
  wrap.append(h('div.tabs', { role: 'tablist' }, TABS.map(([id, label]) => h('button.tab', {
    type: 'button', role: 'tab', 'aria-selected': String(ui.tab === id), 'data-ui': 'tab-' + id,
    onclick: () => { ui.tab = id; ctx.render(); },
  }, label, dot[id] ? h('span.dot', { 'aria-label': 'needs attention' }) : null))));

  const panel = h('div', { role: 'tabpanel' });
  ({ market, workshop, upgrades, contacts, job, dues })[ui.tab](panel, ctx);
  wrap.append(panel);
  root.append(wrap);

  ctx.bar.append(
    btn('Stock', () => ctx.openSheet('stock'), { ui: 'open-stock' }),
    actBtn(ctx, 'Sleep', { type: 'SLEEP' }, {
      variant: 'primary',
      before: (go) => (ctx.legal('PAY_DUES') ? ctx.confirmBox('Sleep without paying dues?', 'Rook will count it as a skip. Skipping raises the chance of a break-in tonight.', 'Sleep anyway', go, 'warn') : go()),
    }),
  );
}

// ---------------- Market ----------------
function market(root, ctx) {
  const s = ctx.state;
  const listings = safeSel(ctx, 'marketListings') || s.market?.listings || [];
  const buys = ctx.legalList('BUY_STOCK');
  const free = (safeSel(ctx, 'freeSlots', 'storage') ?? 0) + (safeSel(ctx, 'freeSlots', 'shelf') ?? 0);
  root.append(h('div.row.between.small', { style: { margin: '2px 2px 8px' } },
    h('span.muted', 'Suppliers tonight'), h('span.mono', `${free} free slot${free === 1 ? '' : 's'}`)));
  if (!listings.length) root.append(h('div.empty', 'Nobody’s selling tonight.'));
  const lst = h('div.list');
  listings.forEach((l, i) => {
    const d = defOf(ctx, l.itemId);
    const can1 = buys.some((a) => a.listingIndex === i);
    const maxQ = Math.max(0, Math.min(l.qty, free, Math.floor(s.creds / Math.max(1, l.price))));
    lst.append(h('div.li', { 'data-listing': String(i) },
      itemIconEl(d.category, l.quality || 'B', { small: true, label: d.category }),
      h('div.grow',
        h('div.li-title', d.name),
        h('div.li-sub', `${prettify(d.category)} · ref ${fmt.creds(d.basePrice)} · ${l.qty} left`),
        h('div.tells', d.legality === 'contraband' ? h('span.pill.red', 'Contraband') : d.legality === 'permit' ? h('span.pill.amber', 'Permit') : null,
          d.perishableDays ? h('span.pill.dim', `Keeps ${d.perishableDays}d`) : null)),
      h('div', { style: { textAlign: 'right' } },
        h('div.mono', { style: { color: 'var(--acid)', fontWeight: 800 } }, fmt.creds(l.price)),
        h('div.move-btns', { style: { marginTop: '4px' } },
          btn('Buy', () => ctx.dispatch({ type: 'BUY_STOCK', listingIndex: i, qty: 1 }), { small: true, variant: 'good', action: 'BUY_STOCK', disabled: !can1, aria: `Buy one ${d.name}` }),
          maxQ > 1 && can1 ? btn('×' + maxQ, () => ctx.dispatch({ type: 'BUY_STOCK', listingIndex: i, qty: maxQ }), { small: true, action: 'BUY_STOCK', aria: `Buy ${maxQ} ${d.name}` }) : null))));
  });
  root.append(lst);
  const sells = ctx.legalList('SELL_TO_MARKET');
  if (sells.length) {
    root.append(h('div.section-title', 'Dump stock to suppliers'), h('div.tiny.muted', { style: { margin: '-4px 2px 6px' } }, 'Suppliers pay little, but it frees a slot and turns junk into creds.'));
    root.append(stockManager(ctx, { extraRight: 'sell', compact: true }));
  }
}

// ---------------- Workshop ----------------
function workshop(root, ctx) {
  const s = ctx.state;
  const mc = machinesCollect(ctx);
  if (mc) root.append(mc);
  const owned = Object.entries(s.machines || {}).filter(([, m]) => m && m.owned !== false);
  const runs = ctx.legalList('RUN_MACHINE');
  if (!owned.length) root.append(h('div.empty', 'No machines yet. Buy one below.'));
  for (const [id, m] of owned) {
    const def = get('machines', id) || {};
    const myRuns = runs.filter((a) => a.machineId === id);
    const byRecipe = new Map();
    for (const a of myRuns) { if (!byRecipe.has(a.recipeId)) byRecipe.set(a.recipeId, []); byRecipe.get(a.recipeId).push(a); }
    const status = m.broken ? h('span.pill.red', 'Broken') : m.job ? h('span.pill.cyan', `Busy → ready day ${m.job.readyDay ?? '?'}`) : h('span.pill.acid', 'Idle');
    root.append(h('div.card', { 'data-machine': id },
      h('div.row.between', h('div', { style: { fontWeight: 800 } }, def.name || prettify(id)), status),
      def.flavor ? h('div.tiny.muted', { style: { margin: '4px 0' } }, def.flavor) : null,
      def.kind === 'passive' ? h('div.tiny.muted', 'Always on.') : null,
      m.job ? h('div.small', `Running: ${nameOf('recipes', m.job.recipeId)} (${(m.job.inputUids || []).length} item${(m.job.inputUids || []).length === 1 ? '' : 's'})`) : null,
      m.broken && def.repairCost ? h('div.small', { style: { color: 'var(--red)' } }, `Needs repair (${fmt.creds(def.repairCost)}).`) : null,
      ctx.legalList('REPAIR_MACHINE').filter((a) => a.machineId === id).map((a) => actBtn(ctx, `Repair ${def.repairCost ? fmt.creds(def.repairCost) : ''}`, a, { small: true, variant: 'warn' })),
      [...byRecipe.entries()].map(([rid, acts]) => recipeBlock(ctx, rid, acts)),
      !m.job && !m.broken && def.kind !== 'passive' && !myRuns.length ? h('div.tiny.muted', { style: { marginTop: '6px' } }, 'Nothing to run: no suitable inputs in stock.') : null));
  }
  const avail = safeSel(ctx, 'availableMachines') || [];
  const buyable = toEntries(avail, 'machines');
  if (buyable.length) {
    root.append(h('div.section-title', 'Buy machines'));
    root.append(h('div.list', buyable.map((m) => purchaseRow(ctx, m, 'BUY_MACHINE'))));
  }
}

function recipeBlock(ctx, rid, acts) {
  const r = get('recipes', rid) || {};
  const names = (a) => (a.inputUids || []).map((u) => { const it = ctx.state.inventory.find((i) => i.uid === u); return it ? itemTitle(ctx, it) : u; });
  const costTxt = [r.powerCost ? `power ${fmt.creds(r.powerCost)}/set` : '', r.partsCost ? `parts ${fmt.creds(r.partsCost)}/set` : '', r.days ? `${r.days} night${r.days > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  return h('div', { style: { marginTop: '10px', borderTop: '1px dashed var(--line)', paddingTop: '8px' } },
    h('div.row.between', h('div', { style: { fontWeight: 700 } }, r.name || prettify(rid)), h('span.tiny.muted', costTxt)),
    r.flavor ? h('div.tiny.muted', r.flavor) : null,
    r.risk?.poisonChance ? h('div.tiny', { style: { color: 'var(--amber)' } }, 'Risky: filler can make people sick.') : null,
    h('div.stack', { style: { marginTop: '6px' } }, acts.slice(0, 6).map((a) => {
      const n = names(a);
      const label = a.label || (n.length ? `Run on ${n.length > 2 ? n.length + ' items' : n.join(' + ')}` : 'Run');
      return actBtn(ctx, label, a, { small: true, variant: 'cyan', cls: 'btn-block', match: { machineId: a.machineId, recipeId: a.recipeId } });
    })));
}

function toEntries(arr, contentName) {
  return (arr || []).map((x) => {
    const id = typeof x === 'string' ? x : x.id;
    const def = get(contentName, id) || {};
    return { ...def, ...(typeof x === 'object' ? x : {}), id };
  });
}

function purchaseRow(ctx, e, type, { owned = false, note = null } = {}) {
  const cost = e.price ?? e.cost ?? 0;
  const ok = ctx.legal(type, { id: e.id });
  return h('div.li.no-icon', { 'data-id': e.id },
    h('div', h('div.li-title', e.name || prettify(e.id)),
      h('div.li-sub', e.blurb || e.desc || e.description || e.flavor || ''),
      e.weeklyFee ? h('div.tiny', { style: { color: 'var(--amber)' } }, `+${fmt.creds(e.weeklyFee)} weekly fee`) : null,
      note ? h('div.tiny', { style: { color: 'var(--amber)' } }, note) : null),
    owned ? h('span.pill.acid', 'Owned') : actBtn(ctx, fmt.creds(cost), { type, id: e.id }, { small: true, variant: 'good', disabled: !ok, aria: `Buy ${e.name || e.id} for ${cost}` }));
}

function reqNote(e) {
  const r = e.requires || {};
  const parts = [];
  if (e.minRep != null) parts.push(`needs ${FACTION_LABEL[e.faction] || e.faction} rep ${e.minRep}`);
  if (r.rep) for (const [f, v] of Object.entries(r.rep)) parts.push(`needs ${FACTION_LABEL[f] || f} rep ${v}`);
  if (r.upgrades) parts.push('after ' + r.upgrades.map((u) => nameOf('upgrades', u)).join(', '));
  if (r.machines) parts.push('needs ' + r.machines.map((u) => nameOf('machines', u)).join(', '));
  if (r.licence) parts.push('needs ' + nameOf('licences', r.licence));
  return parts.join(' · ') || null;
}

// ---------------- Upgrades & permits ----------------
function upgrades(root, ctx) {
  const s = ctx.state;
  // perks
  if ((s.perkPoints || 0) > 0 || ctx.legal('CHOOSE_PERK')) {
    const perkActs = ctx.legalList('CHOOSE_PERK');
    root.append(h('div.card.glow-mag', h('h3', { style: { color: 'var(--mag)' } }, `Perk point${s.perkPoints > 1 ? 's' : ''} available: ${s.perkPoints}`),
      h('div.list', perkActs.map((a) => { const p = get('perks', a.perkId) || {}; return h('div.li.no-icon', h('div', h('div.li-title', p.name || prettify(a.perkId)), h('div.li-sub', p.blurb || '')), actBtn(ctx, 'Take', a, { small: true, variant: 'primary', match: { perkId: a.perkId } })); }))));
  }
  const ownedUp = new Set([...(s.upgrades || []), ...(Array.isArray(s.owned) ? s.owned : [])]);
  const avail = toEntries(safeSel(ctx, 'availableUpgrades') || [], 'upgrades');
  const availIds = new Set(avail.map((u) => u.id));
  const allUp = list('upgrades').length ? list('upgrades') : avail;
  root.append(h('div.section-title', 'Shop upgrades'));
  root.append(h('div.list', allUp.filter((u) => availIds.has(u.id) || ownedUp.has(u.id) || ctx.legal('BUY_UPGRADE', { id: u.id })).map((u) => purchaseRow(ctx, { ...u, ...(avail.find((a) => a.id === u.id) || {}) }, 'BUY_UPGRADE', { owned: ownedUp.has(u.id) }))));
  const locked = allUp.filter((u) => !availIds.has(u.id) && !ownedUp.has(u.id) && !ctx.legal('BUY_UPGRADE', { id: u.id }));
  if (locked.length) root.append(h('details', { style: { margin: '8px 2px' } }, h('summary.small.muted', `${locked.length} more upgrades locked`),
    h('div.list', { style: { marginTop: '6px' } }, locked.map((u) => purchaseRow(ctx, u, 'BUY_UPGRADE', { note: reqNote(u) })))));

  root.append(h('div.section-title', 'Vantage permits (legal)'));
  root.append(h('div.list', list('permits').map((p) => purchaseRow(ctx, p, 'BUY_PERMIT', { owned: (s.permits || []).includes(p.id), note: ctx.legal('BUY_PERMIT', { id: p.id }) ? null : reqNote(p) }))));
  root.append(h('div.section-title', 'Lantern licences (black market)'));
  root.append(h('div.list', list('licences').map((p) => purchaseRow(ctx, p, 'BUY_LICENCE', { owned: (s.licences || []).includes(p.id), note: ctx.legal('BUY_LICENCE', { id: p.id }) ? null : reqNote(p) }))));
  root.append(leaseCard(ctx));
  const deed = deedButton(ctx);
  if (deed) root.append(h('div.card.glow-cyan', deed));
}

// ---------------- Contacts ----------------
function contacts(root, ctx) {
  const s = ctx.state;
  const favs = ctx.legalList('CONTACT_FAVOR');
  const npcs = list('npcs').filter((n) => (n.favors && n.favors.length) || favs.some((a) => a.npcId === n.id));
  if (!npcs.length) { root.append(h('div.empty', 'No contacts yet.')); return; }
  for (const n of npcs) {
    const rep = s.rep?.[n.faction];
    const tier = n.faction && s.rep?.[n.faction] != null ? safeSel(ctx, 'repTier', n.faction) : null;
    const nf = n.favors || [];
    const acts = favs.filter((a) => a.npcId === n.id);
    const ids = new Set([...nf.map((f) => f.id), ...acts.map((a) => a.favorId)]);
    root.append(h('div.card', { 'data-npc': n.id },
      h('div.row', { style: { alignItems: 'flex-start' } }, npcPortrait(n.id, 56),
        h('div.grow', h('div', { style: { fontWeight: 800 } }, n.name), h('div.tiny', { class: 'f-' + n.faction }, `${FACTION_LABEL[n.faction] || ''}${rep != null ? ` · rep ${rep > 0 ? '+' : ''}${rep}` : ''}${tier ? ' · ' + tier : ''}`),
          n.role ? h('div.tiny.muted', prettify(n.role)) : null)),
      h('div.list', { style: { marginTop: '8px' } }, [...ids].map((fid) => {
        const f = nf.find((x) => x.id === fid) || {};
        const a = acts.find((x) => x.favorId === fid);
        return h('div.li.no-icon',
          h('div', h('div.li-title', f.name || prettify(fid)), h('div.li-sub', f.text || f.blurb || ''), f.minRep != null && !a ? h('div.tiny', { style: { color: 'var(--amber)' } }, `needs rep ${f.minRep}`) : null),
          actBtn(ctx, f.cost ? fmt.creds(f.cost) : 'Ask', { type: 'CONTACT_FAVOR', npcId: n.id, favorId: fid }, { small: true, variant: 'cyan', disabled: !a }));
      }))));
  }
}

// ---------------- Night job ----------------
function job(root, ctx) {
  const s = ctx.state;
  const acts = ctx.legalList('NIGHT_JOB');
  if (s.nightJobDone && !acts.length) { root.append(h('div.card', h('h3', 'Night job'), h('div.small', 'You’ve already done a job tonight. Get some sleep.'))); return; }
  const jobs = list('jobs');
  const ids = new Set([...jobs.map((j) => j.id), ...acts.map((a) => a.jobId)]);
  root.append(h('div.tiny.muted', { style: { margin: '0 2px 8px' } }, 'One optional job per night. Pay now, consequences later.'));
  for (const id of ids) {
    const j = get('jobs', id) || {};
    const a = acts.find((x) => x.jobId === id);
    const pay = Array.isArray(j.pay) ? `${fmt.creds(j.pay[0])}–${fmt.creds(j.pay[1])}` : '';
    const reps = j.rep ? Object.entries(j.rep).map(([f, d]) => `${FACTION_LABEL[f] || f} ${d > 0 ? '+' : ''}${d}`).join(', ') : '';
    root.append(h('div.card', { 'data-job': id },
      h('div.row', { style: { alignItems: 'flex-start' } }, j.npcId ? npcPortrait(j.npcId, 52) : null,
        h('div.grow', h('div', { style: { fontWeight: 800 } }, j.name || prettify(id)),
          h('div.tiny.muted', [pay, reps, j.heat ? `Heat ${j.heat > 0 ? '+' : ''}${j.heat}` : ''].filter(Boolean).join(' · ')),
          j.text?.offer ? h('div.small', { style: { marginTop: '4px' } }, j.text.offer) : null,
          j.risk?.injuryChance ? h('div.tiny', { style: { color: 'var(--amber)' } }, `Injury risk ${Math.round(j.risk.injuryChance * 100)}%`) : null,
          !a ? h('div.tiny', { style: { color: 'var(--amber)' } }, reqNote(j) || (s.nightJobDone ? 'Already worked tonight.' : 'Not available tonight.')) : null)),
      h('div', { style: { marginTop: '8px' } }, actBtn(ctx, 'Take the job', { type: 'NIGHT_JOB', jobId: id }, { variant: 'cyan', cls: 'btn-block', small: true, disabled: !a }))));
  }
}

// ---------------- Dues ----------------
function dues(root, ctx) {
  const s = ctx.state;
  const q = safeSel(ctx, 'duesQuote');
  const rook = get('npcs', 'rook') || { name: 'Rook' };
  const canPay = ctx.legal('PAY_DUES');
  const rookLine = rook.lines?.dues_ask?.[s.day % (rook.lines.dues_ask.length || 1)] || rook.lines?.greet?.[0] || '“Evening! Lovely stall. Be a shame if the rain got in.”';
  root.append(h('div.card.glow-mag', { 'data-ui': 'dues-panel' },
    h('div.row', { style: { alignItems: 'flex-start' } }, npcPortrait('rook', 64, canPay ? 'happy' : s.duesSkipStreak ? 'annoyed' : 'happy'),
      h('div.grow', h('div', { style: { fontWeight: 800 } }, rook.name, h('span.tiny.f-lantern', { style: { marginLeft: '6px' } }, 'Lantern Syndicate')),
        h('div.speech', String(rookLine).replace(/\{(\w+)\}/g, (_, k) => ({ amount: q, name: s.shopName, shop: s.shopName }[k] ?? ''))))),
    h('div.kv', { style: { marginTop: '10px' } },
      h('span', 'Tonight’s dues'), h('span', { style: { color: 'var(--amber)' } }, q != null ? fmt.creds(q) : '—'),
      h('span', 'Nights skipped in a row'), h('span', { style: { color: s.duesSkipStreak ? 'var(--red)' : '' } }, String(s.duesSkipStreak || 0)),
      h('span', 'Status'), h('span', s.duesPaidTonight ? 'Paid' : canPay ? 'Unpaid' : 'Skipped')),
    h('div.tiny.muted', { style: { marginTop: '6px' } }, 'Skipping saves creds but makes a break-in more likely. A Security Shutter halves the odds.'),
    canPay ? h('div.btn-row', { style: { marginTop: '10px' } },
      actBtn(ctx, 'Skip', { type: 'SKIP_DUES' }, { variant: 'ghost' }),
      actBtn(ctx, `Pay ${q != null ? fmt.creds(q) : ''}`, { type: 'PAY_DUES' }, { variant: 'warn' })) : null));
}
