// SLEEP resolution (DESIGN §3.4) → DAY_SUMMARY → next dawn (or an ending).
import { ITEM, MACHINE, PERMIT, LICENCE, FEED } from './content.js';
import { BAL } from './balance.js';
import { randInt, chance, shuffle, pick } from './rng.js';
import { spend, earn, logLine, addFeed, fill, clamp } from './util.js';
import { illegalTrue } from './items.js';
import { activeEffects, advanceCalendar } from './events.js';
import { diff, mult, perkMult, machineWorking } from './modifiers.js';
import { changeRep, changeHeat } from './rep.js';
import { breakInChance, autoCollect } from './night.js';
import { beginDay, recalc, pickText } from './state.js';
import { endGame } from './endings.js';
import { computeAudit } from './audit.js';

const nameOf = (id) => (ITEM[id] ? ITEM[id].name : id);

function loseItems(st, candidates, n) {
  const pickd = shuffle(st, candidates).slice(0, n);
  const set = new Set(pickd.map((i) => i.uid));
  st.inventory = st.inventory.filter((i) => !set.has(i.uid));
  return pickd.map((i) => ({ uid: i.uid, itemId: i.itemId }));
}

export function auditThreshold(st) {
  const fx = activeEffects(st);
  const d = diff(st);
  let t = d.auditThreshold ?? BAL.heat.auditThreshold;
  if (fx.auditThreshold !== null) t = Math.min(t, d.crackdownThreshold ?? fx.auditThreshold, fx.auditThreshold);
  if ((st.rep.vantage || 0) >= 40) t += 10;
  return t;
}

export function sleep(st, a, out, netWorth) {
  const fx = activeEffects(st);
  // 1. dues / break-in
  if (!st.duesPaidTonight) {
    st.duesSkipStreak += 1;
    changeRep(st, 'lantern', -1, out);
    const p = breakInChance(st, st.duesSkipStreak);
    if (chance(st, p)) {
      st.stats.breakIns += 1;
      const workshop = Object.keys(st.machines).filter((id) => st.machines[id].owned && !st.machines[id].broken && MACHINE[id] && MACHINE[id].kind !== 'passive');
      if (workshop.length && chance(st, 0.25)) {
        const id = pick(st, workshop);
        st.machines[id].broken = true;
        logLine(st, `Break-in: ${MACHINE[id].name} smashed`, 0);
        out.push({ type: 'BREAK_IN', stolen: [], machine: id, text: `Someone smashed your ${MACHINE[id].name} in the night.` });
      } else {
        const cands = st.inventory.filter((i) => i.location === 'shelf' || i.location === 'storage');
        const stolen = loseItems(st, cands, randInt(st, 1, 3));
        logLine(st, `Break-in: lost ${stolen.map((s) => nameOf(s.itemId)).join(', ') || 'nothing'}`, 0);
        out.push({ type: 'BREAK_IN', stolen, text: stolen.length ? `Break-in! Gone: ${stolen.map((s) => nameOf(s.itemId)).join(', ')}.` : 'Someone jimmied the shutter, but found nothing worth taking.' });
      }
    }
  }
  // 2. grid tap fire
  if (machineWorking(st, 'grid_tap')) {
    const e = MACHINE.grid_tap.effects || {};
    const p = (e.fireChance ?? BAL.fireChance) * perkMult(st, 'gridFireMult');
    if (chance(st, p)) {
      const fd = e.fireDestroys || { items: [1, 2], machineChance: 0.25 };
      const cands = st.inventory.filter((i) => i.location !== 'stash');
      const lost = loseItems(st, cands, randInt(st, fd.items[0], fd.items[1]));
      let machine = null;
      const owned = Object.keys(st.machines).filter((id) => st.machines[id].owned && !st.machines[id].broken);
      if (owned.length && chance(st, fd.machineChance || 0)) { machine = pick(st, owned); st.machines[machine].broken = true; }
      logLine(st, `Electrical fire: lost ${lost.length} item(s)${machine ? `, ${MACHINE[machine].name} damaged` : ''}`, 0);
      out.push({ type: 'FIRE', lost, machine, text: 'The grid tap sparks. A small fire. Smoke everywhere.' });
    }
  }
  // 3. brand raids (Gala)
  if (fx.brandRaids > 0 && chance(st, fx.brandRaids * mult(st, 'brandRaidMult'))) {
    const fakes = st.inventory.filter((i) => i.location === 'shelf' && i.flags.counterfeit);
    if (fakes.length) {
      const set = new Set(fakes.map((i) => i.uid));
      st.inventory = st.inventory.filter((i) => !set.has(i.uid));
      const fine = Math.round(1.5 * fakes.reduce((s, i) => s + ITEM[i.itemId].basePrice, 0));
      spend(st, fine, `Brand raid fine (${fakes.length} fakes seized)`);
      out.push({ type: 'BRAND_RAID', confiscated: fakes.map((i) => ({ uid: i.uid, itemId: i.itemId })), fine, text: `Brand enforcers raid the shelf. ${fakes.length} fake(s) seized, ${fine}¢ fine.` });
    }
  }
  // 4. machine power + breakdowns
  let power = 0;
  for (const [id, m] of Object.entries(st.machines)) {
    const def = MACHINE[id];
    if (!def || !m.owned || m.broken) continue;
    const ranTonight = m.job && m.job.startedDay === st.day;
    if (def.kind === 'passive' || ranTonight) {
      let p = def.powerPerNight || 0;
      if (id === 'cell_charger') p *= mult(st, 'chargePowerMult');
      power += p;
    }
    if (ranTonight && def.breakdownChance && chance(st, def.breakdownChance)) {
      m.broken = true;
      out.push({ type: 'MACHINE_BROKE', machineId: id, text: `${def.name} broke down. Repair it at night.` });
    }
  }
  if (power > 0) spend(st, Math.round(power), 'Power bill');
  // 5. ghost chits evaporate
  for (const c of st.pending.chits) {
    spend(st, c.amount, `Chit bounced (${c.name})`);
    out.push({ type: 'CHIT_BOUNCED', amount: c.amount, name: c.name, text: `${c.name}'s chit was a ghost. ${c.amount}¢ evaporated.` });
  }
  st.pending.chits = [];
  // 6. returns / poisoning / repayments
  const keepR = [];
  for (const r of st.pending.returns) {
    if (r.dueDay > st.day) { keepR.push(r); continue; }
    if (!chance(st, BAL.untestedReturnChance)) continue;
    let amt = r.price;
    const permitMult = st.permits.reduce((m, id) => m * ((PERMIT[id] && PERMIT[id].effects && PERMIT[id].effects.chromeRefundMult) || 1), 1);
    if (r.medical) amt = Math.round(amt * permitMult);
    if (r.faction === 'spire') {
      const fine = Math.round(amt * 1.5);
      spend(st, fine, `Lawsuit: faulty ${nameOf(r.itemId)}`);
      out.push({ type: 'REFUND', kind: 'lawsuit', amount: fine, itemId: r.itemId, text: `A Spire lawyer bills you ${fine}¢ for a faulty ${nameOf(r.itemId)}.` });
    } else {
      spend(st, amt, `Refund: faulty ${nameOf(r.itemId)}`);
      changeRep(st, r.faction in st.rep ? r.faction : 'sump', -4, out);
      out.push({ type: 'REFUND', kind: 'refund', amount: amt, itemId: r.itemId, text: `${r.name} brings back the ${nameOf(r.itemId)}. It glitched. Refund: ${amt}¢.` });
    }
  }
  st.pending.returns = keepR;
  for (const p of st.pending.poison) {
    spend(st, 60, 'Food safety fine');
    changeRep(st, 'sump', -8, out);
    out.push({ type: 'FOOD_POISONING', name: p.name, text: `${p.name} got sick from your stretched noodles. The stairwell is talking.` });
  }
  st.pending.poison = [];
  const keepP = [];
  for (const r of st.pending.repay) {
    if (r.dueDay > st.day) { keepP.push(r); continue; }
    earn(st, r.amount, `${r.name} paid you back`);
    out.push({ type: 'REPAID', amount: r.amount, name: r.name, text: `${r.name} slips ${r.amount}¢ under the shutter with a note: "thank you".` });
  }
  st.pending.repay = keepP;
  // 7. heat
  let gain = 0;
  gain += BAL.heat.illegalShelf * st.inventory.filter((i) => i.location === 'shelf' && illegalTrue(st, i)).length;
  gain += BAL.heat.tracerHeld * st.inventory.filter((i) => i.flags.tracer).length * fx.tracerMult * perkMult(st, 'tracerHeatMult');
  if (machineWorking(st, 'grid_tap')) gain += ((MACHINE.grid_tap.effects || {}).heatPerNight ?? BAL.heat.gridTap);
  if (gain > 0) changeHeat(st, gain, out);
  changeHeat(st, -BAL.heat.decay, out, { gain: false });
  // 8. lease (due day)
  let evicted = false;
  if (!st.lease.owned && st.day >= st.lease.nextDueDay) {
    const L = st.lease;
    const T = FEED.leasehold || {};
    if (L.graceActive) {
      const owe = L.overdue + (L.prepaid ? 0 : L.amount);
      if (st.creds >= owe) {
        spend(st, owe, 'Lease + overdue (LEASEHOLD)');
        L.graceActive = false; L.overdue = 0;
        out.push({ type: 'LEASE_PAID', amount: owe, text: pickText(st, T.paid) || 'Payment received :)' });
      } else {
        L.missedCount += 1;
        evicted = true;
        out.push({ type: 'LEASE_MISSED', amount: owe, final: true, text: pickText(st, T.evicted) || 'Your tenancy has ended :)' });
      }
    } else if (L.prepaid) {
      logLine(st, 'Lease (paid early)', 0);
    } else if (st.creds >= L.amount) {
      spend(st, L.amount, 'Lease (LEASEHOLD)');
      out.push({ type: 'LEASE_PAID', amount: L.amount, text: pickText(st, T.paid) || 'Payment received :)' });
    } else {
      L.graceActive = true;
      L.missedCount += 1;
      L.overdue = Math.round(L.amount * (1 + (diff(st).lateFee ?? 0.25)));
      logLine(st, `Lease missed: ${L.overdue}¢ now overdue`, 0);
      const text = fill(pickText(st, T.missed) || 'Payment missed. Overdue: {amount}¢ :(', { amount: L.overdue });
      addFeed(st, 'lease', text, 'LEASEHOLD');
      out.push({ type: 'LEASE_MISSED', amount: L.overdue, text });
    }
    if (!evicted) {
      L.amount = Math.round(L.amount * (diff(st).leaseGrowth || BAL.lease.growth));
      L.nextDueDay += BAL.lease.period;
      L.prepaid = false;
      // weekly permit / licence fees
      for (const id of st.permits) { const p = PERMIT[id]; if (p && p.weeklyFee) spend(st, p.weeklyFee, `Weekly fee: ${p.name}`); }
      for (const id of st.licences) { const l = LICENCE[id]; if (l && l.weeklyFee) spend(st, l.weeklyFee, `Weekly cut: ${l.name}`); }
      st.perkPoints += 1;
      out.push({ type: 'PERK_POINT', perkPoints: st.perkPoints, text: 'Another week survived. +1 perk point.' });
    }
  } else if (st.lease.owned && st.day % BAL.lease.period === 0) {
    st.perkPoints += 1;
  }
  // 9. audit check
  if (!st.auditPending && st.heat >= auditThreshold(st)) {
    st.auditPending = true;
    st.flags.auditStashIdx = randInt(st, 0, 5);
    out.push({ type: 'AUDIT_SCHEDULED', text: 'Word in the stairwell: Halloran is coming at dawn.' });
  }
  // 10. spoilage (R6)
  const spoiled = st.inventory.filter((i) => i.spoilsDay !== undefined && i.spoilsDay <= st.day);
  if (spoiled.length) {
    const set = new Set(spoiled.map((i) => i.uid));
    st.inventory = st.inventory.filter((i) => !set.has(i.uid));
    logLine(st, `Spoiled: ${spoiled.map((i) => nameOf(i.itemId)).join(', ')}`, 0);
    out.push({ type: 'SPOILED', uids: spoiled.map((i) => i.uid), itemIds: spoiled.map((i) => i.itemId), text: `${spoiled.length} item(s) spoiled.` });
  }
  // summary
  const summary = { type: 'DAY_SUMMARY', day: st.day, income: st.dayLog.income, expenses: st.dayLog.expenses, lines: st.dayLog.lines.map((l) => ({ ...l })) };
  out.push(summary);
  st.stats.history.push({ day: st.day, income: summary.income, expenses: summary.expenses, net: summary.income - summary.expenses, creds: st.creds, heat: st.heat, lines: summary.lines });
  if (st.stats.history.length > BAL.historyKeep) st.stats.history.splice(0, st.stats.history.length - BAL.historyKeep);
  for (const h of st.stats.history.slice(0, -7)) delete h.lines;
  // 11. endings
  if (evicted) return endGame(st, 'evicted', out, netWorth);
  st.flags.underwaterDays = st.creds < BAL.underwater.debt ? (st.flags.underwaterDays || 0) + 1 : 0;
  if (st.flags.underwaterDays >= BAL.underwater.days) return endGame(st, 'underwater', out, netWorth);
  if (st.rep.lantern <= BAL.takenForRide.lantern && st.duesSkipStreak >= BAL.takenForRide.skips) return endGame(st, 'taken_for_ride', out, netWorth);
  // 12. next day
  st.stats.daysSurvived = st.day;
  st.day += 1;
  advanceCalendar(st, out);
  beginDay(st, out);
  autoCollect(st, out);
  if (st.auditPending) st.audit = computeAudit(st);
  recalc(st);
  out.push({ type: 'DAWN', day: st.day });
  void clamp;
}
