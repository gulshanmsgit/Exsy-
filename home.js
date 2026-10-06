'use strict';
/* Mother's money – one running balance of Mother's money that you are keeping:
     + her fixed monthly money (salary), added automatically each month from the settings
     − home costs you paid from your own accounts (home costs are hers) unless the entry says otherwise
     − money you give her (any transfer from your accounts to hers)
     + money she gives you (any transfer from her accounts to yours)
   Positive = you are keeping that much of her money; negative = she owes you.
   Settings live in prefs/home: { payerBook, salary: [{ from: 'YYYY-MM', amount }], salaryDay, since }. */

const homePrefs = () => D.prefs.find(p => p.id === 'home') || {};
const saveHomePrefs = patch => save('prefs', { ...homePrefs(), id: 'home', ...patch });
// Book whose money pays for the home: '' = nobody (just track), unset = the book called Mother
function homePayer() {
  const id = homePrefs().payerBook;
  if (id === '') return null;
  if (id && D.books.some(b => b.id === id)) return id;
  return (D.books.find(b => /mother|amma|mom/i.test(b.name)) || {}).id || null;
}
const payerName = () => X().book.get(homePayer())?.name || 'Mother';
// Monthly money: ONE setting { from: first month of money, amount }. Saving replaces it.
// (Older versions kept a list in `salary`; the latest-starting entry was the corrected one.)
function monthlyPlan() {
  const p = homePrefs();
  if (p.monthly) return p.monthly.amount ? p.monthly : null;
  const old = (p.salary || []).slice().sort((a, b) => a.from.localeCompare(b.from)).pop();
  return old && num(old.amount) ? { from: old.from, amount: num(old.amount) } : null;
}
// Paid the next month: the money for September is given on the pay day in October
const paidNextMonth = () => homePrefs().arrears !== false;
const payDay = () => clamp(+homePrefs().salaryDay || 1, 1, 28);
const payDateFor = workMonth => `${paidNextMonth() ? addMonths(workMonth, 1) : workMonth}-${pad(payDay())}`;
// Entries are counted from here (older ones were settled before Exsy); independent of the monthly money
const homeSince = () => homePrefs().since || '2026-10-01';
const claimApplies = (accountId, forWhom) => { const p = homePayer(), b = X().acc.get(accountId)?.bookId; return !!p && forWhom === 'home' && !!b && b !== p; };
const isHomeClaim = t => t.type === 'expense' && t.homeClaim !== false && t.date >= homeSince() && claimApplies(t.accountId, t.forWhom);

let homeMemo = { v: -1 };
function motherLedger() {
  if (homeMemo.v === VER) return homeMemo;
  const x = X(), mom = homePayer(), me = meBook()?.id, since = homeSince(), months = new Map();
  const row = k => months.get(k) || months.set(k, { salary: 0, salaryFor: [], home: 0, given: 0, got: 0 }).get(k);
  const L = { v: VER, mom, months, claims: [], moves: [], salary: 0, home: 0, given: 0, got: 0, next: null };
  if (mom) {
    // monthly money: one amount for every month from plan.from, added on its pay day (next month by default)
    const plan = monthlyPlan(), t0 = today();
    if (plan) for (let w = plan.from; ; w = addMonths(w, 1)) {
      const pd = payDateFor(w);
      if (pd > t0) { L.next = { work: w, date: pd, amount: num(plan.amount) }; break; }
      const r = row(pd.slice(0, 7)); r.salary += num(plan.amount); r.salaryFor.push(w); L.salary += num(plan.amount);
    }
    for (const t of D.txns) {
      if (t.date < since) continue;
      if (isHomeClaim(t)) { row(t.date.slice(0, 7)).home += num(t.amount); L.home += num(t.amount); L.claims.push(t); continue; }
      if (t.type !== 'transfer') continue;
      const fb = x.acc.get(t.accountId)?.bookId, tb = x.acc.get(t.toAccountId)?.bookId;
      if (fb === me && tb === mom) { row(t.date.slice(0, 7)).given += num(t.amount); L.given += num(t.amount); L.moves.push(t); }
      else if (fb === mom && tb === me) { row(t.date.slice(0, 7)).got += num(t.amount); L.got += num(t.amount); L.moves.push(t); }
    }
  }
  L.balance = round2(L.salary - L.home - L.given + L.got);
  homeMemo = L;
  return L;
}

/* ---------- entry form switch ---------- */
function claimSwitch(f) {
  const show = f.type === 'expense' && claimApplies(f.accountId, f.forWhom || 'home');
  return `<label class="switch-row claim-row ${show ? '' : 'hide'}" id="ef-claim"><span><span>Take it from <b>${esc(payerName())}’s money</b></span><small>Home costs are ${esc(payerName())}’s – switch off if this one is yours</small></span>
    <input type="checkbox" name="homeClaim" ${f.homeClaim === false ? '' : 'checked'}></label>`;
}
function syncClaimSwitch(form) {
  const row = form.querySelector('#ef-claim'); if (!row) return;
  const v = readForm(form);
  row.classList.toggle('hide', !(v.type === 'expense' && claimApplies(v.accountId, v.forWhom)));
}

/* ---------- page ---------- */
function balanceText(L, name) {
  return L.balance >= 0 ? { label: `${name}’s money with you`, sub: `You are keeping this for ${name}` }
    : { label: `${name} owes you`, sub: `Home costs you paid are more than ${name}’s money` };
}
function pageMother() {
  const x = X(), L = motherLedger(), name = payerName(), p = homePrefs();
  if (!L.mom) return { title: 'Mother’s money', back: '#/more', fab: false, body: `<div class="card"><p>Choose whose money pays for the home:</p>${payerChips(null)}</div>` };
  const bt = balanceText(L, name), k = thisMonth(), m = L.months.get(k) || { salary: 0, salaryFor: [], home: 0, given: 0, got: 0 };
  const plan = monthlyPlan(), shortMon = w => MON[+w.slice(5, 7) - 1];
  const stmt = [...L.months].sort((a, b) => b[0].localeCompare(a[0]));
  let run = L.balance;
  const stmtRows = stmt.map(([mk, r]) => { const end = run; run = round2(run - (r.salary - r.home - r.given + r.got)); return { mk, r, end }; });
  const homeMonth = D.txns.filter(t => t.type === 'expense' && t.forWhom === 'home' && t.date.startsWith(k));
  const body = `<div class="card primary">
      <div class="hero-label">${bt.label}</div><div class="hero-num">${inrAbs(L.balance)}</div>
      <div class="hero-label" style="margin-bottom:12px">${bt.sub}</div>
      <div class="btn-row"><button class="btn filled" data-act="motherMove" data-dir="give">${ic('north_east')}Gave to ${esc(name)}</button>
        <button class="btn tonal" data-act="motherMove" data-dir="get">${ic('south_west')}${esc(name)} gave me</button></div></div>

    <div class="card" style="margin-top:12px"><div class="card-title">${ic('today')}This month · ${fmtMonth(k)}</div>
      <div class="kv"><span>+ Monthly money${m.salaryFor.length ? ` (${m.salaryFor.map(shortMon).join(', ')} money)` : ''}</span><b class="pos">${m.salary ? inr(m.salary) : L.next ? `${inr(L.next.amount)} on ${fmtDay(L.next.date)}` : 'not set'}</b></div>
      <div class="kv"><span>− Home costs you paid</span><b>${inr(m.home)}</b></div>
      <div class="kv"><span>− Given to ${esc(name)}</span><b>${inr(m.given)}</b></div>
      ${m.got ? `<div class="kv"><span>+ ${esc(name)} gave you</span><b class="pos">${inr(m.got)}</b></div>` : ''}
    </div>

    <div class="card" style="margin-top:12px"><div class="card-title">${ic('payments')}${esc(name)}’s monthly money</div>
      ${plan ? `<div class="banner info" style="margin-bottom:12px">${ic('info')}<div><b>${inr(plan.amount)}</b> for every month from <b>${fmtMonth(plan.from)}</b>, given on the ${ordinal(payDay())}${paidNextMonth() ? ' of the next month' : ''}.
        ${L.next ? `<br>Next: ${shortMon(L.next.work)} money on ${fmtDate(L.next.date)}.` : ''}</div></div>`
        : `<p class="muted" style="margin-bottom:12px">The fixed amount you give ${esc(name)} each month. It is added here automatically – no entry needed, the money can stay in your account.</p>`}
      <div class="grid3">
        ${field('Amount each month', `<input id="mo-amt" inputmode="decimal" value="${plan ? plan.amount : ''}" placeholder="e.g. 5000">`)}
        ${field('First month of money', `<input id="mo-from" type="month" value="${esc(plan ? plan.from : addMonths(k, -1))}">`)}
        ${field('Given on day', `<input id="mo-day" type="number" min="1" max="28" value="${payDay()}">`)}
      </div>
      <label class="switch-row" style="margin-top:8px"><span>Given the next month <small class="muted" style="display:block">e.g. paid in October = September’s money</small></span><input type="checkbox" id="mo-next" ${paidNextMonth() ? 'checked' : ''}></label>
      <div class="btn-row" style="margin-top:8px"><button class="btn filled" data-act="motherSalary">${ic('check')}Save</button>
        ${plan ? `<button class="btn text danger" data-act="motherSalaryOff">Stop monthly money</button>` : ''}</div>
    </div>

    ${stmtRows.length ? `<div class="section-head" style="margin-top:12px"><h2>Month by month</h2></div>
    <div class="card flush">${stmtRows.map(({ mk, r, end }) => `<div class="li static"><span class="li-text"><span class="li-title">${fmtMonth(mk)}</span>
      <span class="li-sub" style="white-space:normal">${[r.salary && `+${inr(r.salary)} ${r.salaryFor.map(shortMon).join(', ')} money`, r.home && `−${inr(r.home)} home`, r.given && `−${inr(r.given)} given`, r.got && `+${inr(r.got)} from ${esc(name)}`].filter(Boolean).join(' · ')}</span></span>
      <span class="li-end"><small>${end >= 0 ? 'with you' : 'owes you'}</small>${inrAbs(end)}</span></div>`).join('')}</div>` : ''}

    <div class="section-head" style="margin-top:12px"><h2>Home costs · ${fmtMonth(k)}</h2><span class="muted">${inr(sum(homeMonth, t => t.amount))}</span></div>
    <div class="card flush">${txList(homeMonth, x, { empty: 'Add an expense with “For whom: Home”' })}</div>

    <div class="section-head" style="margin-top:12px"><h2>Settings</h2></div>
    <div class="card"><div class="form-label" style="margin-top:0">Whose money pays for the home</div>${payerChips(L.mom)}
      <label class="field" style="margin-top:12px;max-width:260px"><span>Count from</span><input type="date" id="home-since" value="${esc(homeSince())}"></label>
      <p class="muted" style="margin:4px 4px 0">Entries before this date are left out (already settled).</p></div>`;
  return { title: `${name}’s money`, back: '#/more', body, fabAct: 'addHomeExpense', fabLabel: 'Home expense' };
}
function payerChips(cur) {
  return `<div class="chips">${booksSorted().filter(b => !b.primary).map(b => `<button class="chip ${cur === b.id ? 'on' : ''}" data-act="homePayer" data-b="${b.id}">${cur === b.id ? ic('check') : ''}${esc(b.name)}</button>`).join('')}
    <button class="chip ${!cur ? 'on' : ''}" data-act="homePayer" data-b="">${!cur ? ic('check') : ''}Nobody – just track home costs</button></div>`;
}
function saveSalary() {
  const amt = evalAmount($('#mo-amt').value), from = $('#mo-from').value || thisMonth(), day = clamp(+$('#mo-day').value || 1, 1, 28);
  if (!(amt > 0)) return snack('Enter the amount');
  // replaces the old setting completely, so a wrong start month is gone
  saveHomePrefs({ monthly: { from, amount: amt }, salary: [], salaryDay: day, arrears: !!$('#mo-next')?.checked });
  render();
  buzz(); snack(`${payerName()}’s money: ${inr(amt)} for every month from ${fmtMonth(from)}`);
}
function stopSalary() {
  confirmSheet({ title: 'Stop monthly money?', ok: 'Stop', danger: true,
    text: `All monthly money for ${esc(payerName())} is removed from the balance (entries, gifts and home costs stay).`,
    onOk: () => { saveHomePrefs({ monthly: { from: '', amount: 0 }, salary: [] }); snack('Monthly money stopped'); } });
}

/* ---------- giving / receiving ---------- */
function openMotherMove(dir) {
  const mom = homePayer(), me = meBook()?.id, name = payerName(), give = dir === 'give', L = motherLedger();
  const firstOf = (book, type) => (D.accounts.find(a => a.bookId === book && a.type === type && !a.archived) || D.accounts.find(a => a.bookId === book && !a.archived) || {}).id;
  const from = give ? firstOf(me, 'cash') : firstOf(mom, 'cash'), to = give ? firstOf(mom, 'cash') : firstOf(me, 'cash');
  const s = openSheet(`<form id="mm">${sheetHead(give ? `Gave money to ${name}` : `${name} gave me money`)}
    <p class="lead">${give ? `Now with you: ${inr(Math.max(0, L.balance))} of ${esc(name)}’s money.` : `This adds to ${esc(name)}’s money with you.`}</p>
    <label class="amount-field"><b>₹</b><input name="amount" inputmode="decimal" value="${give && L.balance > 0 ? L.balance : ''}"></label>
    <div class="form-label">From</div>${accChips('accountId', from, a => a.bookId === (give ? me : mom))}
    <div class="form-label">To</div>${accChips('toAccountId', to, a => a.bookId === (give ? mom : me))}
    <div class="form-label">How</div><div class="chips">${['Cash', 'UPI', 'Net banking'].map(m => chip('mode', m, m, m === 'Cash', MODE_ICON[m])).join('')}</div>
    <div class="grid2" style="margin-top:16px">${field('Date', `<input type="date" name="date" value="${today()}">`)}${field('Note', `<input name="note" placeholder="optional">`)}</div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
  s.querySelector('#mm').onsubmit = e => {
    e.preventDefault();
    const v = readForm(e.target), amt = evalAmount(v.amount);
    if (!(amt > 0)) { snack('Enter the amount'); return; }
    if (!v.accountId || !v.toAccountId) { snack('Choose both accounts'); return; }
    save('txns', { type: 'transfer', amount: amt, accountId: v.accountId, toAccountId: v.toAccountId, date: v.date || today(), mode: v.mode, note: (v.note || '').trim() || (give ? `Given to ${name}` : `From ${name}`) });
    buzz(); closeSheet(); snack(give ? `Gave ${inr(amt)} to ${name}` : `${name} gave ${inr(amt)}`);
  };
}

/* ---------- Home dashboard ---------- */
function motherHeroLine() {
  const L = motherLedger();
  if (!L.mom || Math.abs(L.balance) < 0.005 || (UI.book !== 'all' && UI.book !== meBook()?.id)) return '';
  return `<a class="hero-label" href="#/mother" style="display:block;margin-top:6px;color:inherit">${ic('house', 'sm')} ${L.balance > 0 ? `Includes ${inr(L.balance)} of ${esc(payerName())}’s money you keep` : `${esc(payerName())} owes you ${inr(-L.balance)} for home costs`} ›</a>`;
}
function homeAttention() { return []; }

// "Count from" date on the page
app.addEventListener('change', e => {
  if (e.target.id !== 'home-since' || !e.target.value) return;
  saveHomePrefs({ since: e.target.value });
  snack(`Counting from ${fmtDate(e.target.value)}`);
});
