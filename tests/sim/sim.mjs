// Neon Ledger balance simulator. Drives the engine ONLY via newGame + legalActions + step.
// Usage: ./tools/node tests/sim/sim.mjs [--seeds 20] [--days 120] [--policies a,b] [--bgs a,b] [--diffs a,b] [--workers N] [--out N]
// Writes tests/reports/balance-<n>.md (n = --out or next free number) and prints a summary.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BGS = ['tinker', 'shard_diver', 'sparky', 'line_cook', 'fence', 'nobody'];
const DIFFS = ['drizzle', 'acid', 'downpour'];
const CHECKPOINTS = [7, 14, 21, 30, 45, 60, 90, 120, 150];

async function runGame(engine, createBot, { policy, background, difficulty, seed, maxDays }) {
  let s = engine.newGame({ seed, background, difficulty, shopName: 'Sim' });
  const bot = createBot(policy, engine, seed);
  const startCreds = s.creds;
  const out = { engineVersion: engine.ENGINE_VERSION, policy, background, difficulty, seed, startCreds, credsByDay: {}, actions: {}, actionCreds: {}, salesByCat: {}, legalFail: [], botReject: 0, steps: 0, stuck: false, endDay: null, ending: null, win: false, heatMax: 0, audits: 0, breakIns: 0, bounced: 0, leaseMissed: 0 };
  let lastEvents = [];
  let stepsToday = 0, curDay = s.day;
  while (s.phase !== 'ended' && s.day <= maxDays) {
    if (s.day !== curDay) { out.credsByDay[curDay] = s.creds; curDay = s.day; stepsToday = 0; }
    const L = engine.legalActions(s);
    if (!L.length) { out.stuck = 'no legal actions'; break; }
    let a = stepsToday > 600 ? null : bot.choose(s, L, lastEvents);
    if (!a) a = progress(L);
    if (!a) { out.stuck = 'no progress action'; break; }
    let r = engine.step(s, a);
    if (r.error) {
      const listed = L.some((d) => d.type === a.type && Object.entries(d).every(([k, v]) => ['label', 'disabled', 'reason'].includes(k) || JSON.stringify(a[k]) === JSON.stringify(v)) && Object.keys(a).every((k) => k in d));
      if (listed && out.legalFail.length < 5) out.legalFail.push(`${s.phase} d${s.day} ${JSON.stringify(a)} -> ${r.error}`);
      out.botReject++;
      const p = progress(L, a.type);
      if (!p) { out.stuck = `error ${r.error}`; break; }
      a = p;
      r = engine.step(s, a);
      if (r.error) { out.stuck = `progress ${a.type} failed: ${r.error}`; break; }
    }
    out.steps++; stepsToday++;
    out.actions[a.type] = (out.actions[a.type] ?? 0) + 1;
    out.actionCreds[a.type] = (out.actionCreds[a.type] ?? 0) + (r.state.creds - s.creds);
    for (const e of r.events) {
      if (e.type === 'SALE') {
        const inv = s.inventory.find((i) => i.uid === e.uid);
        const cat = inv ? (engine.selectors.itemDef(inv.itemId)?.category ?? '?') : '?';
        out.salesByCat[cat] = (out.salesByCat[cat] ?? 0) + (e.price ?? 0);
      }
      if (e.type === 'AUDIT') out.audits++;
      if (e.type === 'BREAK_IN') out.breakIns++;
      if (e.type === 'CHIT_BOUNCED') out.bounced++;
      if (e.type === 'LEASE_MISSED') out.leaseMissed++;
    }
    out.heatMax = Math.max(out.heatMax, r.state.heat);
    lastEvents = r.events;
    s = r.state;
    if (out.steps > maxDays * 800) { out.stuck = 'step budget'; break; }
  }
  out.credsByDay[s.day] = s.creds;
  out.endDay = s.day;
  if (s.phase === 'ended') { out.ending = s.ending?.id ?? '?'; out.win = !!s.ending?.win; }
  else out.ending = out.stuck ? 'STUCK' : 'alive';
  out.finalCreds = s.creds;
  out.netWorth = engine.selectors.netWorth(s);
  return out;
}

function progress(L, avoid) {
  for (const t of ['AUDIT_RESPOND', 'ACCEPT_CHIT', 'REFUSE', 'NEXT_CUSTOMER', 'OPEN_SHOP', 'CLOSE_SHOP', 'SKIP_DUES', 'SLEEP', 'CONTINUE_ENDLESS']) {
    if (t === avoid) continue;
    const d = L.find((x) => x.type === t);
    if (d) { const { label, disabled, reason, ...a } = d; if (t === 'AUDIT_RESPOND' && !a.choice) a.choice = 'comply'; return a; }
  }
  const d = L.find((x) => x.type !== avoid && x.type !== 'MOVE_ITEM');
  if (!d) return null;
  const { label, disabled, reason, ...a } = d;
  if (a.type === 'SPECIAL_CHOICE' || a.type === 'CHOOSE_PERK') return a;
  return null;
}

// ---------- worker ----------
if (!isMainThread) {
  const engine = await import(pathToFileURL(join(ROOT, process.env.NL_ENGINE ?? 'src/engine/index.js')).href);
  const { createBot } = await import(pathToFileURL(join(HERE, 'bots.mjs')).href);
  parentPort.on('message', async (job) => {
    if (job === null) { process.exit(0); }
    try { parentPort.postMessage({ ok: true, res: await runGame(engine, createBot, job) }); }
    catch (e) { parentPort.postMessage({ ok: false, job, err: String(e?.stack ?? e).slice(0, 600) }); }
  });
}

// ---------- main ----------
function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1]?.startsWith('--') || a[i + 1] === undefined ? true : a[++i];
  return o;
}
const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const median = (arr) => pct(arr, 0.5);
const fmt = (x) => (x === null || x === undefined ? '—' : typeof x === 'number' ? (Number.isInteger(x) ? String(x) : x.toFixed(1)) : String(x));
const pc = (x) => `${(100 * x).toFixed(0)}%`;

function summarize(runs) {
  const wins = runs.filter((r) => r.win);
  const endings = {};
  for (const r of runs) endings[r.ending] = (endings[r.ending] ?? 0) + 1;
  return { n: runs.length, winRate: wins.length / runs.length, medianWinDay: median(wins.map((r) => r.endDay)), p25WinDay: pct(wins.map((r) => r.endDay), 0.25), p75WinDay: pct(wins.map((r) => r.endDay), 0.75), endings,
    lossBefore60: runs.filter((r) => !r.win && r.ending !== 'alive' && r.ending !== 'STUCK' && r.endDay < 60).length / runs.length,
    stuck: runs.filter((r) => r.ending === 'STUCK').length };
}

function credsAt(runs, day) {
  // creds at the start of `day`; runs that ended earlier use their final value
  return runs.map((r) => r.credsByDay[day] ?? (r.endDay < day ? r.finalCreds : undefined)).filter((x) => x !== undefined);
}

if (isMainThread) {
  const o = args();
  const seeds = Number(o.seeds ?? 20), maxDays = Number(o.days ?? 120);
  const policies = (o.policies ?? 'cautious_legal,greedy_smuggler,random,balanced_haggler').split(',');
  const bgs = (o.bgs ?? BGS.join(',')).split(','), diffs = (o.diffs ?? DIFFS.join(',')).split(',');
  const nW = Math.max(1, Math.min(Number(o.workers ?? cpus().length - 1), 15));
  const jobs = [];
  for (const policy of policies) for (const background of bgs) for (const difficulty of diffs) for (let k = 0; k < seeds; k++) {
    jobs.push({ policy, background, difficulty, seed: 10007 * (k + 1) + bgs.indexOf(background) * 101 + diffs.indexOf(difficulty) * 7, maxDays });
  }
  const t0 = Date.now();
  const results = [], errors = [];
  await new Promise((resolve) => {
    let next = 0, done = 0;
    const workers = Array.from({ length: Math.min(nW, jobs.length) }, () => new Worker(fileURLToPath(import.meta.url)));
    for (const w of workers) {
      const feed = () => { if (next < jobs.length) w.postMessage(jobs[next++]); else w.postMessage(null); };
      w.on('message', (m) => {
        if (m.ok) results.push(m.res); else errors.push(m);
        done++;
        if (done % 50 === 0) process.stderr.write(`  ${done}/${jobs.length} runs (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
        if (done === jobs.length) resolve();
        feed();
      });
      w.on('error', (e) => { errors.push({ err: String(e) }); done++; if (done === jobs.length) resolve(); });
      feed();
    }
  });
  const secs = (Date.now() - t0) / 1000;

  // ----- report -----
  const L = [];
  const by = (pred) => results.filter(pred);
  L.push(`# Balance report`, '', `Generated by \`tests/sim/sim.mjs\` — ${results.length} runs (${seeds} seeds × ${bgs.length} backgrounds × ${diffs.length} difficulties × ${policies.length} policies), max ${maxDays} days, ${secs.toFixed(0)} s. Engine ${results[0]?.engineVersion ?? '?'}.`, '');
  L.push('Bots see only public state (no `hidden`, no item `flags`), act only via `legalActions` + `step`. Policies: ' +
    '**cautious_legal** (never illegal, pays dues, checks chits), **greedy_smuggler** (reckless: anything goes, skips dues, accepts all chits, bribes), ' +
    '**random** (uniform legal actions), **balanced_haggler** ("decent player": haggles hard, checks chits, pays dues, light fencing stashed at audits).', '');
  if (errors.length) L.push(`**${errors.length} runs crashed** (exceptions). First: \`${(errors[0].err ?? '').split('\n')[0]}\``, '');

  L.push('## Outcome by policy × difficulty', '', '| policy | diff | n | win% | median win day (p25–p75) | loss<60d | top endings |', '|---|---|---|---|---|---|---|');
  for (const p of policies) for (const d of diffs) {
    const s = summarize(by((r) => r.policy === p && r.difficulty === d));
    const top = Object.entries(s.endings).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(', ');
    L.push(`| ${p} | ${d} | ${s.n} | ${pc(s.winRate)} | ${fmt(s.medianWinDay)} (${fmt(s.p25WinDay)}–${fmt(s.p75WinDay)}) | ${pc(s.lossBefore60)} | ${top} |`);
  }
  L.push('', '## Decent bot (balanced_haggler) by background', '', '| background | diff | win% | median win day | endings |', '|---|---|---|---|---|');
  for (const b of bgs) for (const d of diffs) {
    const s = summarize(by((r) => r.policy === 'balanced_haggler' && r.background === b && r.difficulty === d));
    if (!s.n) continue;
    L.push(`| ${b} | ${d} | ${pc(s.winRate)} | ${fmt(s.medianWinDay)} | ${Object.entries(s.endings).map(([k, v]) => `${k} ${v}`).join(', ')} |`);
  }
  L.push('', '## Creds curve (acid): p10 / p50 / p90 at start of day', '', `| policy | ${CHECKPOINTS.filter((c) => c <= maxDays).map((c) => `d${c}`).join(' | ')} |`, `|---|${CHECKPOINTS.filter((c) => c <= maxDays).map(() => '---').join('|')}|`);
  for (const p of policies) {
    const rs = by((r) => r.policy === p && r.difficulty === 'acid');
    L.push(`| ${p} | ${CHECKPOINTS.filter((c) => c <= maxDays).map((c) => { const v = credsAt(rs, c); return v.length ? `${pct(v, 0.1)} / ${pct(v, 0.5)} / ${pct(v, 0.9)}` : '—'; }).join(' | ')} |`);
  }
  L.push('', '## Action dominance (all difficulties)', '', 'Share of steps and net creds attributed to each action type (Δcreds of the step itself; SLEEP carries overnight costs).', '');
  for (const p of policies) {
    const rs = by((r) => r.policy === p);
    const cnt = {}, cr = {};
    for (const r of rs) { for (const [k, v] of Object.entries(r.actions)) cnt[k] = (cnt[k] ?? 0) + v; for (const [k, v] of Object.entries(r.actionCreds)) cr[k] = (cr[k] ?? 0) + v; }
    const tot = Object.values(cnt).reduce((a, b) => a + b, 0) || 1;
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${pc(v / tot)} (${Math.round((cr[k] ?? 0) / Math.max(1, rs.length))}¢/run)`).join(', ');
    L.push(`- **${p}**: ${top}`);
  }
  L.push('', '## Sales revenue by item category (balanced_haggler, acid, per run-day)', '');
  {
    const rs = by((r) => r.policy === 'balanced_haggler' && r.difficulty === 'acid');
    const tot = {}; let days = 0;
    for (const r of rs) { days += r.endDay; for (const [k, v] of Object.entries(r.salesByCat)) tot[k] = (tot[k] ?? 0) + v; }
    const rows = Object.entries(tot).sort((a, b) => b[1] - a[1]);
    L.push(rows.length ? rows.map(([k, v]) => `- ${k}: ${(v / Math.max(1, days)).toFixed(1)}¢/day`).join('\n') : '- (no sales recorded)');
  }
  // ----- targets & flags -----
  const flags = [];
  const S = (p, d, b) => summarize(by((r) => r.policy === p && (!d || r.difficulty === d) && (!b || r.background === b)));
  const dec = S('balanced_haggler', 'acid');
  const reck = S('greedy_smuggler', 'acid');
  const legal = S('cautious_legal', 'acid');
  const rnd = S('random');
  const tgt = [];
  tgt.push(`- AC-BAL-301 decent bot (acid) median win day ${fmt(dec.medianWinDay)} — target 45–70: **${dec.medianWinDay !== null && dec.medianWinDay >= 45 && dec.medianWinDay <= 70 ? 'PASS' : 'FAIL'}** (win rate ${pc(dec.winRate)})`);
  const reckLose = by((r) => r.policy === 'greedy_smuggler' && r.difficulty === 'acid' && !r.win && /evict|arrest|ride/i.test(r.ending) && r.endDay < 60).length / Math.max(1, reck.n);
  tgt.push(`- AC-BAL-302 reckless bot (acid) evicted/arrested/ridden before day 60: ${pc(reckLose)} — target ≥70%: **${reckLose >= 0.7 ? 'PASS' : 'FAIL'}**`);
  tgt.push(`- AC-BAL-303 all-legal bot (acid) win rate by day ${maxDays}: ${pc(legal.winRate)} (target ≥30% by day 150), median win day ${fmt(legal.medianWinDay)} vs decent ${fmt(dec.medianWinDay)}: **${legal.winRate >= 0.3 && (legal.medianWinDay ?? 1e9) > (dec.medianWinDay ?? 0) ? 'PASS' : 'FAIL'}**`);
  const bgRates = bgs.map((b) => [b, S('balanced_haggler', 'acid', b).winRate]);
  const bgOk = bgRates.every(([b, w]) => w >= (b === 'nobody' ? 0.2 : 0.4));
  tgt.push(`- AC-BAL-304 per-background decent win rate (acid): ${bgRates.map(([b, w]) => `${b} ${pc(w)}`).join(', ')} — **${bgOk ? 'PASS' : 'FAIL'}**`);
  const md = diffs.map((d) => S('balanced_haggler', d).medianWinDay);
  const ordered = md.every((x) => x !== null) && md[0] < md[1] && md[1] < md[2];
  tgt.push(`- AC-BAL-305 difficulty ordering (median win day ${diffs.map((d, i) => `${d} ${fmt(md[i])}`).join(' < ')}): **${ordered ? 'PASS' : 'FAIL'}**`);
  for (const p of policies) {
    const s = S(p);
    if (s.medianWinDay !== null && s.medianWinDay < 30) flags.push(`**${p}** wins too fast (median day ${s.medianWinDay}) — possible degenerate strategy.`);
  }
  if (rnd.winRate > 0.05) flags.push(`**random** bot wins ${pc(rnd.winRate)} of games — the game may be too easy / an action is overpowered.`);
  if (reck.winRate > dec.winRate) flags.push(`**greedy_smuggler** out-wins the decent bot on acid (${pc(reck.winRate)} vs ${pc(dec.winRate)}) — crime pays too well / enforcement too weak.`);
  if (legal.winRate > dec.winRate + 0.1 && dec.n) flags.push('cautious_legal beats balanced_haggler — grey trades are not worth their risk.');
  const legalFails = results.flatMap((r) => r.legalFail);
  if (legalFails.length) flags.push(`${legalFails.length} actions listed by legalActions failed when stepped (first: \`${legalFails[0]}\`).`);
  const stuck = results.filter((r) => r.ending === 'STUCK');
  if (stuck.length) flags.push(`${stuck.length} runs got stuck (first: ${stuck[0].policy}/${stuck[0].background}/${stuck[0].difficulty}/${stuck[0].seed}: ${stuck[0].stuck}).`);
  const rej = results.reduce((a, r) => a + r.botReject, 0);
  L.push('', '## Targets (DESIGN §15 M3 / acceptance AC-BAL-30x)', '', ...tgt, '', '## Flags', '', ...(flags.length ? flags.map((f) => `- ${f}`) : ['- none']), '',
    `Bot actions rejected by engine (not listed / invalid params, bot fell back): ${rej} over ${results.reduce((a, r) => a + r.steps, 0)} steps.`, '');

  mkdirSync(join(ROOT, 'tests/reports'), { recursive: true });
  let n = o.out ? Number(o.out) : 1;
  if (!o.out) while (existsSync(join(ROOT, `tests/reports/balance-${n}.md`))) n++;
  const path = join(ROOT, `tests/reports/balance-${n}.md`);
  writeFileSync(path, L.join('\n'));
  if (o.json) writeFileSync(join(ROOT, `tests/reports/balance-${n}.json`), JSON.stringify(results));
  console.log([...tgt, ...flags.map((f) => `FLAG ${f}`)].join('\n'));
  console.log(`report: ${path} (${secs.toFixed(0)}s, ${errors.length} crashed runs)`);
  if (errors.length) console.log(errors.slice(0, 3).map((e) => `${JSON.stringify(e.job)}\n${e.err}`).join('\n---\n'));
}
