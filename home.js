'use strict';
/* Home expenses: one book (normally Mother) is responsible for the home.
   Any expense "for Home" paid from someone else's money is owed back by that book – unless the entry is
   marked "don't ask back". Paying it back is a transfer marked homeSettle. Settings live in prefs/home. */

const homePrefs = () => D.prefs.find(p => p.id === 'home') || {};
// Book that pays for the home; '' = nobody (just track), unset = the book called Mother
function homePayer() {
  const id = homePrefs().payerBook;
  if (id === '') return null;
  if (id && D.books.some(b => b.id === id)) return id;
  return (D.books.find(b => /mother|amma|mom/i.test(b.name)) || {}).id || null;
}
const payerName = () => X().book.get(homePayer())?.name || 'Mother';
// Only entries from this date count, so older home costs already settled in person are left out.
// Default: 1 Oct 2026, when the owner started using Exsy.
const homeSince = () => homePrefs().since || '2026-10-01';
const claimApplies = (accountId, forWhom) => { const p = homePayer(), b = X().acc.get(accountId)?.bookId; return !!p && forWhom === 'home' && !!b && b !== p; };
const isHomeClaim = t => t.type === 'expense' && t.homeClaim !== false && t.date >= homeSince() && claimApplies(t.accountId, t.forWhom);

let homeMemo = { v: -1 };
function homeLedger() {
  if (homeMemo.v === VER) return homeMemo;
  const x = X(), payer = homePayer(), owed = new Map(), claims = [], settles = [];
  if (payer) for (const t of D.txns) {
    if (isHomeClaim(t)) { const b = x.acc.get(t.accountId).bookId; owed.set(b, (owed.get(b) || 0) + num(t.amount)); claims.push(t); }
    else if (t.type === 'transfer' && t.homeSettle && t.date >= homeSince() && x.acc.get(t.accountId)?.bookId === payer) {
      const tb = x.acc.get(t.toAccountId)?.bookId;
      if (tb) { owed.set(tb, (owed.get(tb) || 0) - num(t.amount)); settles.push(t); }
    }
  }
  homeMemo = { v: VER, payer, owed, claims, settles };
  return homeMemo;
}
const owedTo = bookId => round2(homeLedger().owed.get(bookId) || 0);

/* ---------- entry form switch: "Mother pays this back" ---------- */
function claimSwitch(f) {
  const show = f.type === 'expense' && claimApplies(f.accountId, f.forWhom || 'home');
  return `<label class="switch-row ${show ? '' : 'hide'}" id="ef-claim"><span>${ic('handshake', 'sm')} <b class="ef-claim-name">${esc(payerName())}</b> pays this back to me</span>
    <input type="checkbox" name="homeClaim" ${f.homeClaim === false ? '' : 'checked'}></label>`;
}
function syncClaimSwitch(form) {
  const row = form.querySelector('#ef-claim'); if (!row) return;
  const v = readForm(form);
  row.classList.toggle('hide', !(v.type === 'expense' && claimApplies(v.accountId, v.forWhom)));
}

/* ---------- page ---------- */
function pageHomeCosts() {
  const x = X(), L = homeLedger(), payer = L.payer, pName = payerName();
  const k = UI.homeCostMonth || thisMonth();
  const list = D.txns.filter(t => t.type === 'expense' && t.forWhom === 'home' && t.date.startsWith(k));
  const total = sum(list, t => t.amount);
  const byBook = new Map();
  for (const t of list) { const b = x.acc.get(t.accountId)?.bookId || '?'; byBook.set(b, (byBook.get(b) || 0) + num(t.amount)); }
  const paidRows = [...byBook].sort((a, b) => b[1] - a[1]);
  const cats = spendBreakdown(list, x, t => t.categoryId, 8);
  const debts = [...L.owed].filter(([, v]) => Math.abs(v) > 0.005);
  const who = b => (D.books.find(z => z.id === b)?.primary ? 'you' : x.book.get(b)?.name || '?');
  const hero = !payer
    ? `<div class="hero-label">Home costs are only tracked – nobody pays anyone back.</div><div class="hero-num">${inr(total)}</div><div class="hero-label">spent for Home in ${fmtMonth(k)}</div>`
    : debts.length
      ? debts.map(([b, v]) => `<div class="hero-label">${v > 0 ? `${esc(pName)} owes ${esc(who(b))}` : `${esc(who(b))} ${who(b) === 'you' ? 'owe' : 'owes'} ${esc(pName)}`}</div>
          <div class="hero-num">${inrAbs(v)}</div>
          ${v > 0 ? `<button class="btn filled" data-act="homeSettle" data-b="${b}" style="margin-bottom:12px">${ic('swap_horiz')}${esc(pName)} paid it back</button>` : ''}`).join('')
      : `<div class="hero-label">Home costs</div><div class="hero-num">All settled ${ic('check_circle')}</div>`;
  const body = `<div class="card primary">${hero}
      ${payer ? `<p class="hero-label">${esc(pName)}’s money pays for the home. When you pay a home expense from your own account, it is added here – unless you switch off “${esc(pName)} pays this back” on that entry.</p>` : ''}</div>
    <div class="card" style="margin-top:12px">
      <div class="card-title"><span style="flex:1">Spent for Home</span>${monthNav('homeCostMonth', k, fmtMonth(k))}</div>
      <div class="hero-num" style="font-size:28px;margin:0 0 8px">${inr(total)}</div>
      ${paidRows.length ? `<div class="form-label" style="margin-top:4px">Who paid</div><div class="bars">${paidRows.map(([b, v], i) => `<div class="bar-row"><span>${ic('person')}${esc(x.book.get(b)?.name || '?')}</span><b>${inr(v)}</b><div class="track"><i style="width:${v / paidRows[0][1] * 100}%;--c:${PALETTE[i]}"></i></div></div>`).join('')}</div>` : ''}
      ${cats.length ? `<div class="form-label" style="margin-top:16px">What for</div><div class="bars">${cats.map(([c, v], i) => `<div class="bar-row"><span>${ic(x.cat.get(c)?.icon || 'category')}${esc(x.cat.get(c)?.name || c)}</span><b>${inr(v)}</b><div class="track"><i style="width:${v / cats[0][1] * 100}%;--c:${PALETTE[(i + 3) % PALETTE.length]}"></i></div></div>`).join('')}</div>` : `<div class="empty">No home expenses in ${fmtMonth(k)}</div>`}
    </div>
    <div class="section-head" style="margin-top:12px"><h2>Who pays for the home?</h2></div>
    <div class="chips">${booksSorted().map(b => `<button class="chip ${payer === b.id ? 'on' : ''}" data-act="homePayer" data-b="${b.id}">${payer === b.id ? ic('check') : ''}${esc(b.name)}</button>`).join('')}
      <button class="chip ${!payer ? 'on' : ''}" data-act="homePayer" data-b="">${!payer ? ic('check') : ''}Nobody – just track</button></div>
    ${payer ? `<label class="field" style="margin-top:12px;max-width:260px"><span>Count home costs from</span><input type="date" id="home-since" value="${esc(homeSince())}"></label>
      <p class="muted" style="margin:4px 4px 0">Entries before this date are left out (already settled).</p>` : ''}
    <div class="card" style="margin-top:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:180px"><b style="font-weight:500">Fixed monthly money to ${esc(pName)}</b><div class="muted">${monthlyToPayer() ? esc(monthlyToPayer()) : 'Get a reminder each month and record it in one tap.'}</div></div>
      <button class="btn tonal" data-act="homeMonthly">${ic('event_repeat')}${monthlyToPayer() ? 'Change' : 'Set up'}</button></div>
    <div class="section-head" style="margin-top:12px"><h2>Home entries · ${fmtMonth(k)}</h2></div>
    <div class="card flush">${txList(list, x, { empty: 'Nothing yet – choose “For whom: Home” when adding an expense' })}</div>
    ${L.settles.length ? `<div class="section-head" style="margin-top:12px"><h2>Paid back</h2></div><div class="card flush">${txList(L.settles.slice().sort(byDateDesc).slice(0, 12), x, { flat: true })}</div>` : ''}`;
  return { title: 'Home expenses', back: '#/more', body, fabAct: 'addHomeExpense', fabLabel: 'Home expense' };
}
function monthlyToPayer() {
  const p = homePayer(), x = X();
  const r = D.recurring.find(r => r.type === 'transfer' && x.acc.get(r.toAccountId)?.bookId === p);
  return r ? `${inr(r.amount)} on the ${ordinal(+r.day || 1)} · ${accLabel(r.accountId, x)} → ${accLabel(r.toAccountId, x)}` : '';
}
function openHomeMonthly() {
  const p = homePayer(), x = X();
  const r = D.recurring.find(r => r.type === 'transfer' && x.acc.get(r.toAccountId)?.bookId === p);
  if (r) return openRecurringForm(r.id);
  const to = D.accounts.find(a => a.bookId === p && a.type === 'bank' && !a.archived) || D.accounts.find(a => a.bookId === p && !a.archived);
  openRecurringForm(undefined, { type: 'transfer', name: `Monthly money to ${payerName()}`, toAccountId: to?.id || '' });
}

/* ---------- paying back ---------- */
function openSettle(creditor) {
  const x = X(), payer = homePayer(), owed = owedTo(creditor), pName = payerName();
  const fromAcc = (D.accounts.find(a => a.bookId === payer && a.type === 'bank' && !a.archived) || D.accounts.find(a => a.bookId === payer && !a.archived) || {}).id;
  const toAcc = (D.accounts.find(a => a.bookId === creditor && a.type === 'bank' && !a.archived) || D.accounts.find(a => a.bookId === creditor && !a.archived) || {}).id;
  const s = openSheet(`<form id="hs">${sheetHead(`${pName} pays back`)}
    <p class="lead">${esc(pName)} owes ${inr(owed)} for home expenses ${x.book.get(creditor)?.primary ? 'you' : esc(x.book.get(creditor)?.name)} paid. Record what was given back – all of it or part.</p>
    <label class="amount-field"><b>₹</b><input name="amount" inputmode="decimal" value="${owed > 0 ? owed : ''}"></label>
    <div class="form-label">From ${esc(pName)}’s</div>${accChips('accountId', fromAcc, a => a.bookId === payer)}
    <div class="form-label">Into</div>${accChips('toAccountId', toAcc, a => a.bookId === creditor)}
    <div class="form-label">How</div><div class="chips">${['Cash', 'UPI', 'Net banking'].map(m => chip('mode', m, m, m === 'UPI', MODE_ICON[m])).join('')}</div>
    <div style="margin-top:16px">${field('Date', `<input type="date" name="date" value="${today()}">`)}</div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
  s.querySelector('#hs').onsubmit = e => {
    e.preventDefault();
    const v = readForm(e.target), amt = evalAmount(v.amount);
    if (!(amt > 0)) { snack('Enter the amount'); return; }
    if (!v.accountId || !v.toAccountId) { snack('Choose both accounts'); return; }
    save('txns', { type: 'transfer', amount: amt, accountId: v.accountId, toAccountId: v.toAccountId, date: v.date || today(), mode: v.mode, note: 'Home expenses paid back', homeSettle: true });
    buzz(); closeSheet(); snack(`${pName} paid back ${inr(amt)}`);
  };
}

/* ---------- Home dashboard reminder ---------- */
function homeAttention() {
  const me = meBook(), v = me ? owedTo(me.id) : 0;
  return v > 0.005 ? [{ icon: 'house', cls: 'info', title: `${payerName()} owes you ${inr(v)} for home costs`, sub: `${homeLedger().claims.filter(t => t.date.startsWith(thisMonth())).length} home expenses paid by you this month`, go: '#/homecosts' }] : [];
}

// "Count home costs from" date on the Home expenses page
app.addEventListener('change', e => {
  if (e.target.id !== 'home-since' || !e.target.value) return;
  save('prefs', { ...homePrefs(), id: 'home', since: e.target.value });
  snack(`Counting home costs from ${fmtDate(e.target.value)}`);
});
