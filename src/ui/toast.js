import { h } from './dom.js';

let host = null;
const MAX = 3;

export function mountToasts(el) { host = el; }

export function toast(text, kind = '', ms = 2600) {
  if (!host || !text) return;
  while (host.children.length >= MAX) host.firstChild.remove();
  const t = h('div.toast', { class: kind, role: 'status' }, text);
  t.addEventListener('click', () => t.remove());
  host.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

export function floatNum(text, color = 'var(--acid)') {
  const el = h('div.float-num', { style: { color } }, text);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
