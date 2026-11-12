// Tiny DOM helpers. h('div.card#id', {onclick, class, style, aria-label...}, children...)

export function h(tag, props, ...children) {
  if (props == null || typeof props !== 'object' || Array.isArray(props) || props instanceof Node) {
    if (props != null) children.unshift(props);
    props = {};
  }
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [null, tag, ''];
  const ns = props.svg ? 'http://www.w3.org/2000/svg' : null;
  const el = ns ? document.createElementNS(ns, m[1] || 'g') : document.createElement(m[1] || 'div');
  for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false || k === 'svg') continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'class') {
      for (const c of String(v).split(/\s+/).filter(Boolean)) el.classList.add(c);
    } else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    } else if (k === 'html') {
      el.innerHTML = v;
    } else if (k === 'text') {
      el.textContent = v;
    } else if (k === 'disabled' || k === 'checked' || k === 'value' || k === 'selected') {
      el[k] = v;
    } else {
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export const fmt = {
  creds(n) {
    const v = Math.round(Number(n) || 0);
    const s = Math.abs(v).toLocaleString('en-US');
    return (v < 0 ? '−' : '') + s + '¢';
  },
  signed(n) {
    const v = Math.round(Number(n) || 0);
    return (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toLocaleString('en-US') + '¢';
  },
  num(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); },
  pct(n) { return Math.round(Number(n) || 0) + '%'; },
  cap(s) { s = String(s ?? ''); return s.charAt(0).toUpperCase() + s.slice(1); },
  label(s) { return fmt.cap(String(s ?? '').replace(/_/g, ' ')); },
};

/** Big tappable button. variant: primary|ghost|danger|warn|good */
export function btn(label, onClick, { variant = '', disabled = false, aria, small = false, cls = '', title, action, ui } = {}) {
  return h('button', {
    type: 'button',
    'data-action': action,
    'data-ui': ui,
    class: ['btn', variant && 'btn-' + variant, small && 'btn-sm', cls].filter(Boolean).join(' '),
    disabled,
    'aria-label': aria,
    title,
    onclick: (e) => { if (!disabled) onClick?.(e); },
  }, label);
}

export function meter(value, max, { cls = '', label, show = true, signed = false } = {}) {
  let pct;
  if (signed) pct = ((Number(value) + max) / (2 * max)) * 100;
  else pct = (Number(value) / max) * 100;
  pct = Math.max(0, Math.min(100, pct));
  return h('div.meter', { class: cls, role: 'meter', 'aria-valuenow': value, 'aria-valuemin': signed ? -max : 0, 'aria-valuemax': max, 'aria-label': label },
    h('div.meter-fill', { style: { width: pct + '%' } }),
    signed ? h('div.meter-mid') : null,
    show && label ? h('span.meter-label', label) : null,
  );
}

/** Button that dispatches an engine action; disabled unless legal. Always tagged data-action. */
export function actBtn(ctx, label, action, opts = {}) {
  const ok = opts.force ?? ctx.legal(action.type, opts.match ?? paramsOf(action));
  return btn(label, () => (opts.before ? opts.before(() => ctx.dispatch(action)) : ctx.dispatch(action)), { ...opts, action: action.type, disabled: opts.disabled || !ok });
}
function paramsOf(a) {
  const p = { ...a }; delete p.type;
  for (const k of Object.keys(p)) if (typeof p[k] === 'object') delete p[k];
  return Object.keys(p).length ? p : undefined;
}
