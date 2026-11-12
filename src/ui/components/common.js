import { h, btn, actBtn, fmt, meter } from '../dom.js';
import { nameOf, get, prettify } from '../content.js';
import { drawPortrait, drawFeet } from '../art/portrait.js';
import { moodSvg } from '../art/icons.js';

export const FACTIONS = [
  { id: 'vantage', name: 'Vantage Security' },
  { id: 'lantern', name: 'Lantern Syndicate' },
  { id: 'static', name: 'The Static' },
  { id: 'sump', name: 'Sump Folk' },
];
export const FACTION_LABEL = { vantage: 'Vantage', lantern: 'Lantern', static: 'Static', sump: 'Sump', spire: 'Spire', none: 'Unaffiliated' };

export function safeSel(ctx, name, ...args) {
  try { return ctx.sel?.[name]?.(ctx.state, ...args); } catch (e) { console.warn('selector failed', name, e); return null; }
}

export function leaseCard(ctx) {
  const s = ctx.state;
  const days = safeSel(ctx, 'daysUntilLease');
  const amt = safeSel(ctx, 'leaseAmount') ?? s.lease?.amount;
  const overdue = s.lease?.overdue || 0;
  const danger = overdue > 0 || s.lease?.graceActive;
  const shortfall = (overdue || amt) - s.creds;
  return h('div.card', { class: danger ? 'danger' : days != null && days <= 1 ? 'warn' : '' },
    h('div.row.between',
      h('h3', { style: { color: danger ? 'var(--red)' : 'var(--amber)', margin: 0 } }, danger ? 'Lease overdue — grace week' : 'Lease'),
      h('span.mono', { style: { color: 'var(--amber)' } }, days == null ? '' : days <= 0 ? 'due today' : `due in ${days}d`)),
    h('div.kv', { style: { marginTop: '6px' } },
      danger ? [h('span', { style: { color: 'var(--red)' } }, 'Overdue (+late fee)'), h('span', { style: { color: 'var(--red)' } }, fmt.creds(overdue))] : null,
      h('span', 'Next lease'), h('span', fmt.creds(amt)),
      h('span', 'Due day'), h('span', String(s.lease?.nextDueDay ?? '?'))),
    danger ? h('div.tiny', { style: { color: '#ffb3c0', marginTop: '6px' } }, 'Miss the next due day too and LEASEHOLD evicts you.') : null,
    shortfall > 0 && days != null && days <= 2 ? h('div.tiny.muted', { style: { marginTop: '4px' } }, `You are ${fmt.creds(shortfall)} short.`) : null,
    ctx.legal('PAY_LEASE') ? h('div', { style: { marginTop: '8px' } },
      actBtn(ctx, danger ? `Pay overdue ${fmt.creds(overdue)}` : 'Pay lease early', { type: 'PAY_LEASE' }, { variant: danger ? 'danger' : 'warn', cls: 'btn-block', small: true })) : null);
}

export function deedButton(ctx) {
  if (!ctx.legal('BUY_DEED')) return null;
  const s = ctx.state;
  return h('div',
    h('div.small', { style: { marginBottom: '8px' } }, `You have enough to buy the Deed (${fmt.creds(s.deedPrice)}). The Stall would be yours. No more lease.`),
    actBtn(ctx, 'Buy the Deed', { type: 'BUY_DEED' }, {
      variant: 'good', cls: 'btn-block',
      before: (go) => ctx.confirmBox('Buy the Deed?', `Pay ${fmt.creds(s.deedPrice)} to Meridian Property Trust and own the Stall outright.`, 'Buy it', go, 'good'),
    }));
}

export function machinesCollect(ctx) {
  const acts = ctx.legalList('COLLECT_MACHINE');
  if (!acts.length) return null;
  return h('div.card.glow-cyan', h('h3', 'Machines finished'),
    h('div.list', acts.map((a) => h('div.li.no-icon',
      h('div', h('div.li-title', nameOf('machines', a.machineId)), h('div.li-sub', a.label || 'Ready to collect')),
      actBtn(ctx, 'Collect', a, { small: true, variant: 'good' })))));
}

export function repBars(ctx) {
  const s = ctx.state;
  return h('div.stack', FACTIONS.map((f) => {
    const v = s.rep?.[f.id] ?? 0;
    const tier = safeSel(ctx, 'repTier', f.id) || '';
    return h('div', { 'data-faction': f.id },
      h('div.row.between.small', h('span', { class: 'f-' + f.id, style: { fontWeight: 700 } }, f.name), h('span.mono.tiny', `${v > 0 ? '+' : ''}${v} · ${tier}`)),
      h('div', { class: 'f-' + f.id }, meter(v, 100, { cls: 'rep', signed: true, label: `${f.name} ${v}`, show: false })));
  }));
}

export function heatMeter(ctx) {
  const s = ctx.state;
  const thr = 60;
  return h('div',
    h('div.row.between.small', h('span', { style: { color: 'var(--mag)', fontWeight: 700 } }, 'Heat'), h('span.mono', `${Math.round(s.heat)}/100${s.auditPending ? ' · AUDIT PENDING' : ''}`)),
    h('div', { style: { position: 'relative' } },
      meter(s.heat, 100, { cls: 'heat', label: `Heat ${Math.round(s.heat)}`, show: false }),
      h('div', { 'aria-hidden': 'true', style: { position: 'absolute', left: thr + '%', top: '-3px', bottom: '-3px', width: '2px', background: '#fff', opacity: '.6' } })),
    h('div.tiny.muted', { style: { marginTop: '2px' } }, 'Audits come when Heat crosses the line (lower during a Crackdown).'));
}

/** Customer portrait frame with mood badge; the feet strip shows footwear (a possible tell). */
export function portraitEl(c, { size = 104, feet = true } = {}) {
  const canvas = h('canvas', { width: 48, height: 48, 'aria-label': `Portrait of ${c.name}` , role: 'img' });
  let traits = { ...(c.portrait?.traits || {}) };
  const npcId = traits.npc || c.npcId;
  const npc = npcId ? get('npcs', npcId) : null;
  if (npc?.portraitTraits) traits = { ...npc.portraitTraits, ...traits, faction: traits.faction || npc.faction };
  if (!traits.faction) traits.faction = c.faction;
  const tells = c.visibleTells || [];
  if (tells.some((t) => /boot/i.test(t))) traits.vantageBoots = true;
  if (tells.includes('nervous')) traits.nervous = true;
  if (tells.some((t) => /verifier/.test(t))) traits.verifier = true;
  try { drawPortrait(canvas, { ...(c.portrait || {}), traits }, { mood: c.mood, faction: c.faction }); } catch (e) { console.warn(e); }
  const frame = h('div.portrait-frame', { style: size !== 104 ? { width: size + 'px', height: size + 'px' } : null },
    canvas, c.mood ? h('div.mood', { html: moodSvg(c.mood) }) : null);
  if (!feet) return frame;
  const fc = h('canvas', { width: 48, height: 12, 'aria-label': 'Footwear', role: 'img', style: { width: '100%', height: 'auto', imageRendering: 'pixelated', display: 'block', borderRadius: '6px', marginTop: '4px', border: '1px solid var(--line)' } });
  try { drawFeet(fc, { ...(c.portrait || {}), traits }, { faction: c.faction }); } catch (e) { console.warn(e); }
  return h('div', frame, fc);
}

export function npcPortrait(npcId, size = 56, mood = 'neutral') {
  const npc = get('npcs', npcId) || {};
  const traits = npc.portraitTraits || npc.portrait?.traits || {};
  let seed = 0; for (const ch of String(npcId)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return portraitEl({ name: npc.name || prettify(npcId), faction: npc.faction || traits.faction || 'none', portrait: { seed: npc.portrait?.seed ?? seed, traits }, mood }, { size, feet: false });
}

export function factionBadge(f) {
  return h('span.badge', { class: 'f-' + (f || 'none') }, FACTION_LABEL[f] || prettify(f || 'none'));
}

export function patiencePips(c) {
  const max = c.patienceMax || c.patience || 0;
  const out = [];
  for (let i = 0; i < max; i++) out.push(h('i', { class: i < c.patience ? 'on' : '' }));
  return h('div.patience', { 'aria-label': `Patience ${c.patience} of ${max}` }, h('span.tiny.muted', 'Patience'), out);
}
