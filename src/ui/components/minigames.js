import { h, btn, actBtn, fmt } from '../dom.js';
import { get, MOD, prettify } from '../content.js';
import { markSvg } from '../art/icons.js';
import { itemCard } from './items.js';
import { sfx } from '../audio.js';

function targetItem(ctx, ins) {
  const s = ctx.state;
  const t = ins.targetUid ?? ins.target;
  if (t === 'customer' || !t) return s.customer?.item || null;
  return s.inventory.find((i) => i.uid === t) || s.customer?.item || null;
}

export function renderInspection(wrap, ctx) {
  const ins = ctx.state.inspection;
  const it = targetItem(ctx, ins);
  if (it) wrap.append(itemCard(ctx, it));
  if (ins.tool === 'probe') probe(wrap, ctx, ins);
  else if (ins.tool === 'appraise') appraise(wrap, ctx, ins);
  else wrap.append(h('div.card', h('h3', prettify(ins.tool)), h('div.small', JSON.stringify(ins.revealed || {}))));
  ctx.bar.append(actBtn(ctx, ins.inputsLeft > 0 && ins.tool === 'probe' ? 'Stop probing' : 'Done', { type: 'INSPECT_END' }, { variant: 'primary' }));
}

function probe(wrap, ctx, ins) {
  const size = ins.data?.size || 4;
  const rev = ins.revealed || {};
  const faults = Object.values(rev).filter((v) => v === 'fault').length;
  const cells = [];
  for (let i = 0; i < size * size; i++) {
    const r = rev[i] ?? rev[String(i)];
    cells.push(h('button.probe-cell', {
      type: 'button', class: r || '', 'data-action': 'INSPECT_INPUT', 'data-cell': String(i),
      'aria-label': `Node ${i + 1}${r ? ': ' + r : ''}`,
      disabled: !!r || ins.inputsLeft <= 0,
      onclick: () => {
        const res = ctx.dispatch({ type: 'INSPECT_INPUT', input: { cell: i } });
        const v = res?.state?.inspection?.revealed?.[i];
        sfx(v === 'fault' ? 'fault' : 'probe');
      },
    }, h('span', r === 'fault' ? '✕' : r === 'ok' ? '·' : '')));
  }
  wrap.append(h('div.card',
    h('div.row.between', h('h3', { style: { margin: 0 } }, 'Circuit probe'), h('span.mono', { style: { color: 'var(--cyan)' } }, `${ins.inputsLeft} probes left`)),
    h('div.tiny.muted', { style: { margin: '4px 0 6px' } }, 'Tap nodes to test them. Red nodes are faults: they drag the true condition down and add repair cost.'),
    h('div.probe-grid', { style: { gridTemplateColumns: `repeat(${size}, 1fr)` } }, cells),
    h('div.row.between.small', h('span', `Faults found: ${faults}`), ins.data?.faultCount != null ? h('span.muted', `of ${ins.data.faultCount}`) : null),
    ins.result ? h('div.small', { style: { marginTop: '6px', color: 'var(--acid)' } }, ins.result.text || '') : null));
}

function hasReferenceIndex(s) {
  const owned = (x) => Array.isArray(x) ? x.includes('reference_index') : !!x?.reference_index;
  return owned(s.upgrades) || owned(s.machines) && (s.machines.reference_index?.owned !== false) || owned(s.licences) || owned(s.perks) || owned(s.owned) || !!s.flags?.referenceIndex;
}

function appraise(wrap, ctx, ins) {
  const s = ctx.state;
  const marks = ins.data?.marks || [];
  const brandId = ins.data?.brand;
  const brand = get('brands', brandId) || MOD.brands?.BRAND_BY_ID?.[brandId];
  const refOk = hasReferenceIndex(s) || ins.data?.reference;
  const refMarks = ins.data?.reference || (refOk ? brand?.marks : null);
  const picked = ins.revealed?.choice ?? ins.revealed?.mark;
  const done = ins.inputsLeft <= 0 || ins.revealed?.result != null;
  const markBtn = (m, i) => h('button.mark', {
    type: 'button', 'aria-pressed': String(picked === i), 'data-action': 'INSPECT_INPUT', 'data-mark': String(i), disabled: done,
    onclick: () => ctx.dispatch({ type: 'INSPECT_INPUT', input: { mark: i } }),
  }, h('span', { html: markSvg(m) }), h('span.mk', String(m)));
  wrap.append(h('div.card',
    h('div.row.between', h('h3', { style: { margin: 0 } }, 'Appraise maker’s marks'), h('span.pill.amber', brand?.name || prettify(brandId || 'brand'))),
    h('div.tiny.muted', { style: { margin: '4px 0 8px' } }, 'Fakes get one mark wrong. Tap the mark you think is forged, or declare it genuine.'),
    h('div.marks', marks.map(markBtn)),
    h('div', { style: { marginTop: '8px' } }, btn('All genuine', () => ctx.dispatch({ type: 'INSPECT_INPUT', input: { mark: -1 } }), { variant: picked === -1 ? 'cyan' : '', cls: 'btn-block', action: 'INSPECT_INPUT', disabled: done, ui: 'all-genuine' })),
    h('div.section-title', 'Reference Index'),
    refMarks ? h('div.marks', refMarks.map((m) => h('div.mark.ref', h('span', { html: markSvg(m) }), h('span.mk', String(m)))))
      : h('div.small.muted', 'You don’t own the Reference Index. Without it you’re guessing. (Upgrades at night.)'),
    ins.revealed?.result ? h('div.small', { style: { marginTop: '8px', color: ins.revealed.result === 'correct' || ins.revealed.result === true ? 'var(--acid)' : 'var(--amber)' } },
      ins.revealed.text || (ins.revealed.result === 'correct' ? 'Your read checks out.' : 'Hard to say.')) : null));
}
