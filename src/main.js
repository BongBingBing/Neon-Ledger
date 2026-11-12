// Bootstrap: load content + engine, mount the UI, register the service worker.
import { loadContent } from './ui/content.js';
import { mount } from './ui/app.js';
import { initPwa } from './ui/pwa.js';

async function loadEngine() {
  try {
    const eng = await import('./engine/index.js');
    if (typeof eng.step === 'function' && typeof eng.newGame === 'function') return { eng, name: 'engine' };
    throw new Error('engine/index.js incomplete');
  } catch (e) {
    console.warn('[NeonLedger] real engine unavailable, using dev mock:', e?.message || e);
    const eng = await import('./ui/dev/mockEngine.js');
    return { eng, name: 'mock' };
  }
}

async function boot() {
  const root = document.getElementById('app');
  try {
    const [, { eng, name }] = await Promise.all([loadContent(), loadEngine()]);
    mount(root, eng, name);
  } catch (e) {
    console.error(e);
    root.innerHTML = '<div style="padding:24px;color:#ff4d6a;font-family:monospace">Neon Ledger failed to start.<br>' + String(e?.message || e) + '</div>';
  }
  initPwa();
}

boot();
