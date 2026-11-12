// Bot policies for the balance simulator. Bots see only what a player sees:
// GameState minus `customer.hidden`, `inspection.hidden` and item `flags` (they use `known`),
// plus selectors and item definitions. They act only through legalActions + step.

const round5 = (x) => Math.max(5, Math.round(x / 5) * 5);

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const POLICIES = {
  // Never touches illegal goods, pays dues, checks chits, moderate haggling.
  cautious_legal: { allowIllegal: false, payDues: true, chit: 'check', open: 1.35, concede: 0.5, buyMargin: 0.55, marketMargin: 0.8, stash: true, bribe: false, machines: 'legal', upgrades: true, nightJob: 'legal', refuseSuspicious: true },
  // Buys/sells anything, ignores heat and dues, accepts every chit, naive haggling.
  greedy_smuggler: { allowIllegal: true, payDues: false, chit: 'accept', open: 1.2, concede: 1, buyMargin: 0.9, marketMargin: 1.0, stash: false, bribe: true, machines: 'all', upgrades: false, nightJob: 'all', illegalOnShelf: true },
  // Uniformly random legal actions (sanity baseline).
  random: { random: true },
  // "Decent player": good haggler, checks chits, pays dues, light fencing kept off the shelf, stashes at audits.
  balanced_haggler: { allowIllegal: 'stash', payDues: true, chit: 'check', open: 1.6, concede: 0.5, buyMargin: 0.5, marketMargin: 0.8, stash: true, bribe: 'smart', machines: 'legal', upgrades: true, nightJob: 'legal', refuseSuspicious: false },
};

export function createBot(name, engine, seed) {
  const P = POLICIES[name];
  if (!P) throw new Error(`unknown policy ${name}`);
  const rnd = mulberry(seed ^ 0xb0b);
  const S = engine.selectors;
  const mem = { cid: null, lastOffer: 0, accepted: false, tried: new Set(), day: 0, phase: '', boughtTonight: 0, upgradesTonight: 0 };

  const def = (inv) => S.itemDef(inv.itemId) ?? { basePrice: 10, legality: 'legal' };
  const value = (inv) => Math.round(def(inv).basePrice * (0.45 + 0.55 * (inv.condition ?? 100) / 100));
  const knownIllegal = (s, inv) => {
    const d = def(inv);
    if (d.legality === 'contraband') return true;
    if (d.legality === 'permit' && !(s.permits ?? []).includes(d.permit)) return true;
    const k = inv.known ?? {};
    return !!(k.stolen || k.counterfeit || k.tracer);
  };
  const reserve = (s) => {
    const due = S.daysUntilLease(s);
    const lease = (s.lease.overdue ?? 0) + (due <= 3 ? S.leaseAmount(s) : Math.round(S.leaseAmount(s) * 0.5));
    return lease + 60;
  };
  const find = (L, type, pred = () => true) => L.find((a) => a.type === type && pred(a));
  const clean = (a) => { if (!a) return a; const { label, disabled, reason, ...r } = a; return r; };
  const once = (key) => { if (mem.tried.has(key)) return false; mem.tried.add(key); return true; };

  function chitTells(s, c) {
    const ch = c.chit; if (!ch) return 0;
    let t = 0;
    if (ch.name !== c.name) t++;
    if (ch.ward !== c.homeWard) t++;
    if (ch.sigilGlitch) t++;
    if (ch.expiryDay < s.day) t++;
    return t;
  }

  function randomChoice(s, L) {
    const a = clean(L[Math.floor(rnd() * L.length)]);
    if (a.type === 'OFFER' && typeof a.price !== 'number') a.price = round5((s.customer?.askPrice ?? 50) * (0.6 + rnd() * 0.9));
    if (a.type === 'BUY_STOCK' && typeof a.qty !== 'number') a.qty = 1;
    if (a.type === 'MOVE_ITEM' && !a.to) return clean(find(L, 'OPEN_SHOP') ?? find(L, 'SLEEP') ?? L[0]);
    return a;
  }

  function dawn(s, L) {
    if (find(L, 'CHOOSE_PERK')) return clean(find(L, 'CHOOSE_PERK'));
    if (s.audit) {
      if (P.stash) {
        for (const inv of s.inventory) {
          if (inv.location !== 'stash' && knownIllegal(s, inv) && S.freeSlots(s, 'stash') > 0 && once(`stash:${inv.uid}:${s.day}`)) {
            return { type: 'MOVE_ITEM', uid: inv.uid, to: 'stash' };
          }
        }
      }
      const a = s.audit;
      let choice = 'comply';
      if (P.bribe === true && a.fine > 0) choice = 'bribe';
      if (P.bribe === 'smart' && a.fine > 0) {
        // expected cost of bribing vs complying (confiscated value counts on both failure and comply)
        const conf = a.found.reduce((x, i) => x + value(i), 0);
        const eBribe = a.bribeCost + (1 - a.bribeChance) * (2 * a.fine + conf);
        if (eBribe < a.fine + conf && s.creds > a.bribeCost + 2 * a.fine) choice = 'bribe';
      }
      return { type: 'AUDIT_RESPOND', choice };
    }
    if (find(L, 'BUY_DEED')) return { type: 'BUY_DEED' };
    if (s.lease.overdue && find(L, 'PAY_LEASE') && s.creds >= s.lease.overdue + 30) return { type: 'PAY_LEASE' };
    const col = find(L, 'COLLECT_MACHINE'); if (col) return clean(col);
    // Shelf management.
    for (const inv of s.inventory) {
      if (inv.location === 'shelf' && knownIllegal(s, inv) && !P.illegalOnShelf && once(`off:${inv.uid}:${s.day}`)) {
        const to = S.freeSlots(s, 'stash') > 0 ? 'stash' : 'storage';
        if (S.freeSlots(s, to) > 0) return { type: 'MOVE_ITEM', uid: inv.uid, to };
      }
    }
    if (S.freeSlots(s, 'shelf') > 0) {
      const cands = s.inventory.filter((i) => i.location !== 'shelf' && (P.illegalOnShelf || !knownIllegal(s, i)) && !mem.tried.has(`on:${i.uid}:${s.day}`))
        .sort((a, b) => value(b) - value(a));
      if (cands.length) { mem.tried.add(`on:${cands[0].uid}:${s.day}`); return { type: 'MOVE_ITEM', uid: cands[0].uid, to: 'shelf' }; }
    }
    return { type: 'OPEN_SHOP' };
  }

  function counter(s, L, lastEvents) {
    const c = s.customer;
    if (!c) {
      if (find(L, 'NEXT_CUSTOMER')) return { type: 'NEXT_CUSTOMER' };
      return { type: 'CLOSE_SHOP' };
    }
    if (mem.cid !== c.id) { mem.cid = c.id; mem.lastOffer = 0; mem.accepted = false; }
    if (lastEvents.some((e) => e.type === 'HAGGLE_ACCEPT')) mem.accepted = true;
    if (find(L, 'ACCEPT_CHIT')) {
      if (P.chit === 'accept' || chitTells(s, c) === 0) return { type: 'ACCEPT_CHIT' };
      return { type: 'REJECT_CHIT' };
    }
    if (c.kind === 'special') {
      const opts = L.filter((a) => a.type === 'SPECIAL_CHOICE');
      if (opts.length) return clean(opts[Math.floor(rnd() * opts.length)]);
      return find(L, 'REFUSE') ? { type: 'REFUSE' } : { type: 'CLOSE_SHOP' };
    }
    if (mem.accepted && find(L, 'DEAL')) return { type: 'DEAL' };
    const counterEv = lastEvents.find((e) => e.type === 'HAGGLE_COUNTER');

    if (c.kind === 'buyer') {
      if (!c.selectedUid) {
        const opts = L.filter((a) => a.type === 'SELECT_ITEM')
          .map((a) => ({ a, inv: s.inventory.find((i) => i.uid === a.uid) }))
          .filter((o) => o.inv && (P.allowIllegal || !knownIllegal(s, o.inv)))
          .sort((x, y) => value(y.inv) - value(x.inv));
        if (!opts.length) return { type: 'REFUSE' };
        return clean(opts[0].a);
      }
      const inv = s.inventory.find((i) => i.uid === c.selectedUid);
      const v = inv ? value(inv) : (c.askPrice ?? 50);
      if (!mem.lastOffer) { mem.lastOffer = round5(v * P.open); return { type: 'OFFER', price: mem.lastOffer }; }
      if (counterEv) {
        const cp = counterEv.price;
        if (P.concede >= 1 || c.patience <= 1 || cp >= mem.lastOffer * 0.9) { mem.lastOffer = cp; return { type: 'OFFER', price: cp }; }
        mem.lastOffer = Math.max(cp, round5(mem.lastOffer - (mem.lastOffer - cp) * P.concede));
        return { type: 'OFFER', price: mem.lastOffer };
      }
      return find(L, 'DEAL') ? { type: 'DEAL' } : { type: 'REFUSE' };
    }

    if (c.kind === 'seller') {
      const it = c.item;
      if (!it) return { type: 'REFUSE' };
      const d = S.itemDef(it.itemId) ?? { basePrice: 10, legality: 'legal' };
      const illegal = d.legality !== 'legal' || it.known?.stolen || (c.visibleTells?.length ?? 0) > 0 || !!it.serial && (s.hotList ?? []).includes(it.serial);
      if (illegal && !P.allowIllegal) return { type: 'REFUSE' };
      if (P.refuseSuspicious && it.known?.untested) return { type: 'REFUSE' };
      const room = S.freeSlots(s, 'storage') + S.freeSlots(s, 'shelf');
      if (room <= 0) return { type: 'REFUSE' };
      const v = Math.round(d.basePrice * (0.45 + 0.55 * (it.condition ?? 100) / 100));
      const maxPay = Math.min(Math.round(v * P.buyMargin), s.creds - reserve(s));
      if (maxPay < 5) return { type: 'REFUSE' };
      if (!mem.lastOffer) { mem.lastOffer = round5(Math.min(c.askPrice ?? v, v * P.buyMargin * 0.6)); return { type: 'OFFER', price: Math.min(mem.lastOffer, maxPay) }; }
      if (counterEv) {
        const cp = counterEv.price;
        if (cp <= maxPay) { mem.lastOffer = cp; return { type: 'OFFER', price: cp }; }
        if (c.patience <= 1) return { type: 'REFUSE' };
        const next = Math.min(maxPay, round5(mem.lastOffer + (cp - mem.lastOffer) / 2));
        if (next <= mem.lastOffer) return { type: 'REFUSE' };
        mem.lastOffer = next;
        return { type: 'OFFER', price: next };
      }
      return { type: 'REFUSE' };
    }
    return find(L, 'REFUSE') ? { type: 'REFUSE' } : { type: 'CLOSE_SHOP' };
  }

  function night(s, L) {
    if (find(L, 'CHOOSE_PERK')) return clean(find(L, 'CHOOSE_PERK'));
    if (find(L, 'BUY_DEED')) return { type: 'BUY_DEED' };
    const col = find(L, 'COLLECT_MACHINE'); if (col) return clean(col);
    if (s.lease.overdue && find(L, 'PAY_LEASE') && s.creds >= s.lease.overdue + 30) return { type: 'PAY_LEASE' };
    if (find(L, 'PAY_DUES') || find(L, 'SKIP_DUES')) {
      if (P.payDues && find(L, 'PAY_DUES') && s.creds > S.duesQuote(s) + 20) return { type: 'PAY_DUES' };
      if (find(L, 'SKIP_DUES')) return { type: 'SKIP_DUES' };
    }
    if (P.machines) {
      const runs = L.filter((a) => a.type === 'RUN_MACHINE' && Array.isArray(a.inputUids) && a.inputUids.length && (P.machines === 'all' || !/stretch|label|tap/.test(a.recipeId)));
      for (const r of runs) if (once(`run:${r.machineId}:${s.day}`)) return clean(r);
    }
    const res = reserve(s);
    if (P.upgrades && mem.upgradesTonight < 1 && s.creds > res + 1500) {
      const ups = L.filter((a) => a.type === 'BUY_UPGRADE' || a.type === 'BUY_MACHINE' || (a.type === 'BUY_PERMIT'));
      const pick = ups.find((a) => once(`up:${a.type}:${a.id}:${s.day}`) && !/grid_tap|label/.test(a.id ?? ''));
      if (pick) { mem.upgradesTonight++; return clean(pick); }
    }
    if (P.nightJob && find(L, 'NIGHT_JOB') && !s.nightJobDone) {
      const jobs = L.filter((a) => a.type === 'NIGHT_JOB' && (P.nightJob === 'all' || !/courier|collection/.test(a.jobId)));
      const j = jobs.find((a) => once(`job:${a.jobId}:${s.day}`));
      if (j) return clean(j);
    }
    // Market buying.
    const room = S.freeSlots(s, 'storage') + S.freeSlots(s, 'shelf');
    if (room > 0 && mem.boughtTonight < 12) {
      const listings = s.market.listings
        .map((l, i) => ({ l, i, d: S.itemDef(l.itemId) }))
        .filter(({ l, d }) => d && l.qty > 0 && (P.allowIllegal === true || d.legality === 'legal') && l.price <= d.basePrice * P.marketMargin
          && !(d.perishableDays && d.perishableDays < 3) && !/drained|feedstock|blank|label_stock/.test(l.itemId) && s.creds - l.price > res)
        .sort((a, b) => b.d.basePrice / b.l.price - a.d.basePrice / a.l.price);
      for (const o of listings) {
        if (once(`buy:${o.i}:${s.day}:${mem.boughtTonight}`)) { mem.boughtTonight++; return { type: 'BUY_STOCK', listingIndex: o.i, qty: 1 }; }
      }
    }
    return { type: 'SLEEP' };
  }

  return {
    name,
    choose(s, L, lastEvents = []) {
      if (s.day !== mem.day) { mem.day = s.day; mem.tried.clear(); mem.boughtTonight = 0; mem.upgradesTonight = 0; }
      if (P.random) return randomChoice(s, L);
      if (s.phase === 'dawn') return dawn(s, L);
      if (s.phase === 'open') return counter(s, L, lastEvents);
      if (s.phase === 'night') return night(s, L);
      if (s.phase === 'ended') return null;
      return clean(L[0]);
    },
  };
}
