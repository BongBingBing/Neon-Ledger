// App shell: owns the current GameState, wires engine.step → events → autosave → render.
// The UI never mutates GameState and never computes rules (ARCHITECTURE §4).
import { h, clear, fmt } from './dom.js';
import * as storage from '../platform/storage.js';
import { toast, floatNum, mountToasts } from './toast.js';
import { sfx, haptic, unlockAudio, setSound, startRain, stopRain, setAmbience } from './audio.js';
import { mountRain, setRain } from './art/fx.js';
import { uiIcon } from './art/icons.js';
import { nameOf, prettify } from './content.js';
import { SCREENS, SHEETS } from './router.js';

const app = {
  engine: null,
  engineName: '',
  state: null,
  slot: 'auto',
  settings: storage.loadSettings(),
  ui: freshUi(),
  root: null,
};

function freshUi() {
  return { screen: 'title', sheet: null, sheetArg: null, tab: 'market', summary: null, pendingEvents: [], haggle: null, lastCustomerId: null, confirm: null, invTab: null, sel: null };
}

export function getApp() { return app; }

const ERRORS = {
  no_space: 'No free slot there.', no_creds: 'Not enough creds.', insufficient_creds: 'Not enough creds.', audit_pending: 'Deal with the inspector first.',
  illegal_action: 'You can’t do that right now.', wrong_phase: 'Not right now.', no_customer: 'Nobody at the counter.',
};
function errorText(code) { return ERRORS[code] || prettify(code); }

// ---------- legal actions helpers ----------
function legalList(type) {
  if (!app.state) return [];
  try { return app.engine.legalActions(app.state).filter((a) => !type || a.type === type); } catch (e) { console.error(e); return []; }
}
function legal(type, params) {
  return legalList(type).some((a) => !params || Object.entries(params).every(([k, v]) => a[k] === undefined || a[k] === v));
}

// ---------- dispatch ----------
export function dispatch(action) {
  if (!app.state) return null;
  let res;
  try {
    res = app.engine.step(app.state, action);
  } catch (e) {
    console.error('engine.step threw', action, e);
    toast('Engine error: ' + (e?.message || e), 'bad');
    return null;
  }
  if (!res) return null;
  if (res.error) {
    toast(errorText(res.error), 'bad');
    sfx('buzz');
    render();
    return res;
  }
  const prev = app.state;
  app.state = res.state;
  playEvents(res.events || [], prev, action);
  scheduleAutosave();
  render();
  return res;
}

// ---------- events → feedback ----------
const REP_NAMES = { vantage: 'Vantage', lantern: 'Lanterns', static: 'The Static', sump: 'Sump Folk' };
function playEvents(events, prev, action) {
  const reps = {};
  let heat = 0;
  let textShown = 0;
  const say = (t, k) => { if (t && textShown < 4) { toast(t, k); textShown++; } };
  for (const e of events) {
    switch (e.type) {
      case 'SALE': sfx('cash'); haptic(15); if (e.price) floatNum('+' + fmt.creds(e.price)); break;
      case 'PURCHASE': sfx('spend'); if (e.price) floatNum('−' + fmt.creds(e.price), 'var(--amber)'); break;
      case 'HAGGLE_COUNTER': sfx('counter'); bump('.portrait-frame'); break;
      case 'HAGGLE_ACCEPT': sfx('good'); break;
      case 'HAGGLE_WALK': sfx('walk'); say(e.text || 'They’ve had enough. Gone.', 'warn'); continue;
      case 'CUSTOMER_LEFT': if (!e.text && e.reason !== 'deal' && e.reason !== 'walk') sfx('walk'); break;
      case 'CUSTOMER_ARRIVED': sfx('door'); break;
      case 'CHIT_BOUNCED': sfx('buzz'); say(e.text || `A ghost chit bounced overnight: ${fmt.creds(e.amount || 0)} gone.`, 'bad'); continue;
      case 'BREAK_IN': sfx('alarm'); haptic(80); say(e.text || `Break-in! ${(e.stolen || []).length} item(s) stolen.`, 'bad'); continue;
      case 'AUDIT': sfx('alarm'); break;
      case 'LEASE_PAID': sfx('spend'); say(e.text || `LEASEHOLD: Lease paid (${fmt.creds(e.amount || 0)}). Thank you! :)`, 'good'); continue;
      case 'LEASE_MISSED': sfx('buzz'); say(e.text || 'Lease MISSED. Grace week active with late fee.', 'bad'); continue;
      case 'EVENT_STARTED': say(e.text || `Event: ${nameOf('events', e.id)}`, 'mag'); continue;
      case 'SPOILED': say(e.text || `${(e.uids || e.itemIds || []).length} item(s) spoiled.`, 'warn'); continue;
      case 'REP_CHANGED': reps[e.faction] = (reps[e.faction] || 0) + (e.delta || 0); break;
      case 'HEAT_CHANGED': heat += e.delta || 0; break;
      case 'DAY_SUMMARY': app.ui.summary = { ...e, events: events.filter((x) => x !== e) }; sfx('sleep'); continue;
      case 'ENDING': break;
      default: break;
    }
    if (e.text) say(e.text, e.kind || '');
  }
  const repTxt = Object.entries(reps).filter(([, d]) => d).map(([f, d]) => `${REP_NAMES[f] || f} ${d > 0 ? '+' : ''}${d}`);
  if (repTxt.length && !app.ui.summary) toast('Rep: ' + repTxt.join(' · '), 'cyan', 2000);
  if (Math.abs(heat) >= 3 && !app.ui.summary) toast(`Heat ${heat > 0 ? '+' : ''}${heat}`, heat > 0 ? 'mag' : 'good', 1800);
  app.ui.lastEvents = events;
}

function bump(sel) {
  requestAnimationFrame(() => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  });
}

// ---------- persistence ----------
let saveTimer = 0;
function scheduleAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 350);
}
export function saveNow(slot = 'auto') {
  clearTimeout(saveTimer);
  if (!app.state) return false;
  try {
    const str = app.engine.serialize(app.state);
    storage.save(slot, str, { shopName: app.state.shopName, day: app.state.day, creds: app.state.creds });
    return true;
  } catch (e) { console.error('save failed', e); return false; }
}
export function loadSlot(slot) {
  const str = storage.load(slot);
  if (!str) { toast('Empty slot.', 'bad'); return false; }
  let st = null;
  try { st = app.engine.deserialize(str); } catch (e) { console.error(e); }
  if (!st) { toast('That save is unreadable.', 'bad'); return false; }
  app.state = st;
  app.ui = freshUi();
  app.ui.screen = 'game';
  render();
  return true;
}
export function startNewGame(opts) {
  try {
    app.state = app.engine.newGame(opts);
  } catch (e) {
    console.error(e); toast('Could not start: ' + (e?.message || e), 'bad'); return;
  }
  app.ui = freshUi();
  app.ui.screen = 'game';
  saveNow();
  render();
}
export function quitToTitle() {
  saveNow();
  app.state = null;
  app.ui = freshUi();
  render();
}

// ---------- settings ----------
export function applySettings() {
  const s = app.settings;
  const osReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reduced = s.reducedMotion === 'on' || (s.reducedMotion === 'auto' && osReduced);
  document.documentElement.classList.toggle('rm', reduced);
  document.documentElement.classList.toggle('motion-on', s.reducedMotion === 'off');
  app.reduced = reduced;
  setSound(s.sound);
  setAmbience(s.music);
}
export function updateSettings(patch) {
  app.settings = { ...app.settings, ...patch };
  storage.saveSettings(app.settings);
  applySettings();
  render();
}

// ---------- navigation ----------
export function go(screen) { app.ui.screen = screen; app.ui.sheet = null; render(); }
export function openSheet(name, arg = null) { app.ui.sheet = name; app.ui.sheetArg = arg; sfx('tap'); render(); }
export function closeSheet() { app.ui.sheet = null; app.ui.sheetArg = null; render(); }
export function closeSummary() { app.ui.summary = null; render(); }

/** Confirm dialog (sheet). onYes runs on confirm. */
export function confirmBox(title, body, yesLabel, onYes, variant = 'primary') {
  app.ui.confirm = { title, body, yesLabel, onYes, variant };
  render();
}

function currentScreenName() {
  const ui = app.ui;
  if (!app.state) return ['title', 'newgame', 'settings'].includes(ui.screen) ? ui.screen : 'title';
  if (ui.screen === 'settings') return 'settings';
  if (app.state.phase === 'ended' && !ui.summary) return 'ending';
  if (ui.summary) return 'summary';
  if (app.state.phase === 'dawn') return 'dawn';
  if (app.state.phase === 'open') return 'counter';
  if (app.state.phase === 'night') return 'night';
  if (app.state.phase === 'ended') return 'ending';
  return 'title';
}

// ---------- rendering ----------
let lastScreen = '';
let renderQueued = false;
export function render() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => { renderQueued = false; renderNow(); });
}

function ctxFor() {
  return {
    state: app.state, ui: app.ui, settings: app.settings, engine: app.engine, sel: app.engine?.selectors,
    dispatch, legal, legalList, go, openSheet, closeSheet, render, confirmBox, saveNow, loadSlot, startNewGame, quitToTitle, updateSettings, closeSummary,
    reduced: app.reduced, app,
  };
}

function renderNow() {
  const { top, main, bar, overlayHost } = app.root;
  const name = currentScreenName();
  const ctx = ctxFor();
  const keepScroll = name === lastScreen ? main.scrollTop : 0;
  clear(top); clear(main); clear(bar);
  main.className = 'screen';
  if (app.state && !['ending', 'settings'].includes(name)) renderTopbar(top, ctx);
  top.classList.toggle('hidden', !top.firstChild);
  const screen = SCREENS[name];
  try {
    screen?.render(main, { ...ctx, bar, top });
  } catch (e) {
    console.error('render failed', name, e);
    main.appendChild(h('div.card.danger', h('h3', 'Render error'), h('pre.tiny', { style: { whiteSpace: 'pre-wrap' } }, String(e?.stack || e))));
  }
  main.dataset.screen = name;
  document.body.dataset.screen = name;
  if (name === lastScreen) main.scrollTop = keepScroll;
  lastScreen = name;

  // ambience
  const rainy = ['counter', 'title', 'dawn'].includes(name);
  setRain(rainy, app.reduced);
  if (name === 'counter') startRain(); else stopRain();

  // sheet overlay
  clear(overlayHost);
  if (app.ui.sheet && SHEETS[app.ui.sheet]) {
    const sheetDef = SHEETS[app.ui.sheet];
    const body = h('div.sheet-body');
    const foot = h('div.sheet-foot');
    const ov = h('div.overlay', { onclick: (e) => { if (e.target === ov) closeSheet(); } },
      h('div.sheet', { 'data-screen': sheetDef.screen || null, 'data-sheet': app.ui.sheet, role: 'dialog', 'aria-modal': 'true', 'aria-label': sheetDef.title },
        h('div.sheet-head', h('h2', typeof sheetDef.title === 'function' ? sheetDef.title(ctx) : sheetDef.title),
          h('button.icon-btn', { type: 'button', 'aria-label': 'Close', onclick: closeSheet, html: uiIcon('close') })),
        body, foot));
    try { sheetDef.render(body, { ...ctx, foot }); } catch (e) { console.error(e); body.textContent = String(e); }
    if (!foot.firstChild) foot.remove();
    overlayHost.appendChild(ov);
  }
  if (app.ui.confirm) {
    const c = app.ui.confirm;
    const done = (yes) => { app.ui.confirm = null; if (yes) c.onYes?.(); render(); };
    overlayHost.appendChild(h('div.overlay', { style: { justifyContent: 'center', padding: '16px' } },
      h('div.card.glow-mag', { role: 'alertdialog', 'aria-label': c.title, style: { margin: '0' } },
        h('h3', c.title), h('p', c.body),
        h('div.btn-row', h('button.btn.btn-ghost', { type: 'button', onclick: () => done(false) }, 'Cancel'),
          h('button.btn', { type: 'button', class: 'btn-' + c.variant, onclick: () => done(true) }, c.yesLabel)))));
  }
}

function renderTopbar(top, ctx) {
  const s = app.state, sel = ctx.sel;
  let dl = null;
  try { dl = sel.daysUntilLease(s); } catch { dl = null; }
  const overdue = s.lease?.overdue > 0 || s.lease?.graceActive;
  const phaseName = { dawn: 'Dawn', open: 'Open', night: 'Night', ended: 'End' }[s.phase] || s.phase;
  top.append(
    h('div.stat', h('small', 'Day ' + s.day), h('b', { style: { color: 'var(--cyan)' } }, phaseName)),
    h('div.stat.creds', { class: s.creds < 0 ? 'neg' : '' }, h('small', 'Creds'), h('b', fmt.creds(s.creds))),
    h('div.stat.heat', h('small', 'Heat'), h('b', String(Math.round(s.heat)))),
    h('div.stat.lease', h('small', overdue ? 'OVERDUE' : 'Lease'), h('b', { style: overdue ? { color: 'var(--red)' } : null }, dl == null ? '—' : dl <= 0 ? 'today' : dl + 'd')),
    h('div.spacer'),
    h('button.icon-btn', { type: 'button', 'aria-label': 'Stock', onclick: () => openSheet('stock'), html: uiIcon('box') }),
    h('button.icon-btn', { type: 'button', 'aria-label': 'Ledger', onclick: () => openSheet('ledger'), html: uiIcon('ledger') }),
    h('button.icon-btn', { type: 'button', 'aria-label': 'Settings', onclick: () => go('settings'), html: uiIcon('gear') }),
  );
}

// ---------- boot ----------
export function mount(rootEl, engine, engineName) {
  app.engine = engine;
  app.engineName = engineName;
  clear(rootEl);
  const fx = h('div.fx-layer', { 'aria-hidden': 'true' });
  const top = h('header.topbar');
  const main = h('main.screen', { id: 'screen' });
  const bar = h('footer.actionbar');
  const overlayHost = h('div#overlays');
  const toasts = h('div.toasts', { 'aria-live': 'polite' });
  rootEl.append(fx, top, main, bar);
  document.body.append(overlayHost, toasts);
  mountToasts(toasts);
  mountRain(fx);
  app.root = { top, main, bar, overlayHost };
  applySettings();
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', applySettings);

  const unlock = () => { unlockAudio(); };
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('touchend', unlock, { passive: true });
  // block double-tap zoom & pinch on iOS
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch < 300 && !(e.target.closest && e.target.closest('input,textarea'))) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  addEventListener('pagehide', () => saveNow());

  // debug / test hook (read-only view + dispatch)
  globalThis.__neonLedger = Object.freeze({
    getState: () => app.state,
    engineVersion: engine.ENGINE_VERSION,
    engineName,
  });
  globalThis.NeonLedger = {
    get state() { return app.state; }, get engine() { return engineName; }, dispatch, legalActions: () => legalList(),
    get screen() { return currentScreenName(); },
  };
  render();
}
