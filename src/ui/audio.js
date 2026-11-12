// WebAudio synth sfx. Silent until the first user gesture (iOS requirement).
let ac = null;
let master = null;
let enabled = true;
let ambienceOn = true;
let rainNode = null;

export function setSound(on) { enabled = !!on; if (master) master.gain.value = enabled ? 0.5 : 0; if (!enabled) stopRain(); }
export function setAmbience(on) { ambienceOn = !!on; if (!on) stopRain(); }

export function unlockAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = enabled ? 0.5 : 0;
    master.connect(ac.destination);
    // iOS: play a silent buffer inside the gesture to unlock
    const b = ac.createBuffer(1, 1, 22050);
    const s = ac.createBufferSource(); s.buffer = b; s.connect(master); s.start(0);
  } catch { ac = null; }
}

function tone(freq, dur, { type = 'square', vol = 0.18, at = 0, slide = 0 } = {}) {
  if (!ac || !enabled) return;
  try {
    const t = ac.currentTime + at;
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* ignore */ }
}

const SFX = {
  tap: () => tone(660, 0.05, { vol: 0.06 }),
  blip: () => tone(880, 0.07, { vol: 0.1 }),
  cash: () => { tone(1318, 0.08, { vol: 0.14 }); tone(1760, 0.18, { vol: 0.14, at: 0.07 }); tone(2637, 0.12, { vol: 0.06, at: 0.12, type: 'triangle' }); },
  spend: () => { tone(520, 0.08, { vol: 0.1 }); tone(390, 0.12, { vol: 0.1, at: 0.06 }); },
  buzz: () => tone(110, 0.28, { type: 'sawtooth', vol: 0.16 }),
  door: () => { tone(1200, 0.06, { type: 'sine', vol: 0.1 }); tone(900, 0.15, { type: 'sine', vol: 0.08, at: 0.08 }); },
  counter: () => tone(480, 0.1, { type: 'triangle', vol: 0.12, slide: 120 }),
  walk: () => tone(300, 0.3, { type: 'triangle', vol: 0.12, slide: -180 }),
  alarm: () => { for (let i = 0; i < 3; i++) tone(740, 0.12, { type: 'square', vol: 0.12, at: i * 0.18 }); },
  good: () => { tone(660, 0.08, { vol: 0.1 }); tone(990, 0.14, { vol: 0.1, at: 0.08 }); },
  probe: () => tone(1500, 0.04, { type: 'sine', vol: 0.1 }),
  fault: () => tone(160, 0.18, { type: 'square', vol: 0.12 }),
  sleep: () => { tone(392, 0.4, { type: 'sine', vol: 0.1 }); tone(330, 0.5, { type: 'sine', vol: 0.08, at: 0.3 }); },
};

export function sfx(name) { try { SFX[name]?.(); } catch { /* ignore */ } }

export function startRain() {
  if (!ac || !enabled || !ambienceOn || rainNode) return;
  try {
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.002 ? 1 : 0.35);
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.6;
    const g = ac.createGain(); g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    rainNode = { src, g };
  } catch { rainNode = null; }
}
export function stopRain() {
  if (!rainNode) return;
  try { rainNode.src.stop(); } catch { /* ignore */ }
  rainNode = null;
}

export function haptic(ms = 10) {
  try { navigator.vibrate?.(ms); } catch { /* not supported on iOS Safari: degrade silently */ }
}
