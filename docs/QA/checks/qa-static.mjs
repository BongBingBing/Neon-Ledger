// Neon Ledger — SQA static checks. Owner: SQA. Read-only: never modifies product files.
// Usage (from repo root):  ./tools/node docs/QA/checks/qa-static.mjs [--json]
// Exit code: 1 if any ERROR-level check fails, else 0. WARN items need human triage.
// Rules referenced as S-<n> map to docs/QA/standards.md.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const out = []; // {level, rule, where, msg}
const add = (level, rule, where, msg) => out.push({ level, rule, where, msg });
const rel = (p) => relative(ROOT, p);

function walk(dir, exts) {
  const res = [];
  if (!existsSync(dir)) return res;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules' || name === '__pycache__') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) res.push(...walk(p, exts));
    else if (!exts || exts.includes(extname(name))) res.push(p);
  }
  return res;
}
const read = (p) => readFileSync(p, 'utf8');
// Strip // line comments and /* */ block comments (rough; keeps line numbers).
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, (m, p1) => p1);
}
// Blank out string-literal contents (single-line '...' "..." and `...` without ${}) so API checks ignore prose.
function stripStrings(src) {
  return src.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\$]|\\.)*`/g, (m) => m[0] + m.slice(1, -1).replace(/[^\n]/g, ' ') + m[0]);
}
function scan(files, re, level, rule, msg, { allow, raw, code } = {}) {
  for (const f of files) {
    let src = raw ? read(f) : stripComments(read(f));
    if (code) src = stripStrings(src);
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      if (re.test(line) && !(allow && allow.test(line))) add(level, rule, `${rel(f)}:${i + 1}`, `${msg} :: ${line.trim().slice(0, 140)}`);
    });
  }
}

const JS = ['.js', '.mjs'];
const engine = walk(join(ROOT, 'src/engine'), JS);
const content = walk(join(ROOT, 'src/content'), JS);
const uiAll = [...walk(join(ROOT, 'src/ui'), JS), ...(existsSync(join(ROOT, 'src/main.js')) ? [join(ROOT, 'src/main.js')] : [])];
// src/ui/dev/** = dev-only tooling (e.g. mock engine); excluded from UI rules but must never be imported by shipped code.
const uiDev = uiAll.filter((p) => p.includes('/src/ui/dev/'));
const ui = uiAll.filter((p) => !p.includes('/src/ui/dev/'));
const uiNonArt = ui.filter((p) => !p.includes('/src/ui/art/') && !p.endsWith('/audio.js'));
const platform = walk(join(ROOT, 'src/platform'), JS);
const allSrc = [...engine, ...content, ...uiAll, ...platform];

// ---- S-1 syntax: every JS module parses as an ES module
for (const f of allSrc) {
  const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: read(f), encoding: 'utf8' });
  if (r.status !== 0) add('ERROR', 'S-1 syntax', rel(f), (r.stderr || '').split('\n').find((l) => /Error/.test(l)) || 'parse failed');
}

// ---- S-2 engine purity (forbidden globals / nondeterminism)
const ENGINE_FORBIDDEN = [
  [/\bwindow\b/, 'window'], [/\bdocument\b/, 'document'], [/\b(localStorage|sessionStorage|indexedDB)\b/, 'web storage'],
  [/\bDate\.now\b|\bnew Date\b|\bDate\(\)/, 'wall clock'], [/\bMath\.random\b/, 'Math.random'],
  [/\bperformance\.now\b/, 'performance.now'], [/\b(setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\b/, 'timers'],
  [/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/, 'network'], [/\bnavigator\b/, 'navigator'],
  [/\bcrypto\.(getRandomValues|randomUUID)\b/, 'crypto randomness'], [/\bprocess\.|\brequire\s*\(/, 'node-only API'],
  [/\bglobalThis\b|\bself\./, 'global object'], [/\bAudioContext\b|\bHTMLElement\b|\bCanvas/, 'browser API'],
];
for (const [re, what] of ENGINE_FORBIDDEN) scan(engine, re, 'ERROR', 'S-2 engine purity', `forbidden in engine: ${what}`, { code: true });
scan(engine, /\bconsole\.(log|debug|info)\b/, 'WARN', 'S-2 engine noise', 'console logging in engine');
scan(engine, /\bthrow\b/, 'WARN', 'S-4 no-throw', 'throw in engine — must be unreachable from step()/legalActions/selectors or caught', { code: true });
scan(engine, /\.toFixed\(|parseFloat\(/, 'WARN', 'S-5 integer money', 'float formatting/parsing in engine');
scan(engine, /\bfor\s*\(\s*(const|let|var)\s+\w+\s+in\b/, 'WARN', 'S-3 determinism', 'for..in iteration order — prefer explicit key order');
scan(engine, /\.sort\(\s*\)/, 'WARN', 'S-3 determinism', 'sort() without comparator');
scan(engine, /from\s+['"][^'"]*\/(ui|platform)\//, 'ERROR', 'S-6 boundaries', 'engine imports UI/platform');

// ---- S-7 content purity
for (const [re, what] of ENGINE_FORBIDDEN) scan(content, re, 'ERROR', 'S-7 content purity', `forbidden in content: ${what}`, { code: true });
scan(content, /from\s+['"][^'"]*\/(engine|ui|platform)\//, 'ERROR', 'S-6 boundaries', 'content imports engine/UI/platform');

// ---- S-8 UI must not read hidden truth or mutate state
const UI_ALLOW = /document\.hidden|toggleAttribute\(\s*['"]hidden|setAttribute\(\s*['"]hidden|removeAttribute\(\s*['"]hidden|hasAttribute\(\s*['"]hidden|aria-hidden|overflow\s*[:=]|visibility|['"]hidden['"]\s*:\s*['"]/;
scan(ui, /\.hidden\b|\[\s*['"]hidden['"]\s*\]|\{[^}]*\bhidden\b[^}]*\}\s*=/, 'ERROR', 'S-8 hidden leak', 'UI touches `hidden` (use toggleAttribute for DOM; never read customer/inspection .hidden)', { allow: UI_ALLOW });
scan(ui, /\.flags\b|\[\s*['"]flags['"]\s*\]|\{[^}]*\bflags\b[^}]*\}\s*=/, 'ERROR', 'S-8 hidden leak', 'UI reads item `.flags` (must use `.known`)');
scan(ui, /\.rng\b|\.seed\b/, 'WARN', 'S-8 hidden leak', 'UI touches state rng/seed', { allow: /portrait\.seed|\bp\.seed|traits\.seed/ });
scan([...ui, join(ROOT, 'index.html'), join(ROOT, 'sw.js')].filter(existsSync), /ui\/dev\/|mockEngine/, 'WARN', 'S-6 dev code', 'shipped code references src/ui/dev — must be dev-flag-gated (never default)', { raw: true });
scan(ui, /\bstate\.[\w.[\]'"]+\s*(=(?!=)|\+=|-=|\+\+|--)|\bstate\.[\w.[\]'"]+\.(push|splice|pop|shift|unshift|sort|reverse)\(/, 'ERROR', 'S-8 state mutation', 'UI mutates GameState');
scan(ui, /from\s+['"][^'"]*\/engine\/(?!index\.js)[^'"]+['"]/, 'ERROR', 'S-6 boundaries', 'UI deep-imports engine internals (use src/engine/index.js)');
scan(uiNonArt, /\b(0\.25|1\.15|1\.25|1\.5|0\.05|350|30000)\b/, 'WARN', 'S-9 no rules in UI', 'magic balance number in UI — should come from selectors/content');
scan([...ui, ...engine, ...content], /\blocalStorage\b|\bsessionStorage\b/, 'ERROR', 'S-10 storage', 'web storage outside src/platform/storage.js');

// ---- S-10 storage adapter: every localStorage use inside a try block (heuristic: file has try and count)
for (const f of platform) {
  const s = stripComments(read(f));
  const uses = (s.match(/localStorage/g) || []).length;
  const tries = (s.match(/\btry\s*\{/g) || []).length;
  if (uses && !tries) add('ERROR', 'S-10 storage', rel(f), `localStorage used ${uses}x with no try/catch`);
}

// ---- S-11 offline: no external URLs in shipped files
const shipped = [
  ...allSrc,
  ...walk(join(ROOT, 'styles'), ['.css']),
  ...['index.html', 'sw.js', 'manifest.webmanifest'].map((f) => join(ROOT, f)).filter(existsSync),
];
scan(shipped, /https?:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org\/(2000\/svg|1999\/xlink))/, 'ERROR', 'S-11 offline', 'external URL in shipped file', { raw: true });
scan(shipped, /@import\s+url|fonts\.googleapis|cdn\./, 'ERROR', 'S-11 offline', 'external resource', { raw: true });

// ---- S-12 originality (hard + watch terms), whole-word, case-insensitive
const terms = (p) => read(join(ROOT, p)).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRe = (list) => new RegExp(`(?<![\\w-])(${list.map(esc).join('|')})(?![\\w-])`, 'i');
const origFiles = [
  ...shipped,
  ...walk(join(ROOT, 'icons'), ['.svg', '.json']),
  ...walk(join(ROOT, 'tests'), ['.js', '.mjs', '.py', '.json', '.md']),
  ...walk(join(ROOT, 'src/engine'), ['.md']),
];
scan(origFiles, termRe(terms('docs/QA/forbidden-terms.txt')), 'ERROR', 'S-12 originality', 'FORBIDDEN term', { raw: true });
scan(origFiles, termRe(terms('docs/QA/watch-terms.txt')), 'WARN', 'S-12 originality', 'watch term — check context', { raw: true });

// ---- S-13 PWA head / manifest
const idx = join(ROOT, 'index.html');
if (existsSync(idx)) {
  const h = read(idx);
  const need = [
    [/name=["']viewport["'][^>]*viewport-fit=cover/, 'viewport meta with viewport-fit=cover'],
    [/name=["']viewport["'][^>]*width=device-width/, 'viewport width=device-width'],
    [/apple-mobile-web-app-capable/, 'apple-mobile-web-app-capable'],
    [/apple-mobile-web-app-status-bar-style/, 'apple-mobile-web-app-status-bar-style'],
    [/apple-mobile-web-app-title/, 'apple-mobile-web-app-title'],
    [/rel=["']apple-touch-icon["']/, 'apple-touch-icon link'],
    [/rel=["']manifest["']/, 'manifest link'],
    [/name=["']theme-color["']/, 'theme-color meta'],
    [/type=["']module["']/, 'module script'],
  ];
  for (const [re, what] of need) if (!re.test(h)) add('ERROR', 'S-13 PWA', 'index.html', `missing ${what}`);
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?!\d)/.test(h)) add('WARN', 'S-14 a11y', 'index.html', 'viewport disables zoom — prefer touch-action: manipulation');
} else add('INFO', 'S-13 PWA', 'index.html', 'not present yet');
const man = join(ROOT, 'manifest.webmanifest');
if (existsSync(man)) {
  try {
    const m = JSON.parse(read(man));
    for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color', 'icons']) if (!(k in m)) add('ERROR', 'S-13 PWA', 'manifest.webmanifest', `missing ${k}`);
    if (m.display !== 'standalone') add('ERROR', 'S-13 PWA', 'manifest.webmanifest', `display=${m.display}`);
    if (m.orientation && m.orientation !== 'portrait') add('WARN', 'S-13 PWA', 'manifest.webmanifest', `orientation=${m.orientation}`);
    for (const ic of m.icons || []) if (!existsSync(join(ROOT, ic.src.replace(/^\.?\//, '')))) add('ERROR', 'S-13 PWA', 'manifest.webmanifest', `icon missing on disk: ${ic.src}`);
    const sizes = (m.icons || []).map((i) => i.sizes).join(' ');
    for (const s of ['192x192', '512x512']) if (!sizes.includes(s)) add('ERROR', 'S-13 PWA', 'manifest.webmanifest', `no ${s} icon`);
    if (!(m.icons || []).some((i) => /maskable/.test(i.purpose || ''))) add('WARN', 'S-13 PWA', 'manifest.webmanifest', 'no maskable icon');
  } catch (e) { add('ERROR', 'S-13 PWA', 'manifest.webmanifest', `invalid JSON: ${e.message}`); }
} else add('INFO', 'S-13 PWA', 'manifest.webmanifest', 'not present yet');
const sw = join(ROOT, 'sw.js');
if (existsSync(sw)) {
  const s = read(sw);
  if (!/caches\.open\(/.test(s)) add('ERROR', 'S-13 PWA', 'sw.js', 'no caches.open');
  if (!/(VERSION|version|v\d)/.test(s)) add('WARN', 'S-13 PWA', 'sw.js', 'no visible cache version');
  if (!/caches\.delete\(/.test(s)) add('ERROR', 'S-13 PWA', 'sw.js', 'old caches never deleted');
  // every shipped file should appear in the precache list (by basename heuristic)
  for (const f of shipped.filter((p) => !p.endsWith('sw.js'))) {
    const r = rel(f);
    if (!s.includes(r) && !s.includes('./' + r) && !s.includes('/' + r)) add('WARN', 'S-13 PWA', 'sw.js', `not precached? ${r}`);
  }
} else add('INFO', 'S-13 PWA', 'sw.js', 'not present yet');

// ---- S-15 size budget (shipped bytes)
const shipBytes = [...shipped, ...walk(join(ROOT, 'icons'))].filter((p) => !p.includes('/tests/')).reduce((a, p) => a + statSync(p).size, 0);
add(shipBytes > 1.5 * 1024 * 1024 ? 'ERROR' : 'INFO', 'S-15 size', '(shipped files)', `${(shipBytes / 1024).toFixed(1)} KB of 1536 KB budget`);

// ---- S-16 import smoke: engine + content modules import in Node with no DOM
for (const f of [...engine, ...content].filter((p) => /\.m?js$/.test(p))) {
  try { await import(pathToFileURL(f).href); } catch (e) { add('ERROR', 'S-16 import', rel(f), `import failed: ${e.message.split('\n')[0]}`); }
}
// content: every exported value frozen
for (const f of content) {
  try {
    const mod = await import(pathToFileURL(f).href);
    for (const [k, v] of Object.entries(mod)) if (v && typeof v === 'object' && !Object.isFrozen(v)) add('ERROR', 'S-7 content frozen', rel(f), `export ${k} not frozen`);
  } catch { /* reported above */ }
}

// ---- report
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else {
  const order = { ERROR: 0, WARN: 1, INFO: 2 };
  out.sort((a, b) => order[a.level] - order[b.level] || a.rule.localeCompare(b.rule));
  for (const o of out) console.log(`${o.level.padEnd(5)} [${o.rule}] ${o.where} — ${o.msg}`);
  const c = (l) => out.filter((o) => o.level === l).length;
  console.log(`\nfiles: engine ${engine.length}, content ${content.length}, ui ${ui.length}, platform ${platform.length}  |  ERROR ${c('ERROR')}  WARN ${c('WARN')}  INFO ${c('INFO')}`);
}
process.exit(out.some((o) => o.level === 'ERROR') ? 1 : 0);
