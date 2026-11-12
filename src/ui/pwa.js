// Service worker registration + update flow. All URLs relative (served from a GitHub Pages subpath).
import { h } from './dom.js';

export function initPwa() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
    // Cache every module the page actually loaded (first visit happens before the SW controls the page).
    const send = () => {
      const urls = performance.getEntriesByType('resource').map((r) => r.name)
        .concat([location.href.split('#')[0]])
        .filter((u) => u.startsWith(location.origin));
      const sw = reg.active || reg.waiting || reg.installing;
      sw?.postMessage({ type: 'CACHE_URLS', urls });
    };
    if (reg.active) send(); else navigator.serviceWorker.ready.then(send);

    const offerUpdate = (worker) => {
      if (!worker || !navigator.serviceWorker.controller) return;
      if (document.querySelector('.update-banner')) return;
      const bar = h('div.update-banner.card.glow-cyan', { role: 'status' },
        h('div.row.between',
          h('span.small', 'A new version of Neon Ledger is ready.'),
          h('button.btn.btn-cyan.btn-sm', { type: 'button', 'data-ui': 'sw-update', onclick: () => worker.postMessage({ type: 'SKIP_WAITING' }) }, 'Update')));
      document.body.appendChild(bar);
    };
    if (reg.waiting) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => { if (nw.state === 'installed') offerUpdate(nw); });
    });
    // Check for updates when the app comes back to the foreground.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch((e) => console.warn('SW registration failed', e));

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return; // first install: no reload needed
    reloading = true;
    location.reload();
  });
}
