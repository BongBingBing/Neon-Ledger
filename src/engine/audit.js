// Audits (DESIGN §7.3, ARCHITECTURE §6 R2/R3).
import { ITEM } from './content.js';
import { BAL } from './balance.js';
import { rand } from './rng.js';
import { clamp, spend, int } from './util.js';
import { illegalTrue } from './items.js';
import { perkAdd, perkMult } from './modifiers.js';
import { changeRep, changeHeat } from './rep.js';
import { endGame } from './endings.js';

export function auditChecksStash(st) { return st.heat >= BAL.heat.stashCheckHeat; }

export function computeAudit(st) {
  const found = st.inventory.filter((i) => (i.location === 'shelf' || i.location === 'storage') && illegalTrue(st, i));
  const checksStash = auditChecksStash(st);
  if (checksStash) {
    const stash = st.inventory.filter((i) => i.location === 'stash');
    const idx = (st.flags.auditStashIdx || 0) % Math.max(1, st.capacity.stash || 1);
    const it = stash[idx];
    if (it && illegalTrue(st, it)) found.push(it);
  }
  const value = found.reduce((s, i) => s + (ITEM[i.itemId] ? ITEM[i.itemId].basePrice : 0), 0);
  const fine = Math.round(BAL.audit.fineMult * value);
  const v = st.rep.vantage || 0;
  let bribeCost = Math.round(BAL.audit.bribeShare * fine * (1 - v / 200));
  let bribeChance = clamp(BAL.audit.bribeBase + v / 200, 0.05, 0.95);
  // perks (Greased Palm) on top of the base formula
  bribeCost = Math.round(bribeCost * perkMult(st, 'bribeCostMult'));
  bribeChance = clamp(bribeChance + perkAdd(st, 'bribeChanceBonus'), 0.05, 0.95);
  return { found: found.map((i) => ({ ...i, flags: { ...i.flags }, known: { ...i.known } })), value, fine, bribeCost, bribeChance: Math.round(bribeChance * 1000) / 1000, checksStash };
}

export function respondAudit(st, choice, out) {
  const a = computeAudit(st);
  const uids = new Set(a.found.map((i) => i.uid));
  let outcome = 'clean';
  let fine = 0;
  let bribe = 0;
  let confiscate = false;
  if (a.found.length === 0) {
    outcome = 'clean';
    changeRep(st, 'vantage', 1, out);
  } else if (choice === 'bribe') {
    bribe = a.bribeCost;
    spend(st, bribe, 'Bribe to Inspector Halloran');
    if (rand(st) < a.bribeChance) {
      outcome = 'bribed';
    } else {
      outcome = 'bribe_failed';
      fine = a.fine * 2;
      confiscate = true;
      changeRep(st, 'vantage', -10, out);
    }
  } else {
    outcome = 'complied';
    fine = a.fine;
    confiscate = true;
  }
  const confiscated = [];
  if (confiscate) {
    for (const it of st.inventory) if (uids.has(it.uid)) confiscated.push({ uid: it.uid, itemId: it.itemId });
    st.inventory = st.inventory.filter((i) => !uids.has(i.uid));
    if (fine > 0) spend(st, fine, `Audit fine (${confiscated.length} item${confiscated.length === 1 ? '' : 's'} confiscated)`);
  }
  st.audit = null;
  st.auditPending = false;
  const before = st.heat;
  st.heat = BAL.heat.afterAudit;
  if (st.heat !== before) out.push({ type: 'HEAT_CHANGED', delta: st.heat - before, heat: st.heat });
  const textMap = {
    clean: 'Halloran finds nothing. He almost looks disappointed.',
    complied: `Halloran confiscates ${confiscated.length} item(s). Fine: ${fine}¢.`,
    bribed: `The bribe works. Halloran "misses" everything. Cost: ${bribe}¢.`,
    bribe_failed: `Halloran pockets the bribe and doubles the fine: ${fine}¢.`,
  };
  out.push({ type: 'AUDIT', outcome, confiscated, fine, bribe, text: textMap[outcome] });
  if (confiscate && a.value > BAL.audit.arrestValue && st.creds < 0) {
    endGame(st, 'arrested', out);
    return;
  }
  st.stats.auditsSurvived += 1;
  void int;
}
