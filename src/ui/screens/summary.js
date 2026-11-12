import { h, btn, fmt } from '../dom.js';
import { nameOf } from '../content.js';

const EV_LABEL = {
  BREAK_IN: (e) => `Break-in: ${(e.stolen || []).length} item(s) taken${e.machineBroken ? ', a machine wrecked' : ''}.`,
  CHIT_BOUNCED: (e) => `Ghost chit bounced: ${fmt.creds(e.amount || 0)} evaporated.`,
  SPOILED: (e) => `${(e.uids || e.itemIds || []).length} item(s) spoiled.`,
  LEASE_PAID: (e) => `Lease paid: ${fmt.creds(e.amount || 0)}.`,
  LEASE_MISSED: () => 'Lease missed. Grace week, late fee added.',
  EVENT_STARTED: (e) => `${nameOf('events', e.id)} begins.`,
  AUDIT_PENDING: () => 'Vantage is coming. Audit at dawn.',
  MACHINE_READY: (e) => `${nameOf('machines', e.machineId)} finished its job.`,
  MACHINE_BROKE: (e) => `${nameOf('machines', e.machineId)} broke down.`,
  PERK_POINT: () => 'A week survived: +1 perk point.',
  FIRE: () => 'Fire in the back room!',
};
const BAD = new Set(['BREAK_IN', 'CHIT_BOUNCED', 'LEASE_MISSED', 'MACHINE_BROKE', 'FIRE', 'AUDIT_PENDING', 'SPOILED']);

export function render(root, ctx) {
  const sum = ctx.ui.summary || {};
  const lines = sum.lines || [];
  const income = sum.income ?? lines.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0);
  const expenses = sum.expenses ?? -lines.filter((l) => l.amount < 0).reduce((a, l) => a + l.amount, 0);
  const net = income - Math.abs(expenses);
  const evs = (sum.events || []).filter((e) => e.text || EV_LABEL[e.type]).filter((e) => !['REP_CHANGED', 'HEAT_CHANGED', 'DAY_SUMMARY'].includes(e.type));

  root.append(h('div', { 'data-screen': 'summary' },
    h('div', { style: { textAlign: 'center', margin: '10px 0 14px' } },
      h('div', { style: { color: 'var(--cyan)', letterSpacing: '.16em', fontSize: '12px' } }, 'LIGHTS OUT'),
      h('div', { style: { fontSize: '24px', fontWeight: 800 } }, `Day ${sum.day ?? ctx.state.day - 1} closed`),
      h('div.big-num', { class: net >= 0 ? 'pos' : 'neg' }, fmt.signed(net))),
    h('div.card',
      h('h3', 'Takings'),
      lines.length ? lines.map((l) => h('div.pl-line', h('span', l.label), h('span.amt', { class: l.amount > 0 ? 'pos' : l.amount < 0 ? 'neg' : 'muted' }, l.amount ? fmt.signed(l.amount) : '—')))
        : h('div.empty.tiny', 'A quiet day. Not a single cred moved.'),
      h('div.pl-line', { style: { borderBottom: 0, fontWeight: 700 } }, h('span', 'Income'), h('span.amt.pos', fmt.creds(income))),
      h('div.pl-line', { style: { borderBottom: 0, fontWeight: 700 } }, h('span', 'Expenses'), h('span.amt.neg', fmt.creds(Math.abs(expenses))))),
    evs.length ? h('div.card', h('h3', 'Overnight'), evs.map((e) => h('div.pl-line', h('span', { class: BAD.has(e.type) ? 'neg' : '' }, e.text || EV_LABEL[e.type](e))))) : null,
    ctx.state ? h('div.card', h('div.kv',
      h('span', 'Creds now'), h('span', { class: ctx.state.creds < 0 ? 'neg' : 'pos' }, fmt.creds(ctx.state.creds)),
      h('span', 'Heat'), h('span', String(Math.round(ctx.state.heat))),
      h('span', 'Lease due'), h('span', `day ${ctx.state.lease?.nextDueDay ?? '?'}`))) : null,
  ));
  ctx.bar.append(btn(ctx.state?.phase === 'ended' ? 'Continue' : 'Wake up', () => ctx.closeSummary(), { variant: 'primary', ui: 'summary-continue' }));
}
