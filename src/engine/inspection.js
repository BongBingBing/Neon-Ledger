// Inspection tools & mini-games (ARCHITECTURE §3.5, DESIGN §7.4).
//  look     — instant, counter only, seller's item: reveals true condition of non-chrome goods (costs 1 patience)
//  serial   — instant: is the serial on today's Hot List?
//  probe    — chrome mini-game (needs a working Repair Bench): 4x4 grid, N probes
//  appraise — branded goods mini-game: tap the wrong maker's mark (or -1 = "all genuine")
//  scan     — night: shortcut that queues a Shard Scanner job for the shard
import { ITEM, BRAND, RECIPES } from './content.js';
import { randInt, shuffle } from './rng.js';
import { clamp, nextUid } from './util.js';
import { add, machineWorking, flag } from './modifiers.js';
import { setMood } from './counter.js';
import { runMachine } from './night.js';

export const TOOLS = ['look', 'serial', 'probe', 'appraise', 'scan'];

// resolve target -> { item, atCounter }
export function resolveTarget(st, target) {
  if (target === 'customer') {
    const c = st.customer;
    if (!c) return null;
    if (c.kind === 'seller' && c.item) return { item: c.item, atCounter: true, customerItem: true };
    return null;
  }
  const item = st.inventory.find((i) => i.uid === target);
  return item ? { item, atCounter: false, customerItem: false } : null;
}

export function probeCount(st) { return 5 + add(st, 'probeBonus'); }
export function faultCount(condition) { return clamp(Math.round((100 - condition) / 15), 0, 6); }

// Why can't this tool be used on this target right now? Returns null if it can.
export function inspectBlocker(st, tool, target) {
  if (!TOOLS.includes(tool)) return 'bad_tool';
  if (st.inspection) return 'inspection_active';
  if (st.phase !== 'open' && st.phase !== 'night') return 'wrong_phase';
  const t = resolveTarget(st, target);
  if (!t) return 'bad_target';
  const { item } = t;
  const def = ITEM[item.itemId];
  if (!def) return 'bad_target';
  const c = st.customer;
  if (t.customerItem && (c.stage !== 'talk')) return 'wrong_stage';
  if (tool === 'look') {
    if (!t.customerItem) return 'bad_target';
    if (c.inspected.look) return 'already_inspected';
    return null;
  }
  if (tool === 'serial') {
    if (!item.serial) return 'no_serial';
    if (item.known.serialCheckedDay === st.day) return 'already_inspected';
    return null;
  }
  if (tool === 'probe') {
    if (def.category !== 'chrome') return 'bad_target';
    if (!machineWorking(st, 'repair_bench')) return 'tool_unavailable';
    if (item.known.conditionExact) return 'already_inspected';
    if (t.customerItem && c.inspected.probe) return 'already_inspected';
    return null;
  }
  if (tool === 'appraise') {
    if (!def.brand || !BRAND[def.brand] || !Array.isArray(item.marks)) return 'bad_target';
    if (item.known.counterfeit !== undefined) return 'already_inspected';
    if (t.customerItem && c.inspected.appraise) return 'already_inspected';
    if (!t.customerItem && item.known.appraisedDay === st.day) return 'already_inspected';
    return null;
  }
  if (tool === 'scan') {
    if (st.phase !== 'night' || t.customerItem) return 'wrong_phase';
    if (!def.tags.includes('unknown') || def.category !== 'shard') return 'bad_target';
    const r = RECIPES.find((x) => x.kind === 'scan');
    if (!r) return 'tool_unavailable';
    const m = st.machines[r.machineId];
    if (!m || !m.owned || m.broken) return 'tool_unavailable';
    if (m.job) return 'machine_busy';
    return null;
  }
  return 'bad_tool';
}

function chargePatience(st, c, out) {
  if (c.patience > 1) { c.patience -= 1; setMood(c); }
}

export function inspect(st, a, out) {
  const tool = a.tool; const target = a.target;
  const block = inspectBlocker(st, tool, target);
  if (block) return block;
  const t = resolveTarget(st, target);
  const { item } = t;
  const def = ITEM[item.itemId];
  const c = st.customer;
  if (tool === 'look') {
    c.inspected.look = true;
    chargePatience(st, c, out);
    if (def.category === 'chrome') {
      out.push({ type: 'INSPECT_RESULT', tool, target, conclusive: false, text: 'Looks like chrome. You would need to probe it to know more.' });
    } else {
      const claimed = item.known.condition;
      item.known.condition = item.condition;
      item.known.conditionExact = true;
      const worse = item.condition < (claimed ?? item.condition) - 5;
      out.push({ type: 'INSPECT_RESULT', tool, target, conclusive: true, condition: item.condition, claimed, text: worse ? `Closer look: it is in worse shape than they said (${item.condition}%).` : `Closer look: condition ${item.condition}%, about as described.` });
    }
    return;
  }
  if (tool === 'serial') {
    const hot = st.hotList.includes(item.serial);
    item.known.serialCheckedDay = st.day;
    item.known.hot = hot;
    if (hot) item.known.stolen = true;
    out.push({ type: 'INSPECT_RESULT', tool, target, hot, serial: item.serial, text: hot ? `${item.serial} is on today's Hot List.` : `${item.serial}: not on today's Hot List.` });
    return;
  }
  if (tool === 'scan') {
    const r = RECIPES.find((x) => x.kind === 'scan');
    return runMachine(st, { machineId: r.machineId, recipeId: r.id, inputUids: [item.uid] }, out);
  }
  if (t.customerItem) { c.inspected[tool] = true; chargePatience(st, c, out); }
  if (tool === 'probe') {
    const n = faultCount(item.condition);
    const cells = shuffle(st, Array.from({ length: 16 }, (_, i) => i)).slice(0, n).sort((x, y) => x - y);
    st.inspection = { id: nextUid(st, 'x'), tool, targetUid: t.customerItem ? 'customer' : item.uid, data: { size: 4 }, hidden: { faults: cells }, inputsLeft: probeCount(st), revealed: {} };
    out.push({ type: 'INSPECT_STARTED', tool, target, inputsLeft: st.inspection.inputsLeft });
    return;
  }
  if (tool === 'appraise') {
    const b = BRAND[def.brand];
    const hasRef = flag(st, 'referenceIndex');
    st.inspection = {
      id: nextUid(st, 'x'), tool, targetUid: t.customerItem ? 'customer' : item.uid,
      data: { brand: def.brand, brandName: b.name, marks: item.marks.slice(), reference: hasRef ? b.marks.slice(0, 3) : null },
      hidden: { fakeSlot: item.flags.counterfeit ? (item.flags.fakeSlot ?? 0) : -1 }, inputsLeft: 1, revealed: {},
    };
    out.push({ type: 'INSPECT_STARTED', tool, target, inputsLeft: 1 });
  }
}

function inspectionItem(st) {
  const ins = st.inspection;
  if (!ins) return null;
  if (ins.targetUid === 'customer') return st.customer && st.customer.item ? st.customer.item : null;
  return st.inventory.find((i) => i.uid === ins.targetUid) || null;
}

export function inspectInput(st, a, out) {
  const ins = st.inspection;
  if (!ins) return 'no_inspection';
  const input = a.input && typeof a.input === 'object' ? a.input : {};
  if (ins.inputsLeft <= 0) return 'no_inputs_left';
  if (ins.tool === 'probe') {
    const cell = Number(input.cell);
    if (!Number.isInteger(cell) || cell < 0 || cell > 15) return 'bad_input';
    if (ins.revealed[cell] !== undefined) return 'already_probed';
    const fault = ins.hidden.faults.includes(cell);
    ins.revealed[cell] = fault ? 'fault' : 'ok';
    ins.inputsLeft -= 1;
    out.push({ type: 'INSPECT_REVEAL', tool: 'probe', cell, result: ins.revealed[cell], inputsLeft: ins.inputsLeft });
    return;
  }
  if (ins.tool === 'appraise') {
    const mark = Number(input.mark);
    if (!Number.isInteger(mark) || mark < -1 || mark > 2) return 'bad_input';
    const correct = mark === ins.hidden.fakeSlot;
    ins.inputsLeft = 0;
    ins.revealed = { mark, correct };
    const item = inspectionItem(st);
    if (item) {
      if (correct) { item.known.counterfeit = !!item.flags.counterfeit; item.known.appraised = true; }
      else item.known.appraisedDay = st.day;
    }
    const fake = correct ? ins.hidden.fakeSlot >= 0 : undefined;
    const text = correct ? (fake ? 'You spot it: that mark is wrong. Counterfeit.' : 'Every mark checks out. Genuine.') : 'You are not sure. Something does not add up, but you cannot say what.';
    st.inspection = null;
    out.push({ type: 'INSPECT_RESULT', tool: 'appraise', target: ins.targetUid, correct, ...(correct ? { counterfeit: fake } : {}), text });
    return;
  }
  return 'bad_input';
}

export function inspectEnd(st, a, out) {
  const ins = st.inspection;
  if (!ins) return 'no_inspection';
  const item = inspectionItem(st);
  st.inspection = null;
  if (ins.tool === 'probe' && item) {
    const probed = Object.keys(ins.revealed).length;
    const found = Object.values(ins.revealed).filter((v) => v === 'fault').length;
    const total = ins.hidden.faults.length;
    if (probed === 0) { out.push({ type: 'INSPECT_RESULT', tool: 'probe', target: ins.targetUid, conclusive: false, text: 'You put the probe away without testing anything.' }); return; }
    const missing = total - found;
    if (missing === 0) {
      item.known.condition = item.condition;
      item.known.conditionExact = true;
    } else {
      // optimistic estimate: you only know about the faults you found
      item.known.condition = clamp(item.condition + missing * 15 - randInt(st, 0, 6), 0, 100);
      item.known.conditionExact = false;
    }
    item.known.untested = false;
    item.flags.untested = false;
    item.known.faultsFound = found;
    out.push({ type: 'INSPECT_RESULT', tool: 'probe', target: ins.targetUid, conclusive: missing === 0, faultsFound: found, condition: item.known.condition, text: found ? `Probe done: ${found} faulty node(s). Estimated condition ${item.known.condition}%.` : `Probe done: no faults found. Estimated condition ${item.known.condition}%.` });
    return;
  }
  out.push({ type: 'INSPECT_RESULT', tool: ins.tool, target: ins.targetUid, conclusive: false, text: 'You set it aside.' });
}
