// Content integrity (ARCH §5) and originality scan (DESIGN §0).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { relative } from 'node:path';
import { ROOT, SRC, content, contentExport, walk, read, engine } from './_helpers.mjs';

const arr = (name, exp) => {
  const v = contentExport(name, exp);
  if (!v) return null;
  return Array.isArray(v) ? v : Object.values(v);
};
const SNAKE = /^[a-z0-9]+(_[a-z0-9]+)*$/;

// Forbidden terms: single source of truth is SQA's list (docs/QA/forbidden-terms.txt), so no term is
// duplicated in tests/ (AC-CON-109). Whole word/phrase, case-insensitive.
const TERMS = read(`${ROOT}/docs/QA/forbidden-terms.txt`).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FORBIDDEN_RE = new RegExp(`(?<![A-Za-z0-9])(${TERMS.map(esc).join('|')})(?![A-Za-z0-9])`, 'i');

describe('AC-CON-109 originality scan (DESIGN §0)', () => {
  const files = [...walk(SRC), ...walk(`${ROOT}/styles`), ...walk(`${ROOT}/tests`).filter((p) => !p.includes('/reports/') && !p.includes('__pycache__')), `${ROOT}/index.html`, `${ROOT}/manifest.webmanifest`, `${ROOT}/sw.js`]
    .filter((p) => /\.(js|mjs|html|css|json|webmanifest|md|svg|txt)$/.test(p));
  test('AC-CON-109 no forbidden names/terms in src/, styles/, tests/, index.html, manifest, sw.js', () => {
    const hits = [];
    for (const f of files) {
      let txt; try { txt = read(f); } catch { continue; }
      txt.split('\n').forEach((line, i) => {
        const m = line.match(FORBIDDEN_RE);
        if (m) hits.push(`${relative(ROOT, f)}:${i + 1}: "${m[0]}"`);
      });
    }
    assert.deepEqual(hits, []);
  });

  test('AC-PWA-106 no external network URLs in shipped files (offline rule)', () => {
    const hits = [];
    for (const f of files) {
      let txt; try { txt = read(f); } catch { continue; }
      txt.split('\n').forEach((line, i) => {
        if (/https?:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org\/)/.test(line) && !/^\s*(\/\/|\*)/.test(line)) hits.push(`${relative(ROOT, f)}:${i + 1}`);
      });
    }
    assert.deepEqual(hits, []);
  });
});

describe('AC-UI-120 UI never reads hidden truth (ARCH §3.2)', () => {
  test('no `.hidden.` / `hidden.reservation` / `flags.` truth reads in src/ui or src/main.js', () => {
    // src/ui/dev/ holds a dev-only mock engine, which legitimately owns hidden truth.
    const files = [...walk(`${SRC}/ui`), `${SRC}/main.js`].filter((p) => p.endsWith('.js') && !p.includes('/ui/dev/'));
    const hits = [];
    for (const f of files) {
      let txt; try { txt = read(f); } catch { continue; }
      txt.split('\n').forEach((line, i) => {
        if (/(customer|inspection|\bc|cust)\??\.hidden\b|\bhidden\??\.(reservation|ghostChit|undercover|verifier)|\['hidden'\]|\.flags\??\.(stolen|counterfeit|tracer|cut)\b/.test(line)) {
          hits.push(`${relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
        }
      });
    }
    assert.deepEqual(hits, []);
  });

  test('AC-ENG-102 AC-ENG-115 engine has no DOM / storage / Math.random / Date access', () => {
    const hits = [];
    for (const f of walk(`${SRC}/engine`).filter((p) => p.endsWith('.js'))) {
      read(f).split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        line = line.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
        if (/\b(document|window|localStorage|sessionStorage|navigator|Math\.random|Date\.now|new Date\()\b/.test(line)) hits.push(`${relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    assert.deepEqual(hits, []);
  });
});

describe('content integrity', () => {
  const ITEMS = arr('items', 'ITEMS');
  const BRANDS = arr('brands', 'BRANDS');
  const MACHINES = arr('machines', 'MACHINES');
  const RECIPES = arr('recipes', 'RECIPES');
  const PERMITS = arr('permits', 'PERMITS');
  const LICENCES = arr('licences', 'LICENCES');
  const BACKGROUNDS = arr('backgrounds', 'BACKGROUNDS');
  const NPCS = arr('npcs', 'NPCS');
  const ENDINGS = arr('endings', 'ENDINGS');

  test('AC-CON-101 every content module that exists exports frozen data', () => {
    for (const [name, mod] of Object.entries(content)) {
      if (!mod) continue;
      const exps = Object.entries(mod).filter(([, v]) => v && typeof v === 'object');
      assert.ok(exps.length > 0, `${name}.js exports no data`);
      for (const [k, v] of exps) assert.ok(Object.isFrozen(v), `${name}.${k} not frozen`);
    }
  });

  test('AC-CON-102 ids unique and snake_case within each collection', () => {
    for (const [name, list] of Object.entries({ ITEMS, BRANDS, MACHINES, RECIPES, PERMITS, LICENCES, BACKGROUNDS, NPCS, ENDINGS,
      UPGRADES: arr('upgrades', 'UPGRADES'), PERKS: arr('perks', 'PERKS'), JOBS: arr('jobs', 'JOBS'), EVENTS: arr('events', 'EVENTS') })) {
      if (!list) continue;
      const ids = list.map((x) => x.id);
      assert.equal(new Set(ids).size, ids.length, `${name}: duplicate ids ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
      for (const id of ids) assert.match(id, SNAKE, `${name}: id ${id}`);
    }
  });

  test('AC-CON-104 AC-CON-201 items schema', { skip: !ITEMS && 'items.js missing' }, () => {
    const cats = ['power', 'food', 'salvage', 'sundry', 'chrome', 'shard', 'luxury', 'tech', 'stolen_goods'];
    assert.ok(ITEMS.length >= 50 && ITEMS.length <= 80, `item count ${ITEMS.length} (target 50–70)`);
    for (const it of ITEMS) {
      assert.ok(it.name && typeof it.name === 'string', `${it.id} name`);
      assert.ok(cats.includes(it.category), `${it.id} category ${it.category}`);
      assert.ok(Number.isInteger(it.basePrice) && it.basePrice > 0, `${it.id} basePrice`);
      assert.ok(['legal', 'permit', 'contraband'].includes(it.legality), `${it.id} legality`);
      if (it.legality === 'permit') assert.ok(it.permit, `${it.id} needs permit id`);
      assert.equal(it.size, 1);
      if (it.perishableDays !== undefined) assert.ok(Number.isInteger(it.perishableDays) && it.perishableDays > 0);
      assert.ok(Array.isArray(it.tags), `${it.id} tags`);
      assert.ok(typeof it.flavor === 'string' && it.flavor.length > 0, `${it.id} flavor`);
      if (it.marks) assert.equal(it.marks.length, 3, `${it.id} marks`);
    }
    for (const c of ['power', 'food', 'salvage', 'sundry', 'chrome', 'shard', 'luxury', 'stolen_goods']) {
      assert.ok(ITEMS.some((i) => i.category === c), `no items in category ${c}`);
    }
    assert.ok(ITEMS.some((i) => i.legality === 'contraband'), 'need contraband items');
    assert.ok(ITEMS.filter((i) => i.legality === 'contraband').reduce((a, b) => a + b.basePrice, 0) > 0);
  });

  test('AC-CON-202 brands: 3 genuine marks, ≥2 fake marks that differ', { skip: !BRANDS && 'brands.js missing' }, () => {
    for (const b of BRANDS) {
      assert.equal(b.marks.length, 3, `${b.id} marks`);
      assert.ok(Array.isArray(b.fakeMarks) && b.fakeMarks.length >= 2, `${b.id} fakeMarks`);
      for (const f of b.fakeMarks.flat()) assert.ok(!b.marks.includes(f), `${b.id}: fake mark "${f}" equals a genuine one`);
    }
  });

  test('AC-CON-103 cross-references resolve', { skip: !ITEMS && 'items.js missing' }, () => {
    const itemIds = new Set(ITEMS.map((i) => i.id));
    const bad = [];
    if (BRANDS) { const bids = new Set(BRANDS.map((b) => b.id)); for (const i of ITEMS) if (i.brand && !bids.has(i.brand)) bad.push(`item ${i.id} brand ${i.brand}`); }
    if (PERMITS) { const pids = new Set(PERMITS.map((p) => p.id)); for (const i of ITEMS) if (i.permit && !pids.has(i.permit)) bad.push(`item ${i.id} permit ${i.permit}`); }
    for (const i of ITEMS) {
      if (i.blank && !itemIds.has(i.blank)) bad.push(`item ${i.id} blank ${i.blank}`);
      if (i.knockoffOf && !itemIds.has(i.knockoffOf)) bad.push(`item ${i.id} knockoffOf ${i.knockoffOf}`);
    }
    const machineIds = MACHINES ? new Set(MACHINES.map((m) => m.id)) : null;
    if (BACKGROUNDS) for (const b of BACKGROUNDS) {
      for (const si of b.startInventory ?? []) if (!itemIds.has(si.itemId)) bad.push(`background ${b.id} item ${si.itemId}`);
      if (machineIds) for (const m of b.machines ?? []) if (!machineIds.has(m)) bad.push(`background ${b.id} machine ${m}`);
    }
    if (RECIPES) for (const r of RECIPES) {
      const cats = new Set(ITEMS.map((i) => i.category));
      const tags = new Set(ITEMS.flatMap((i) => i.tags ?? []));
      for (const inp of r.inputs ?? []) {
        if (inp.itemId && !itemIds.has(inp.itemId)) bad.push(`recipe ${r.id} input ${inp.itemId}`);
        if (inp.category && !cats.has(inp.category)) bad.push(`recipe ${r.id} input category ${inp.category}`);
        if (inp.tag && !tags.has(inp.tag)) bad.push(`recipe ${r.id} input tag ${inp.tag}`);
        for (const x of inp.exclude ?? []) if (!itemIds.has(x)) bad.push(`recipe ${r.id} exclude ${x}`);
        if (!(inp.itemId || inp.category || inp.tag)) bad.push(`recipe ${r.id} input with no selector`);
      }
      for (const o of [...(r.outputs ?? []), ...(r.outcomes ?? [])]) if (!itemIds.has(o.itemId)) bad.push(`recipe ${r.id} output ${o.itemId}`);
      if (machineIds && !machineIds.has(r.machineId)) bad.push(`recipe ${r.id} machine ${r.machineId}`);
    }
    if (NPCS) for (const n of NPCS) if (!['vantage', 'lantern', 'static', 'sump', 'spire', 'none'].includes(n.faction)) bad.push(`npc ${n.id} faction ${n.faction}`);
    assert.deepEqual(bad, []);
  });

  test('AC-CON-105 AC-ENG-105 backgrounds match DESIGN §10 / R8', { skip: !BACKGROUNDS && 'backgrounds.js missing' }, () => {
    const ids = BACKGROUNDS.map((b) => b.id).sort();
    assert.deepEqual(ids, ['fence', 'line_cook', 'nobody', 'shard_diver', 'sparky', 'tinker']);
  });

  test('AC-CON-105 difficulties match R8', { skip: !content.difficulties && 'difficulties.js missing' }, () => {
    const d = arr('difficulties', 'DIFFICULTIES');
    assert.deepEqual(d.map((x) => x.id).sort(), ['acid', 'downpour', 'drizzle']);
  });

  test('AC-CON-205 endings cover all DESIGN §13 outcomes', { skip: !ENDINGS && 'endings.js missing' }, () => {
    const txt = JSON.stringify(ENDINGS).toLowerCase();
    for (const t of ['franchise of the spire', 'made in the sump', 'free node', 'heart of the stairwell', 'own name on the door', 'evicted', 'arrested', 'taken for a ride', 'underwater']) {
      assert.ok(txt.includes(t), `endings missing "${t}"`);
    }
  });

  test('engine content adapter loads real content, not fallback, for each present file', { skip: !engine && 'engine missing' }, async () => {
    const adapter = await import('../../src/engine/content.js').catch(() => null);
    if (!adapter?.SOURCES) return;
    const bad = [];
    for (const [key, src] of Object.entries(adapter.SOURCES)) {
      const file = key.toLowerCase();
      if (content[file] && !/content/.test(String(src))) bad.push(`${key}: ${src}`);
    }
    assert.deepEqual(bad, [], 'content file present but engine is using fallback');
  });

  test('AC-CON-106 dialogue pools: required keys, ≥3 lines, ≤120 chars, known placeholders', { skip: !content.dialogue && 'dialogue.js missing' }, () => {
    const D = contentExport('dialogue', 'DIALOGUE');
    for (const k of ['buyer_greet', 'seller_greet', 'haggle_counter', 'haggle_walk', 'deal_done', 'refuse', 'report', 'undercover_greet', 'ghost_nervous']) {
      assert.ok(Array.isArray(D[k]) && D[k].length >= 3, `dialogue pool ${k} missing or < 3 lines`);
    }
    const bad = [];
    for (const [k, pool] of Object.entries(D)) {
      if (!Array.isArray(pool)) continue;
      for (const l of pool) {
        const t = typeof l === 'string' ? l : l.text;
        if (typeof t !== 'string' || !t) { bad.push(`${k}: empty line`); continue; }
        if (t.length > 120) bad.push(`${k}: ${t.length} chars`);
        for (const ph of t.match(/\{[^}]*\}/g) ?? []) if (!['{item}', '{price}', '{name}', '{shop}', '{ward}', '{faction}', '{day}', '{amount}', '{category}', '{days}', '{fine}'].includes(ph)) bad.push(`${k}: placeholder ${ph}`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test('AC-CON-107 names: parts per customer faction and ≥6 wards', { skip: !content.names && 'names.js missing' }, () => {
    const m = content.names;
    const txt = JSON.stringify(m);
    for (const f of ['vantage', 'lantern', 'static', 'sump', 'spire']) assert.ok(txt.includes(`"${f}"`), `names for faction ${f}`);
    const wards = m.WARDS ?? m.HOME_WARDS ?? Object.values(m).find((v) => Array.isArray(v) && v.length && (v[0].id || typeof v[0] === 'string') && /ward/i.test(JSON.stringify(v).slice(0, 200)));
    assert.ok(Array.isArray(wards) && wards.length >= 6, 'ward list ≥ 6');
  });

  test('AC-CON-203 NPCs include all recurring characters with ≥5 lines', { skip: !NPCS && 'npcs.js missing' }, () => {
    const txt = JSON.stringify(NPCS).toLowerCase();
    for (const n of ['halloran', 'rook', '0xwren', 'ostra', 'tamsin', 'auction', 'leasehold']) assert.ok(txt.includes(n), `npc ${n}`);
    for (const n of NPCS) {
      if (n.id === 'leasehold') continue; // LEASEHOLD's texts live in feed.js (AC-CON-108)
      const lines = Object.values(n.lines ?? {}).flat().length;
      assert.ok(lines >= 5, `${n.id} has ${lines} lines`);
      assert.ok(n.role && n.portraitTraits, `${n.id} role/portraitTraits`);
    }
  });

  test('AC-CON-204 events: nine calendar events with valid fields', { skip: !content.events && 'events.js missing' }, () => {
    const E = arr('events', 'EVENTS');
    const txt = JSON.stringify(E).toLowerCase();
    for (const n of ['blackout', 'flood', 'gala', 'crackdown', 'recall', 'leak', 'turf', 'adjustment', 'sunday']) assert.ok(txt.includes(n), `event ${n}`);
    for (const e of E) {
      assert.ok(Array.isArray(e.durationDays) && e.durationDays.length === 2 && e.durationDays[0] <= e.durationDays[1], `${e.id} durationDays`);
      assert.ok(e.weight > 0, `${e.id} weight`);
      assert.ok(Number.isInteger(e.minDay), `${e.id} minDay`);
      assert.ok(e.effects && typeof e.effects === 'object', `${e.id} effects`);
      for (const k of ['forecast', 'start', 'end']) assert.ok(typeof e.feedText?.[k] === 'string' && e.feedText[k], `${e.id} feedText.${k}`);
    }
  });

  test('AC-CON-205 collection sizes', () => {
    const MAC = MACHINES, PERKS = arr('perks', 'PERKS'), JOBS = arr('jobs', 'JOBS');
    if (MAC) assert.ok(MAC.length >= 9, `machines ${MAC.length}`);
    if (PERKS) assert.ok(PERKS.length >= 8 && PERKS.length <= 14, `perks ${PERKS.length}`);
    if (JOBS) assert.ok(JOBS.length >= 4, `jobs ${JOBS.length}`);
    if (PERMITS) assert.ok(PERMITS.length >= 2, `permits ${PERMITS.length}`);
    if (LICENCES) assert.ok(LICENCES.length >= 2, `licences ${LICENCES.length}`);
    if (RECIPES && MAC) {
      for (const m of MAC.filter((x) => /charger|cooker|printer|scanner|bench/.test(x.id))) {
        assert.ok(RECIPES.some((r) => r.machineId === m.id), `no recipe for machine ${m.id}`);
      }
    }
  });

  test('AC-CON-108 feed: LEASEHOLD lines ≥ 8 and news lines', { skip: !content.feed && 'feed.js missing' }, () => {
    const F = content.feed;
    const txt = JSON.stringify(F);
    const lease = Object.entries(F).find(([k]) => /lease/i.test(k))?.[1];
    const flat = (v) => (Array.isArray(v) ? v : Object.values(v ?? {})).flat(3);
    assert.ok(lease && flat(lease).length >= 8, 'LEASEHOLD lines ≥ 8');
    assert.ok(/news|ticker/i.test(Object.keys(F).join(' ') + txt.slice(0, 2000)), 'news ticker lines');
  });
});
