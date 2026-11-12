// Ambient rain on a canvas behind the UI. Stops entirely when reduced motion is on.
let raf = 0;
let canvas = null;
let drops = [];
let active = false;

export function mountRain(layer) {
  canvas = layer.querySelector('canvas') || layer.appendChild(document.createElement('canvas'));
}

export function setRain(on, reduced) {
  const want = !!on && !reduced && !!canvas;
  if (want === active) return;
  active = want;
  if (!want) {
    cancelAnimationFrame(raf); raf = 0;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  resize();
  loop();
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const w = canvas.clientWidth || 390, h = canvas.clientHeight || 844;
  canvas.width = Math.round(w * dpr / 2); canvas.height = Math.round(h * dpr / 2); // half-res for chunky look + perf
  const n = Math.round((w * h) / 9000);
  drops = Array.from({ length: n }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, v: 3 + Math.random() * 4, l: 4 + Math.random() * 8 }));
}
globalThis.addEventListener?.('resize', () => { if (active) resize(); });
document.addEventListener?.('visibilitychange', () => {
  if (!active) return;
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) loop();
});

function loop() {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(140,200,255,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const d of drops) {
    ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * 0.15, d.y + d.l);
    d.y += d.v; d.x -= d.v * 0.15;
    if (d.y > H) { d.y = -d.l; d.x = Math.random() * (W + 20); }
  }
  ctx.stroke();
  raf = requestAnimationFrame(loop);
}
