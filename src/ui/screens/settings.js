import { h, btn, fmt } from '../dom.js';
import { listSlots, remove, isPersistent } from '../../platform/storage.js';
import { toast } from '../toast.js';

function toggle(label, on, onChange, desc) {
  return h('div.toggle',
    h('div', h('div', label), desc ? h('div.tiny.muted', desc) : null),
    h('button.switch', { type: 'button', role: 'switch', 'aria-checked': String(!!on), 'aria-label': label, onclick: () => onChange(!on) }));
}

export function render(root, ctx) {
  const s = ctx.settings;
  const inGame = !!ctx.state;
  const slots = listSlots();
  const slotMeta = (id) => slots.find((x) => x.slot === id);

  const back = () => ctx.go(inGame ? 'game' : 'title');
  const motionOpts = [['auto', 'Auto (system)'], ['on', 'Reduced'], ['off', 'Full']];

  root.append(h('div', { 'data-screen': 'settings' },
    h('div.row.between', { style: { marginBottom: '10px' } },
      btn('‹ Back', back, { variant: 'ghost', small: true, ui: 'back' }),
      h('h2', { style: { margin: 0, fontSize: '18px', letterSpacing: '.1em', color: 'var(--cyan)' } }, 'SETTINGS'),
      h('span', { style: { width: '60px' } })),
    h('div.card',
      toggle('Sound effects', s.sound, (v) => ctx.updateSettings({ sound: v }), 'Synth blips. Starts after your first tap.'),
      toggle('Rain ambience', s.music, (v) => ctx.updateSettings({ music: v })),
      toggle('Haptics', s.haptics, (v) => ctx.updateSettings({ haptics: v }), 'Where the device supports it.'),
      h('div.toggle', { style: { borderBottom: 0, flexWrap: 'wrap', gap: '8px' } },
        h('div', 'Motion'),
        h('div.btn-row', { style: { flex: '1 1 100%' } }, motionOpts.map(([id, label]) =>
          btn(label, () => ctx.updateSettings({ reducedMotion: id }), { small: true, variant: s.reducedMotion === id ? 'cyan' : '', ui: 'motion-' + id })))),
    ),
    h('div.section-title', 'Save slots'),
    !isPersistent() ? h('div.card.warn.small', 'Storage is unavailable (private browsing?). Saves last only until you close the app.') : null,
    h('div.card', h('div.stack', ['auto', '1', '2', '3'].map((id) => {
      const m = slotMeta(id);
      return h('div.slot',
        h('div', h('div', { style: { fontWeight: 700 } }, id === 'auto' ? 'Autosave' : 'Slot ' + id),
          h('div.tiny.muted', m ? `${m.shopName} · Day ${m.day} · ${fmt.creds(m.creds)} · ${new Date(m.savedAt).toLocaleString()}` : 'Empty')),
        h('div.move-btns',
          inGame && id !== 'auto' ? btn('Save', () => { if (ctx.saveNow(id)) { toast('Saved to slot ' + id, 'good'); ctx.render(); } }, { small: true, variant: 'good', ui: 'save-' + id }) : null,
          m ? btn('Load', () => ctx.confirmBox('Load save?', inGame ? 'Unsaved progress since the last autosave is lost.' : `Load ${m.shopName}, day ${m.day}.`, 'Load', () => ctx.loadSlot(id)), { small: true, ui: 'load-' + id }) : null,
          m ? btn('Delete', () => ctx.confirmBox('Delete save?', `${m.shopName}, day ${m.day}. This cannot be undone.`, 'Delete', () => { remove(id); toast('Deleted.', 'warn'); ctx.render(); }, 'danger'), { small: true, variant: 'danger', ui: 'delete-' + id }) : null));
    }))),
    inGame ? h('div.card', btn('Save & quit to title', () => ctx.quitToTitle(), { variant: 'warn', cls: 'btn-block', ui: 'quit' })) : null,
    h('div.tiny.muted', { style: { textAlign: 'center', marginTop: '12px' } },
      `Engine ${ctx.app.engine?.ENGINE_VERSION ?? '?'} (${ctx.app.engineName}) · Works offline once installed: Share → Add to Home Screen.`),
  ));
}
