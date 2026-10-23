'use strict';
/* EMIs (credit card / loan instalments).
   You give the price, interest (per month or per year), months, first EMI date, processing fee and GST %.
   Exsy works out the reducing-balance EMI, the interest and GST in every month's bill, and on each due date
   adds that month's bill as an entry on the card (or as money lent, when the EMI is for someone else).
   EMIs live in prefs/emis { items: [...] } so no new Firestore collection is needed. */

const emiItems = () => (D.prefs.find(p => p.id === 'emis') || {}).items || [];
function saveEmiItems(items) { const doc = D.prefs.find(p => p.id === 'emis') || { id: 'emis' }; save('prefs', { ...doc, items }); }
const emiById = id => emiItems().find(e => e.id === id);
const monthlyRate = e => e.ratePer === 'year' ? num(e.rate) / 1200 : num(e.rate) / 100;

function emiSchedule(e) {
  const P = num(e.principal), n = Math.max(1, Math.round(+e.months || 1)), r = monthlyRate(e), g = num(e.gst ?? 18) / 100;
  const emi = r ? P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : P / n;
  const start = e.start || today(), day = +start.slice(8, 10) || 1;
  let bal = P;
  const rows = [];
  for (let k = 1; k <= n; k++) {
    const interest = round2(bal * r);
    const principal = k === n ? round2(bal) : round2(emi - interest);
    bal = round2(bal - principal);
    const gst = round2(interest * g), fee = k === 1 ? num(e.fee) : 0, feeGst = round2(fee * g);
    const mk = addMonths(start.slice(0, 7), k - 1);
    rows.push({ k, date: `${mk}-${pad(Math.min(day, daysIn(mk)))}`, principal, interest, gst, fee, feeGst, total: round2(principal + interest + gst + fee + feeGst), balance: Math.max(0, bal) });
  }
  const sumOf = f => round2(sum(rows, f));
  return { rows, emi: round2(emi), interest: sumOf(r => r.interest), gst: sumOf(r => r.gst + r.feeGst), fee: num(e.fee), total: sumOf(r => r.total), monthly: rows[1]?.total ?? rows[0].total };
}
const emiTxnId = (e, k) => `emi_${e.id}_${k}`;
const emiPaidCount = e => emiSchedule(e).rows.filter(r => r.date <= today()).length;

/* ---------- adding each month's bill on its due date ---------- */
let emiBusy = false;
function emiTick() {
  if (emiBusy || !ready() || !D.books.length) return;
  emiBusy = true;
  try {
    const t0 = today();
    const items = emiItems();
    let changed = false;
    const next = items.map(e => {
      if (e.closed || e.auto === false || !e.accountId) return e;
      const posted = new Set(e.posted || []), add = [];
      for (const r of emiSchedule(e).rows) {
        if (r.date > t0 || posted.has(r.k)) continue;
        const n = emiSchedule(e).rows.length, note = `EMI ${r.k}/${n} · ${e.name}`;
        const base = { id: emiTxnId(e, r.k), amount: r.total, date: r.date, accountId: e.accountId, mode: X().acc.get(e.accountId)?.type === 'card' ? 'Card' : 'Net banking', note, emiId: e.id, emiNo: r.k };
        save('txns', e.personId ? { ...base, type: 'lend', personId: e.personId } : { ...base, type: 'expense', categoryId: emiCategory().id, forWhom: e.forWhom || meBook()?.id || 'home' });
        add.push(r.k);
      }
      if (!add.length) return e;
      changed = true;
      return { ...e, posted: [...posted, ...add] };
    });
    if (changed) saveEmiItems(next);
  } finally { emiBusy = false; }
}
function emiCategory() {
  return D.categories.find(c => c.kind === 'expense' && /emi/i.test(c.name)) || save('categories', { name: 'EMI / loan', icon: 'account_balance', kind: 'expense' });
}

/* ---------- pages ---------- */
function emiCard(e) {
  const s = emiSchedule(e), paid = emiPaidCount(e), n = s.rows.length, x = X();
  const next = s.rows.find(r => r.date > today()), left = round2(sum(s.rows.filter(r => r.date > today()), r => r.total));
  return `<a class="card" href="#/emi/${e.id}" style="display:block;color:inherit;margin-top:12px">
    <div class="card-title">${ic('credit_card')}<span style="flex:1">${esc(e.name)}</span>${e.closed ? '<span class="tag">Closed</span>' : paid >= n ? '<span class="tag ok">Finished</span>' : ''}</div>
    <div class="muted">${esc(accLabel(e.accountId, x))} · ${inr(e.principal)} at ${num(e.rate)}% ${e.ratePer === 'year' ? 'a year' : 'a month'} · ${n} months${e.personId ? ` · for ${esc(x.person.get(e.personId)?.name || '?')}` : ''}</div>
    <div style="display:flex;justify-content:space-between;margin:12px 0 6px;font-size:13px"><span>${paid} of ${n} paid</span><b>${inr(s.monthly)}/month</b></div>
    <div class="progress"><i style="width:${paid / n * 100}%"></i></div>
    <div class="muted" style="margin-top:8px;font-size:13px">${next && !e.closed ? `Next: ${inr(next.total)} on ${fmtDate(next.date)} · ${inr(left)} left` : `Total paid ${inr(s.total)}`}</div></a>`;
}
function pageEmis() {
  const items = emiItems(), active = items.filter(e => !e.closed && emiPaidCount(e) < emiSchedule(e).rows.length);
  const k = thisMonth();
  const thisMonthBill = sum(active, e => sum(emiSchedule(e).rows.filter(r => r.date.startsWith(k)), r => r.total));
  const left = sum(active, e => sum(emiSchedule(e).rows.filter(r => r.date > today()), r => r.total));
  const body = `<div class="card primary"><div class="hero-label">EMIs this month (${fmtMonth(k)})</div><div class="hero-num">${inr(thisMonthBill)}</div>
      <div class="stats"><div class="stat"><span>Running EMIs</span><b>${active.length}</b></div><div class="stat"><span>Still to pay</span><b>${inr(left)}</b></div></div></div>
    ${items.map(emiCard).join('') || `<div class="empty" style="margin-top:24px">${ic('credit_card')}No EMIs yet.<br>Tap “Add EMI” and enter the card, price, interest and months – Exsy works out the monthly bill with GST.</div>`}`;
  return { title: 'EMIs', back: '#/more', body, fabAct: 'editEmi', fabLabel: 'Add EMI' };
}
function pageEmi(id) {
  const e = emiById(id);
  if (!e) return { title: 'EMI', back: '#/emis', body: '<div class="empty">This EMI was deleted.</div>' };
  const s = emiSchedule(e), x = X(), t0 = today(), extra = round2(s.total - num(e.principal));
  const body = `<div class="card primary">
      <div class="hero-label">${esc(accLabel(e.accountId, x))}${e.personId ? ` · for ${esc(x.person.get(e.personId)?.name || '?')} (they pay you back)` : ''}</div>
      <div class="hero-num">${inr(s.monthly)}<span style="font-size:16px;opacity:.8"> / month</span></div>
      <div class="stats">
        <div class="stat"><span>Price</span><b>${inr(e.principal)}</b></div>
        <div class="stat"><span>Interest</span><b>${inr(s.interest)}</b></div>
        <div class="stat"><span>GST (${num(e.gst ?? 18)}%)</span><b>${inr(s.gst)}</b></div>
        ${s.fee ? `<div class="stat"><span>Processing fee</span><b>${inr(s.fee)}</b></div>` : ''}
        <div class="stat"><span>Total you pay</span><b>${inr(s.total)}</b></div>
        <div class="stat"><span>Extra cost</span><b>${inr(extra)}</b></div>
      </div></div>
    <p class="muted" style="margin:10px 4px">${e.auto === false ? 'Bills are not added automatically – add them yourself.' : `Each month’s bill is added on its date as ${e.personId ? `money lent to ${esc(x.person.get(e.personId)?.name || '?')}` : 'an expense'} on ${esc(accLabel(e.accountId, x))}.`}
      Don’t also add the purchase itself – the EMIs are the expense.</p>
    <div class="grid-wrap"><table class="cg emi-table"><thead><tr><th class="name">#</th><th>Date</th><th>Principal</th><th>Interest</th><th>GST</th><th>Bill</th><th>Left</th></tr></thead><tbody>
      ${s.rows.map(r => `<tr class="${r.date <= t0 ? 'done' : ''}"><th class="name">${r.k}${r.date <= t0 ? ' ✓' : ''}</th><td>${fmtDay(r.date)} ’${r.date.slice(2, 4)}</td><td>${inr(r.principal)}</td><td>${inr(r.interest)}</td>
        <td>${inr(r.gst + r.feeGst)}</td><td><b>${inr(r.total)}</b>${r.fee ? '<br><small>incl. fee</small>' : ''}</td><td>${inr(r.balance)}</td></tr>`).join('')}
    </tbody></table></div>`;
  return { title: e.name, back: '#/emis', body, fab: false, actions: `<button class="icon-btn" data-act="editEmi" data-id="${id}" title="Edit EMI" aria-label="Edit EMI">${ic('edit')}</button>` };
}

/* ---------- add / edit ---------- */
function openEmiForm(id) {
  const old = id ? emiById(id) : null;
  const card = D.accounts.find(a => a.type === 'card' && !a.archived);
  const e = old ? { ...old } : { rate: 1.33, ratePer: 'month', months: 12, gst: 18, fee: 0, start: `${addMonths(thisMonth(), 1)}-05`, accountId: card?.id || defaultAccount(), forWhom: meBook()?.id, auto: true };
  const who = e.personId ? 'p:' + e.personId : e.forWhom || meBook()?.id;
  const s = openSheet(`<form id="emf">${sheetHead(old ? 'Edit EMI' : 'New EMI', old ? `<button type="button" class="icon-btn" id="emf-del" aria-label="Delete">${ic('delete')}</button>` : '')}
    <div class="sheet-body">
      ${field('What is it', `<input name="name" value="${esc(e.name || '')}" placeholder="e.g. Phone on HDFC card, Fridge" required>`)}
      <div class="form-label">Paid with</div>${accChips('accountId', e.accountId, a => a.type === 'card' || a.type === 'bank')}
      <div class="grid2">${field('Price / loan amount', `<input name="principal" inputmode="decimal" value="${esc(e.principal ?? '')}" placeholder="e.g. 30000" required>`)}
        ${field('Interest rate %', `<input name="rate" inputmode="decimal" value="${esc(e.rate ?? '')}" placeholder="e.g. 1.33">`)}</div>
      <div class="chips" style="margin-top:8px">${chip('ratePer', 'month', 'per month', e.ratePer !== 'year')}${chip('ratePer', 'year', 'per year', e.ratePer === 'year')}</div>
      <div class="form-label">Months</div>
      <div class="chips">${[3, 6, 9, 12, 18, 24].map(m => chip('monthsPick', m, `${m}`, +e.months === m)).join('')}${chip('monthsPick', 'other', 'Other', ![3, 6, 9, 12, 18, 24].includes(+e.months))}</div>
      <label class="field ${[3, 6, 9, 12, 18, 24].includes(+e.months) ? 'hide' : ''}" id="emf-mo" style="margin-top:8px"><span>Number of months</span><input name="monthsOther" type="number" min="1" max="360" value="${esc(e.months)}"></label>
      <div class="grid3" style="margin-top:12px">${field('First EMI date', `<input name="start" type="date" value="${esc(e.start)}">`)}
        ${field('Processing fee', `<input name="fee" inputmode="decimal" value="${esc(e.fee || '')}" placeholder="0">`)}
        ${field('GST %', `<input name="gst" inputmode="decimal" value="${esc(e.gst ?? 18)}">`)}</div>
      <div class="form-label">Who is it for</div>
      <div class="chips">${booksSorted().map(b => chip('who', b.id, b.name, who === b.id, 'person')).join('')}${chip('who', 'home', 'Home', who === 'home', 'home')}
        ${D.people.slice().sort(byName).map(p => chip('who', 'p:' + p.id, `${p.name} (pays me back)`, who === 'p:' + p.id, 'handshake')).join('')}</div>
      <label class="switch-row"><span>Add each month’s bill automatically on its date</span><input type="checkbox" name="auto" ${e.auto === false ? '' : 'checked'}></label>
      <div class="meaning" id="emf-calc"></div>
    </div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
  const f = s.querySelector('#emf');
  const readEmi = () => {
    const v = readForm(f);
    const months = v.monthsPick === 'other' || !v.monthsPick ? +v.monthsOther || 0 : +v.monthsPick;
    const w = v.who || '';
    return { ...e, name: (v.name || '').trim(), accountId: v.accountId, principal: evalAmount(v.principal) || 0, rate: num(v.rate), ratePer: v.ratePer || 'month', months,
      start: v.start || today(), fee: evalAmount(v.fee) || 0, gst: v.gst === '' ? 18 : num(v.gst), auto: !!v.auto,
      personId: w.startsWith('p:') ? w.slice(2) : '', forWhom: w.startsWith('p:') ? '' : w };
  };
  const calc = () => {
    const v = readEmi(), box = s.querySelector('#emf-calc');
    if (!(v.principal > 0) || !(v.months > 0)) { box.innerHTML = `<b>${ic('info', 'sm')}Monthly bill</b><p>Enter the price and months to see the monthly bill with GST.</p>`; return; }
    const sc = emiSchedule(v), first = sc.rows[0];
    box.innerHTML = `<b>${ic('calculate', 'sm')}Monthly bill: about ${inr(Math.round(sc.monthly))}</b><p>EMI ${inr(sc.emi)} + GST on the interest${v.rate ? ' – a little less each month as the interest goes down' : ' (0% interest)'}.${first.fee ? ` First month ${inr(first.total)} (includes ${inr(first.fee)} fee + GST).` : ''}
Interest ${inr(sc.interest)} + GST ${inr(sc.gst)}${sc.fee ? ` + fee ${inr(sc.fee)}` : ''} → you pay ${inr(sc.total)} for ${inr(v.principal)} (${inr(sc.total - v.principal)} extra).
Last EMI on ${fmtDate(sc.rows[sc.rows.length - 1].date)}.</p>`;
  };
  f.addEventListener('input', calc);
  f.addEventListener('change', ev => { if (ev.target.name === 'monthsPick') s.querySelector('#emf-mo').classList.toggle('hide', ev.target.value !== 'other'); calc(); });
  calc();
  f.onsubmit = ev => {
    ev.preventDefault();
    const v = readEmi();
    if (!v.name) { snack('Give it a name'); return; }
    if (!(v.principal > 0) || !(v.months > 0)) { snack('Enter the price and months'); return; }
    if (!v.accountId) { snack('Choose the card or account'); return; }
    // changing the plan of an EMI that already has bills: keep the bills already added, renumbering is not attempted
    const item = { ...v, id: old?.id || uid(), posted: old?.posted || [] };
    saveEmiItems(old ? emiItems().map(x => x.id === old.id ? item : x) : [...emiItems(), item]);
    closeSheet(); buzz(); snack(`EMI saved – ${inr(emiSchedule(item).monthly)} a month`);
    emiTick();
    if (!old) go('#/emi/' + item.id);
  };
  const del = s.querySelector('#emf-del');
  if (del) del.onclick = () => confirmSheet({
    title: 'Delete this EMI?', ok: 'Delete', danger: true,
    text: `“${esc(old.name)}” is removed. The ${(old.posted || []).length} monthly bills already added stay in your entries (delete them there if you want).`,
    onOk: () => { saveEmiItems(emiItems().filter(x => x.id !== old.id)); snack('EMI deleted'); go('#/emis'); }
  });
}

/* ---------- Home "Needs attention" ---------- */
function emiAttention() {
  const t0 = today(), out = [];
  for (const e of emiItems().filter(e => !e.closed)) {
    const r = emiSchedule(e).rows.find(r => r.date > t0);
    if (!r) continue;
    const d = daysBetween(t0, r.date);
    if (d <= 5) out.push({ icon: 'credit_card', cls: 'info', title: `EMI ${inr(r.total)} · ${e.name}`, sub: `${d === 0 ? 'Today' : `In ${d} day${d > 1 ? 's' : ''}`} (${fmtDay(r.date)}) on ${accLabel(e.accountId, X())} – EMI ${r.k} of ${emiSchedule(e).rows.length}`, go: `#/emi/${e.id}` });
  }
  return out;
}
