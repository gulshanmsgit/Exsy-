'use strict';
/* Entry form, transaction rows, Home, Entries, Accounts and People pages */

/* ============================================================
   Entry (transaction) form
   ============================================================ */
function defaultAccount() {
  const last = lsGet(LS.last, {}).accountId;
  if (last && D.accounts.some(a => a.id === last && !a.archived)) return last;
  const me = meBook();
  return (me && accsOf(me.id)[0] || D.accounts.find(a => !a.archived) || {}).id || '';
}
function openEntry(init = {}) {
  const f = { type: 'expense', date: today(), accountId: defaultAccount(), forWhom: lsGet(LS.last, {}).forWhom || 'home', ...init };
  if (!f.mode) f.mode = ACC_T[X().acc.get(f.accountId)?.type]?.mode || 'Cash';
  renderEntry(f);
}
function editEntry(id) {
  const t = D.txns.find(x => x.id === id);
  if (t) renderEntry({ ...t, amount: String(t.amount) });
}

function renderEntry(f) {
  const x = X(), editing = !!f.id, ty = f.type;
  const isCat = ty === 'expense' || ty === 'income';
  const cats = D.categories.filter(c => c.kind === (ty === 'income' ? 'income' : 'expense'));
  const types = ['expense', 'income', 'transfer', 'lend', 'collect', 'borrow', 'repay'];
  const people = D.people.slice().sort(byName);
  const s = openSheet(`<form id="ef" autocomplete="off">
    ${sheetHead(editing ? 'Edit entry' : 'New entry', editing ? `<button type="button" class="icon-btn" id="ef-del" aria-label="Delete">${ic('delete')}</button>`
      : `<button type="button" class="btn text sm" id="ef-paste" title="Fill from a bank SMS or UPI message">${ic('content_paste')}Paste SMS</button>`)}
    ${f.pasteInfo ? `<div class="banner info">${ic('auto_awesome')}<div>Read from the message: ${esc(f.pasteInfo)}. Check and Save.</div></div>` : ''}
    <div class="chips scroll">${types.map(t => chip('type', t, TT[t].label, t === ty, TT[t].icon)).join('')}</div>
    <label class="amount-field"><b>₹</b><input id="ef-amount" name="amount" inputmode="decimal" placeholder="0" value="${esc(f.amount ?? '')}" aria-label="Amount"></label>
    <div class="amount-hint" id="ef-hint">You can type sums like 250+120</div>
    ${PERSON_T.has(ty) ? `<div class="form-label">${ty === 'lend' ? 'Lent to' : ty === 'collect' ? 'Got back from' : ty === 'borrow' ? 'Borrowed from' : 'Repaid to'}</div>
      <div class="chips">${people.map(p => chip('personId', p.id, p.name, p.id === f.personId, 'person')).join('')}${chip('personId', '__new', 'New person', f.personId === '__new' || !people.length, 'person_add')}</div>
      <label class="field ${f.personId === '__new' || !people.length ? '' : 'hide'}" id="ef-newp" style="margin-top:8px"><span>Name</span><input name="newPerson" value="${esc(f.newPerson || '')}" placeholder="e.g. Sister, Ravi"></label>` : ''}
    <div class="form-label">${ty === 'transfer' ? 'From' : ty === 'income' || ty === 'collect' || ty === 'borrow' ? 'Money went to (whose cash / which bank)' : 'Paid from'}</div>
    ${accChips('accountId', f.accountId)}
    ${ty === 'transfer' ? `<div class="form-label">To</div>${accChips('toAccountId', f.toAccountId)}` : ''}
    ${isCat ? `<div class="form-label">Category</div>${usageChips('categoryId', cats, f.categoryId, x.catUse)}` : ''}
    ${ty === 'expense' ? `<div class="form-label">Where (shop)</div>${usageChips('storeId', [{ id: '', name: 'None', icon: '' }, ...D.stores], f.storeId || '', x.storeUse, 8)}
      <div class="form-label">For whom</div>
      <div class="chips">${chip('forWhom', 'home', 'Home', f.forWhom === 'home', 'home')}${booksSorted().map(b => chip('forWhom', b.id, b.name, f.forWhom === b.id, 'person')).join('')}</div>` : ''}
    <div class="form-label">${IN_T.has(ty) ? 'How did they pay?' : ty === 'transfer' ? 'How' : 'How did you pay?'}</div>
    <div class="chips" id="ef-modes">${MODES.map(m => chip('mode', m, m, f.mode === m, MODE_ICON[m])).join('')}</div>
    <div class="grid2" style="margin-top:16px">
      ${field('Date', `<input type="date" name="date" value="${esc(f.date || today())}" required>`)}
      ${ty === 'lend' ? field('Give back by (optional)', `<input type="date" name="dueDate" value="${esc(f.dueDate || '')}">`) : field('Note', `<input name="note" value="${esc(f.note || '')}" placeholder="optional">`)}
    </div>
    ${ty === 'lend' ? `<div style="margin-top:12px">${field('Note', `<input name="note" value="${esc(f.note || '')}" placeholder="optional">`)}</div>` : ''}
    <div class="sheet-actions">
      ${editing ? '' : `<button type="button" class="btn tonal" id="ef-more">Save & add another</button>`}
      <button class="btn filled" type="submit">${ic('check')}Save</button>
    </div>
  </form>`);
  const form = s.querySelector('#ef');
  wireMore(form);
  const amt = s.querySelector('#ef-amount'), hint = s.querySelector('#ef-hint');
  amt.oninput = () => { const v = evalAmount(amt.value); hint.textContent = /[+\-*/]/.test(amt.value) && v > 0 ? '= ' + inr(v) : 'You can type sums like 250+120'; };
  amt.oninput();
  form.onchange = e => {
    const n = e.target.name;
    if (n === 'type') { Object.assign(f, readForm(form), { type: e.target.value }); if (f.type !== ty && (ty === 'income' || f.type === 'income')) f.categoryId = ''; renderEntry(f); }
    else if (n === 'accountId') { const m = ACC_T[X().acc.get(e.target.value)?.type]?.mode; const r = m && form.querySelector(`#ef-modes input[value="${m}"]`); if (r) r.checked = true; }
    else if (n === 'personId') s.querySelector('#ef-newp').classList.toggle('hide', e.target.value !== '__new');
    else if (n === 'storeId' && e.target.value && !form.querySelector('input[name=categoryId]:checked')) {
      const c = catForStore(e.target.value), r = c && form.querySelector(`input[name=categoryId][value="${c}"]`);
      if (r) { r.closest('.chip').classList.remove('extra'); r.checked = true; }
    }
  };
  const paste = s.querySelector('#ef-paste'); if (paste) paste.onclick = () => openPasteSheet();
  form.onsubmit = e => { e.preventDefault(); submitEntry(f, form, false); };
  const more = s.querySelector('#ef-more'); if (more) more.onclick = () => submitEntry(f, form, true);
  const del = s.querySelector('#ef-del');
  if (del) del.onclick = () => { closeSheet(); removeMany([['txns', f.id]], 'Entry deleted'); };
  if (!editing && !f.amount) setTimeout(() => amt.focus(), 80);
}

function submitEntry(f, form, again) {
  const v = { ...f, ...readForm(form) };
  const amount = evalAmount(v.amount);
  if (!(amount > 0)) { snack('Enter the amount'); form.querySelector('#ef-amount').focus(); return; }
  if (!v.accountId) return snack('Choose an account');
  if (v.type === 'transfer' && (!v.toAccountId || v.toAccountId === v.accountId)) return snack('Choose a different “To” account');
  if (PERSON_T.has(v.type)) {
    if (!v.personId || v.personId === '__new') {
      const n = (v.newPerson || '').trim();
      if (!n) return snack('Type the person’s name');
      const ex = D.people.find(p => p.name.toLowerCase() === n.toLowerCase());
      v.personId = ex ? ex.id : save('people', { name: n }).id;
    }
  }
  const doc = { type: v.type, amount, date: v.date || today(), accountId: v.accountId, mode: v.mode || '', note: (v.note || '').trim() };
  if (f.id) { doc.id = f.id; doc.createdAt = f.createdAt; }
  if (v.type === 'transfer') doc.toAccountId = v.toAccountId;
  if (v.type === 'expense' || v.type === 'income') doc.categoryId = v.categoryId || (D.categories.find(c => c.kind === v.type && /^other/i.test(c.name)) || {}).id || '';
  if (v.type === 'expense') { doc.storeId = v.storeId || ''; doc.forWhom = v.forWhom || 'home'; }
  if (PERSON_T.has(v.type)) doc.personId = v.personId;
  if (v.type === 'lend' && v.dueDate) doc.dueDate = v.dueDate;
  if (f.recurringId) {
    doc.recurringId = f.recurringId;
    const r = D.recurring.find(r => r.id === f.recurringId);
    if (r) save('recurring', { ...r, lastDone: doc.date.slice(0, 7) });
  }
  save('txns', doc);
  lsSet(LS.last, { accountId: doc.accountId, forWhom: doc.forWhom || lsGet(LS.last, {}).forWhom });
  snack(f.id ? 'Entry updated' : `Saved ${inr(amount)}`);
  if (again) renderEntry({ type: doc.type, date: doc.date, accountId: doc.accountId, mode: doc.mode, forWhom: doc.forWhom, categoryId: doc.categoryId, storeId: doc.storeId });
  else closeSheet();
}

/* ============================================================
   Transaction rows
   ============================================================ */
function txTitle(t, x) {
  if (t.type === 'transfer') return 'Transfer';
  if (TT[t.type].verb) return `${TT[t.type].verb} ${x.person.get(t.personId)?.name || '?'}`;
  return x.cat.get(t.categoryId)?.name || TT[t.type].label;
}
function txRow(t, x, accFocus) {
  const tt = TT[t.type] || TT.expense, c = x.cat.get(t.categoryId);
  let sign = tt.sign;
  if (t.type === 'transfer' && accFocus) sign = t.toAccountId === accFocus ? 1 : -1;
  const iconName = (t.type === 'expense' || t.type === 'income') && c ? c.icon : tt.icon;
  const color = t.type === 'transfer' ? '#6b7a83' : PERSON_T.has(t.type) ? '#3f6fb5' : t.type === 'income' ? '#12804a' : colorFor(c?.name || 'x');
  const sub = [t.type === 'transfer' ? `${accLabel(t.accountId, x)} → ${accLabel(t.toAccountId, x)}` : accLabel(t.accountId, x),
    x.store.get(t.storeId)?.name, forWhomLabel(t, x), t.note].filter(Boolean).join(' · ');
  const overdue = t.type === 'lend' && t.dueDate && t.dueDate < today() && (x.owes.get(t.personId) || 0) > 0;
  return `<button class="li" data-act="editEntry" data-id="${t.id}">
    <span class="avatar" style="--c:${color}">${ic(iconName || 'category')}</span>
    <span class="li-text"><span class="li-title">${esc(txTitle(t, x))} ${overdue ? `<span class="tag bad">overdue</span>` : ''}</span><span class="li-sub">${esc(sub)}</span></span>
    <span class="li-end ${sign > 0 ? 'pos' : sign < 0 ? '' : 'muted'}">${sign > 0 ? '+' : sign < 0 ? '−' : ''}${inrAbs(t.amount)}</span>
  </button>`;
}
function txList(list, x, opts = {}) {
  if (!list.length) return `<div class="empty">${ic('receipt_long')}${opts.empty || 'No entries yet'}</div>`;
  const sorted = list.slice().sort(byDateDesc).slice(0, opts.limit || 400);
  const t0 = today(), y = ymd(new Date(Date.now() - 864e5));
  let out = '', cur = '';
  for (const t of sorted) {
    if (!opts.flat && t.date !== cur) {
      cur = t.date;
      const dayOut = sum(sorted.filter(s => s.date === cur && s.type === 'expense'), s => s.amount);
      out += `<div class="day-head"><span>${cur === t0 ? 'Today' : cur === y ? 'Yesterday' : fmtDate(cur)}</span><span>${dayOut ? 'spent ' + inr(dayOut) : ''}</span></div>`;
    }
    out += txRow(t, x, opts.acc);
  }
  if (list.length > sorted.length) out += `<div class="empty">Showing latest ${sorted.length} of ${list.length}. Use the filters to narrow down.</div>`;
  return out;
}

/* ============================================================
   Home
   ============================================================ */
function bookFilterChips() {
  return `<div class="chips scroll">${[{ id: 'all', name: 'All books' }, ...booksSorted()].map(b =>
    `<button class="chip ${UI.book === b.id ? 'on' : ''}" data-act="setBook" data-id="${b.id}">${UI.book === b.id ? ic('check') : ''}${esc(b.name)}</button>`).join('')}</div>`;
}
const inBook = (t, x) => UI.book === 'all' || txBook(t, x) === UI.book || (t.type === 'transfer' && x.acc.get(t.toAccountId)?.bookId === UI.book);

function donut(parts) {
  const total = sum(parts, p => p.value) || 1;
  let off = 0;
  const segs = parts.map(p => { const pct = p.value / total * 100; const s = `<circle r="15.915" cx="21" cy="21" stroke="${p.color}" stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${25 - off}"></circle>`; off += pct; return s; }).join('');
  return `<svg class="donut" viewBox="0 0 42 42" role="img"><circle r="15.915" cx="21" cy="21" stroke="var(--sc-highest)"></circle>${segs}</svg>`;
}
function spendBreakdown(list, x, key, limit = 6) {
  const m = new Map();
  for (const t of list) { const k = key(t) || '—'; m.set(k, (m.get(k) || 0) + num(t.amount)); }
  const rows = [...m].sort((a, b) => b[1] - a[1]);
  const top = rows.slice(0, limit), rest = sum(rows.slice(limit), r => r[1]);
  if (rest) top.push(['Others', rest]);
  return top;
}

function attention(x) {
  const items = [], t0 = today(), k = thisMonth();
  for (const ch of D.chits.filter(c => !c.closed)) {
    const ci = chitInfo(ch);
    if (ci.overdue.length) items.push({ icon: 'warning', cls: 'bad', title: `${ch.name}: ${ci.overdue.length} payment${ci.overdue.length > 1 ? 's' : ''} overdue`, sub: `${inr(sum(ci.overdue, o => o.due))} pending · ${[...new Set(ci.overdue.map(o => o.member.name))].slice(0, 3).join(', ')}`, go: `#/chit/${ch.id}` });
    if (ci.cur >= 1 && ci.cur <= ci.months && !ci.drawOf.get(ci.cur)) items.push({ icon: 'casino', cls: 'info', title: `${ch.name}: draw for month ${ci.cur} pending`, sub: `${fmtMonth(ci.monthKey(ci.cur))} · ${ci.members.length - ci.winner.size} names left`, go: `#/chit/${ch.id}` });
    for (const d of ci.draws.filter(d => !d.paid)) items.push({ icon: 'paid', cls: 'warn', title: `${ch.name}: pay ${inr(d.payout)} to ${ci.memberById.get(d.memberId)?.name || 'winner'}`, sub: `Winner of month ${d.month}`, go: `#/chit/${ch.id}` });
  }
  for (const a of D.accounts.filter(a => a.type === 'card' && !a.archived)) {
    const due = cardDue(a, x);
    if (due && due.days <= 7) items.push({ icon: 'credit_card', cls: due.days <= 2 ? 'bad' : 'warn', title: `${a.name} bill ${inr(due.amount)}`, sub: due.days === 0 ? 'Due today' : `Due in ${due.days} day${due.days > 1 ? 's' : ''} (${fmtDay(due.date)})`, go: `#/account/${a.id}` });
  }
  for (const r of D.recurring) {
    if (r.lastDone === k || r.paused) continue;
    const day = `${k}-${pad(Math.min(+r.day || 1, daysIn(k)))}`;
    const d = daysBetween(t0, day);
    if (d <= 3) items.push({ icon: 'event_repeat', cls: d < 0 ? 'bad' : 'info', title: `${r.name} ${inr(r.amount)}`, sub: d < 0 ? `Was due ${fmtDay(day)}` : d === 0 ? 'Due today' : `Due ${fmtDay(day)}`, act: `data-act="recurNow" data-id="${r.id}"`, btn: 'Add' });
  }
  for (const p of D.people) {
    const bal = x.owes.get(p.id) || 0;
    if (bal <= 0) continue;
    const od = D.txns.filter(t => t.personId === p.id && t.type === 'lend' && t.dueDate && t.dueDate < t0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    if (od) items.push({ icon: 'handshake', cls: 'bad', title: `${p.name} owes you ${inr(bal)}`, sub: `Was to be returned by ${fmtDate(od.dueDate)}`, go: `#/person/${p.id}` });
  }
  return items;
}

function pageHome() {
  const x = X(), k = UI.homeMonth || thisMonth();
  const books = UI.book === 'all' ? booksSorted() : booksSorted().filter(b => b.id === UI.book);
  const accs = D.accounts.filter(a => !a.archived && books.some(b => b.id === a.bookId));
  const byType = t => sum(accs.filter(a => a.type === t), a => accValue(a, x));
  const total = sum(accs, a => accValue(a, x));
  const cardOut = -byType('card');
  const chitHeld = sum(accs, a => x.chitHeld.get(a.id) || 0);
  const exp = D.txns.filter(t => t.type === 'expense' && t.date.startsWith(k) && inBook(t, x));
  const inc = D.txns.filter(t => t.type === 'income' && t.date.startsWith(k) && inBook(t, x));
  const prevK = addMonths(k, -1);
  const prevExp = sum(D.txns.filter(t => t.type === 'expense' && t.date.startsWith(prevK) && inBook(t, x)), t => t.amount);
  const spent = sum(exp, t => t.amount);
  const cats = spendBreakdown(exp, x, t => t.categoryId, 5).map(([id, v], i) => ({ name: x.cat.get(id)?.name || (id === 'Others' ? 'Others' : 'Other'), value: v, color: PALETTE[i % PALETTE.length] }));
  const shops = spendBreakdown(exp.filter(t => t.storeId), x, t => t.storeId, 5);
  const att = attention(x);
  const owedToMe = sum(D.people, p => Math.max(0, x.owes.get(p.id) || 0));
  const iOwe = sum(D.people, p => Math.max(0, -(x.owes.get(p.id) || 0)));
  const recent = D.txns.filter(t => inBook(t, x));

  const bookTiles = UI.book === 'all' ? booksSorted().map(b => {
    const v = sum(accsOf(b.id), a => accValue(a, x));
    return `<button class="stat" data-act="setBook" data-id="${b.id}"><span>${esc(b.name)}</span><b>${inr(v)}</b></button>`;
  }).join('') : '';

  const body = `
    ${bookFilterChips()}
    <div class="cols two" style="margin-top:12px">
      <div class="stack">
        <div class="card primary">
          <div class="hero-label">${UI.book === 'all' ? 'Total money (all books)' : esc(D.books.find(b => b.id === UI.book)?.name) + ' – total money'}</div>
          <div class="hero-num">${inr(total)}</div>
          <div class="stats">
            <a class="stat" href="#/accounts"><span>Cash</span><b>${inr(byType('cash'))}</b></a>
            <a class="stat" href="#/accounts"><span>Bank</span><b>${inr(byType('bank') + byType('wallet'))}</b></a>
            ${accs.some(a => a.type === 'invest') ? `<a class="stat" href="#/accounts"><span>Invested</span><b>${inr(byType('invest'))}</b></a>` : ''}
            ${accs.some(a => a.type === 'card') ? `<a class="stat" href="#/accounts"><span>Card due</span><b>${inr(cardOut)}</b></a>` : ''}
            ${bookTiles}
          </div>
          ${chitHeld > 0 ? `<div class="hero-label" style="margin-top:10px">${ic('info', 'sm')} Includes ${inr(chitHeld)} chit money you are holding</div>` : ''}
        </div>
        <div class="btn-row"><button class="btn tonal" data-act="paste">${ic('content_paste')}Paste bank SMS / UPI message</button></div>
        ${balancesCard(x, accs)}
        ${att.length ? `<div class="card flush"><div class="card-title" style="padding:4px 16px 0">${ic('notifications')}Needs attention</div>
          ${att.slice(0, 8).map(a => `<${a.go ? `a href="${a.go}"` : 'div'} class="li ${a.go ? '' : 'static'}" ${a.act && !a.btn ? a.act : ''}>
            <span class="avatar" style="--c:${a.cls === 'bad' ? 'var(--error)' : a.cls === 'warn' ? '#c8742a' : 'var(--tertiary)'}">${ic(a.icon)}</span>
            <span class="li-text"><span class="li-title">${esc(a.title)}</span><span class="li-sub">${esc(a.sub)}</span></span>
            ${a.btn ? `<button class="btn tonal sm" ${a.act}>${a.btn}</button>` : ic('chevron_right', 'muted')}</${a.go ? 'a' : 'div'}>`).join('')}</div>` : ''}
        ${owedToMe || iOwe ? `<a class="card" href="#/people" style="display:block;color:inherit"><div class="stats">
          <div class="stat"><span>Others owe you</span><b class="pos">${inr(owedToMe)}</b></div>
          <div class="stat"><span>You owe others</span><b class="${iOwe ? 'neg' : ''}">${inr(iOwe)}</b></div></div></a>` : ''}
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-title">${ic('pie_chart')}<span style="flex:1">Spending</span>${monthNav('homeMonth', k, fmtMonth(k))}</div>
          <div class="stats" style="margin-bottom:16px">
            <div class="stat"><span>Spent</span><b>${inr(spent)}</b></div>
            <div class="stat"><span>Income</span><b class="pos">${inr(sum(inc, t => t.amount))}</b></div>
            <div class="stat"><span>vs ${MON[+prevK.slice(5) - 1]}</span><b class="${spent > prevExp ? 'neg' : 'pos'}">${prevExp ? (spent >= prevExp ? '▲ ' : '▼ ') + inrAbs(spent - prevExp) : '—'}</b></div>
          </div>
          ${cats.length ? `<div class="donut-wrap">${donut(cats)}<div class="legend">${cats.map(c => `<div><i style="background:${c.color}"></i><span>${esc(c.name)}</span><b>${inr(c.value)}</b></div>`).join('')}</div></div>` : `<div class="empty">${ic('pie_chart')}No spending in ${fmtMonth(k)}</div>`}
          ${shops.length ? `<div class="form-label" style="margin-top:20px">Top shops</div><div class="bars">${shops.map(([id, v]) => `<div class="bar-row"><span>${ic(x.store.get(id)?.icon || 'storefront')}${esc(x.store.get(id)?.name || id)}</span><b>${inr(v)}</b><div class="track"><i style="width:${v / shops[0][1] * 100}%"></i></div></div>`).join('')}</div>` : ''}
          <div class="btn-row" style="margin-top:12px"><a class="btn text" href="#/reports">${ic('bar_chart')}Full report</a></div>
        </div>
        <div class="card flush">
          <div class="card-title" style="padding:4px 16px 0">${ic('receipt_long')}<span style="flex:1">Recent entries</span><a class="btn text sm" href="#/txns">See all</a></div>
          ${txList(recent.slice().sort(byDateDesc).slice(0, 6), x, { flat: true, empty: 'Tap “Add entry” to record your first expense' })}
        </div>
      </div>
    </div>`;
  return { title: 'Exsy', body };
}

/* ============================================================
   Entries (all transactions)
   ============================================================ */
function pageTxns() {
  const x = X(), k = UI.txMonth, q = UI.q.trim().toLowerCase();
  let list = D.txns.filter(t => inBook(t, x));
  if (k !== 'all') list = list.filter(t => t.date.startsWith(k));
  if (UI.txType) list = list.filter(t => UI.txType === 'people' ? PERSON_T.has(t.type) : t.type === UI.txType);
  if (UI.txCat) list = list.filter(t => t.categoryId === UI.txCat);
  if (UI.txStore) list = list.filter(t => t.storeId === UI.txStore);
  if (UI.txAcc) list = list.filter(t => t.accountId === UI.txAcc || t.toAccountId === UI.txAcc);
  if (q) list = list.filter(t => [txTitle(t, x), t.note, accLabel(t.accountId, x), x.store.get(t.storeId)?.name, String(t.amount)].join(' ').toLowerCase().includes(q));
  const out = sum(list.filter(t => t.type === 'expense'), t => t.amount), inc = sum(list.filter(t => t.type === 'income'), t => t.amount);
  const sel = (key, opts, label) => `<select class="filter ${UI[key] ? 'on' : ''}" data-ui="${key}" aria-label="${label}"><option value="">${label}</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${UI[key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const anyFilter = UI.txType || UI.txCat || UI.txAcc || UI.txStore;
  const body = `
    <div class="search">${ic('search')}<input id="q" data-ui="q" type="search" placeholder="Search entries, notes, amounts" value="${esc(UI.q)}"></div>
    <div class="filters">
      ${k === 'all' ? `<button class="chip" data-act="txMonthThis">${ic('calendar_month')}All time</button>` : monthNav('txMonth', k, fmtMonth(k)) + `<button class="chip" data-act="txMonthAll">All time</button>`}
    </div>
    <div class="filters">
      ${sel('txType', [...Object.entries(TT).filter(([t]) => !PERSON_T.has(t)).map(([t, v]) => [t, v.label]), ['people', 'Lending / borrowing']], 'Type')}
      ${sel('txCat', D.categories.slice().sort(byName).map(c => [c.id, c.name]), 'Category')}
      ${sel('txStore', D.stores.slice().sort(byName).map(s => [s.id, s.name]), 'Shop')}
      ${sel('txAcc', booksSorted().flatMap(b => accsOf(b.id, true).map(a => [a.id, `${a.name} · ${b.name}`])), 'Account')}
      ${anyFilter ? `<button class="btn text sm" data-act="clearFilters">${ic('filter_alt_off')}Clear</button>` : ''}
    </div>
    ${bookFilterChips().replace('chips scroll', 'chips scroll" style="margin-top:12px')}
    <div class="card" style="margin-top:12px"><div class="stats">
      <div class="stat"><span>Spent</span><b>${inr(out)}</b></div>
      <div class="stat"><span>Income</span><b class="pos">${inr(inc)}</b></div>
      <div class="stat"><span>Entries</span><b>${list.length}</b></div></div></div>
    <div class="card flush" style="margin-top:12px">${txList(list, x, { empty: q || anyFilter ? 'Nothing matches these filters' : 'No entries in this period' })}</div>`;
  return { title: 'Entries', body };
}

/* ============================================================
   Accounts & books
   ============================================================ */
function accSub(a, x) {
  const bits = [ACC_T[a.type]?.label];
  if (a.type === 'card') { const due = cardDue(a, x); if (a.limit) bits.push('limit ' + inr(a.limit)); if (due) bits.push(`due ${fmtDay(due.date)}`); }
  if (a.type === 'invest' && a.value != null && a.value !== '') { const g = num(a.value) - (x.bal.get(a.id) || 0); bits.push(`invested ${inr(x.bal.get(a.id))} · ${g >= 0 ? 'gain' : 'loss'} ${inrAbs(g)}`); }
  const held = x.chitHeld.get(a.id); if (held > 0) bits.push(`incl. chit ${inr(held)}`);
  if (a.archived) bits.push('hidden');
  return bits.filter(Boolean).join(' · ');
}
function accRow(a, x) {
  const v = accValue(a, x);
  return `<a class="li" href="#/account/${a.id}"><span class="avatar" style="--c:${a.type === 'card' ? '#a14d8f' : a.type === 'invest' ? '#3f6fb5' : a.type === 'cash' ? '#2e7d5b' : '#2a8f99'}">${ic(ACC_T[a.type]?.icon || 'wallet')}</span>
    <span class="li-text"><span class="li-title">${esc(a.name)}</span><span class="li-sub">${esc(accSub(a, x))}</span></span>
    <span class="li-end ${v < 0 ? 'neg' : ''}">${a.type === 'card' && v <= 0 ? inrAbs(v) + '<small>outstanding</small>' : inr(v)}</span></a>`;
}
function pageAccounts() {
  const x = X();
  const body = booksSorted().map(b => {
    const accs = accsOf(b.id, true);
    return `<div class="section"><div class="section-head"><h2>${esc(b.name)} <span class="muted" style="font-weight:400">· ${inr(sum(accs.filter(a => !a.archived), a => accValue(a, x)))}</span></h2>
      <button class="icon-btn" data-act="editBook" data-id="${b.id}" aria-label="Edit book">${ic('edit')}</button></div>
      <div class="card flush">${accs.map(a => accRow(a, x)).join('') || `<div class="empty">No accounts</div>`}
      <button class="li" data-act="editAccount" data-book="${b.id}"><span class="avatar">${ic('add')}</span><span class="li-text"><span class="li-title">Add account to ${esc(b.name)}</span></span></button></div></div>`;
  }).join('') + `<div class="btn-row" style="margin-top:16px"><button class="btn tonal" data-act="editBook">${ic('add')}Add a book (person)</button></div>
    <p class="muted" style="margin-top:12px;padding:0 4px">A <b>book</b> is whose money it is (you, Mother, Father…). Each book has its own cash and bank accounts. Balances = opening balance + entries.</p>`;
  return { title: 'Accounts', back: '#/more', body, fabAct: 'editAccount', fabIcon: 'add_card', fabLabel: 'Add account' };
}
function pageAccount(id) {
  const x = X(), a = x.acc.get(id);
  if (!a) return { title: 'Account', back: '#/accounts', body: `<div class="empty">This account was deleted.</div>` };
  const b = x.book.get(a.bookId), bal = x.bal.get(a.id) || 0;
  const list = D.txns.filter(t => t.accountId === id || t.toAccountId === id);
  const k = thisMonth();
  const inM = sum(list.filter(t => t.date.startsWith(k) && (t.toAccountId === id || IN_T.has(t.type))), t => t.amount);
  const outM = sum(list.filter(t => t.date.startsWith(k) && t.accountId === id && (OUT_T.has(t.type) || t.type === 'transfer')), t => t.amount);
  let hero = `<div class="hero-label">${esc(b?.name || '')} · ${esc(ACC_T[a.type]?.label)}</div><div class="hero-num">${inr(bal)}</div>`;
  let extra = '';
  if (a.type === 'card') {
    const due = cardDue(a, x), out = Math.max(0, -bal);
    const others = D.txns.filter(t => t.accountId === id && t.type === 'lend');
    hero = `<div class="hero-label">${esc(a.name)} · outstanding</div><div class="hero-num">${inr(out)}</div>
      <div class="stats">${a.limit ? `<div class="stat"><span>Available</span><b>${inr(num(a.limit) - out)}</b></div>` : ''}
      <div class="stat"><span>Bill due</span><b>${due ? fmtDay(due.date) : '—'}</b></div>
      <div class="stat"><span>Used for others</span><b>${inr(sum(others, t => t.amount))}</b></div></div>`;
    extra = `<button class="btn filled" data-act="payCard" data-id="${id}">${ic('paid')}Pay card bill</button>`;
  } else if (a.type === 'invest') {
    const v = a.value != null && a.value !== '' ? num(a.value) : null;
    hero = `<div class="hero-label">${esc(a.name)} · current value${a.valueDate ? ' on ' + fmtDate(a.valueDate) : ''}</div><div class="hero-num">${inr(v ?? bal)}</div>
      <div class="stats"><div class="stat"><span>Money put in</span><b>${inr(bal)}</b></div>
      ${v != null ? `<div class="stat"><span>${v >= bal ? 'Gain' : 'Loss'}</span><b class="${v >= bal ? 'pos' : 'neg'}">${inrAbs(v - bal)}${bal > 0 ? ` (${round2((v - bal) / bal * 100)}%)` : ''}</b></div>` : ''}</div>`;
    extra = `<button class="btn filled" data-act="updateValue" data-id="${id}">${ic('insights')}Update current value</button>`;
  } else {
    hero += `<div class="stats"><div class="stat"><span>In this month</span><b class="pos">${inr(inM)}</b></div><div class="stat"><span>Out this month</span><b>${inr(outM)}</b></div>
      ${x.chitHeld.get(id) > 0 ? `<div class="stat"><span>Chit money held</span><b>${inr(x.chitHeld.get(id))}</b></div>` : ''}</div>`;
  }
  const body = `<div class="card primary">${hero}</div>
    <div class="btn-row" style="margin-top:12px">${extra}<button class="btn tonal" data-act="addEntry" data-acc="${id}">${ic('add')}Add entry</button><button class="btn outlined" data-act="editAccount" data-id="${id}">${ic('edit')}Edit</button></div>
    <div class="card flush" style="margin-top:12px">${txList(list, x, { acc: id, empty: 'No entries for this account yet' })}</div>
    <p class="muted" style="margin:12px 4px">Opening balance ${inr(a.opening || 0)}${a.openingDate ? ' on ' + fmtDate(a.openingDate) : ''}.</p>`;
  return { title: a.name, back: '#/accounts', body, fabAct: 'addEntry', fabData: `data-acc="${id}"` };
}

function openAccountForm(id, bookId) {
  const a = D.accounts.find(x => x.id === id) || { type: 'bank', bookId: bookId || (UI.book !== 'all' ? UI.book : meBook()?.id), openingDate: today() };
  const used = id && (D.txns.some(t => t.accountId === id || t.toAccountId === id) || D.chitPayments.some(p => p.accountId === id) || D.chitDraws.some(d => d.payoutAccountId === id));
  const s = openSheet(`<form id="af">${sheetHead(id ? 'Edit account' : 'New account', id ? `<button type="button" class="icon-btn" id="af-del" aria-label="Delete">${ic('delete')}</button>` : '')}
    <div class="sheet-body">
      ${field('Account name', `<input name="name" value="${esc(a.name || '')}" placeholder="e.g. SBI, Canara Bank, Cash, Groww" required>`)}
      <div class="form-label">Type</div><div class="chips">${Object.entries(ACC_T).map(([k, v]) => chip('type', k, v.label, a.type === k, v.icon)).join('')}</div>
      <div class="form-label">Whose money (book)</div><div class="chips">${booksSorted().map(b => chip('bookId', b.id, b.name, a.bookId === b.id, 'person')).join('')}</div>
      <div class="grid2">${field(a.type === 'card' ? 'Outstanding at start (enter as minus, e.g. -4500)' : 'Balance at start', `<input name="opening" inputmode="decimal" value="${esc(a.opening ?? '')}" placeholder="0">`)}
        ${field('As on date', `<input type="date" name="openingDate" value="${esc(a.openingDate || '')}">`)}</div>
      ${field('Last 4 digits of account / card (optional)', `<input name="last4" inputmode="numeric" maxlength="4" value="${esc(a.last4 || '')}" placeholder="e.g. 1234">`, 'Helps Exsy pick the right account when you paste a bank SMS.')}
      <div class="grid3 ${a.type === 'card' ? '' : 'hide'}" id="af-card">
        ${field('Card limit', `<input name="limit" inputmode="decimal" value="${esc(a.limit ?? '')}">`)}
        ${field('Bill date (day)', `<input name="statementDay" type="number" min="1" max="31" value="${esc(a.statementDay ?? '')}">`)}
        ${field('Due date (day)', `<input name="dueDay" type="number" min="1" max="31" value="${esc(a.dueDay ?? '')}">`)}</div>
      <div class="${a.type === 'invest' ? '' : 'hide'}" id="af-inv">${field('Current value (optional)', `<input name="value" inputmode="decimal" value="${esc(a.value ?? '')}">`, 'Put money in with a Transfer from your bank; update the value from the Groww app now and then.')}</div>
      <label class="switch-row"><span>Hide this account (closed / not used)</span><input type="checkbox" name="archived" ${a.archived ? 'checked' : ''}></label>
    </div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
  const f = s.querySelector('#af');
  f.onchange = e => { if (e.target.name === 'type') { s.querySelector('#af-card').classList.toggle('hide', e.target.value !== 'card'); s.querySelector('#af-inv').classList.toggle('hide', e.target.value !== 'invest'); } };
  f.onsubmit = e => {
    e.preventDefault();
    const v = readForm(f);
    if (!v.name.trim()) return;
    const op = evalAmount(v.opening);
    save('accounts', { ...a, name: v.name.trim(), type: v.type, bookId: v.bookId, opening: isNaN(op) ? 0 : op, openingDate: v.openingDate || '', limit: v.limit ? num(v.limit) : '', statementDay: v.statementDay || '', dueDay: v.dueDay || '', value: v.value === '' || v.value == null ? (v.type === 'invest' ? '' : a.value ?? '') : num(v.value), valueDate: v.value !== a.value && v.value ? today() : a.valueDate || '', archived: !!v.archived, last4: (v.last4 || '').replace(/\D/g, ''), order: a.order ?? D.accounts.length });
    closeSheet(); snack('Account saved');
  };
  const del = s.querySelector('#af-del');
  if (del) del.onclick = () => {
    if (used) { snack('This account has entries – hide it instead (switch below)'); return; }
    closeSheet(); removeMany([['accounts', id]], 'Account deleted'); go('#/accounts');
  };
}
function openBookForm(id) {
  const b = D.books.find(x => x.id === id) || {};
  const s = openSheet(`<form id="bf">${sheetHead(id ? 'Edit book' : 'New book', id && !b.primary ? `<button type="button" class="icon-btn" id="bf-del" aria-label="Delete">${ic('delete')}</button>` : '')}
    <div class="sheet-body">${field('Whose money', `<input name="name" value="${esc(b.name || '')}" placeholder="e.g. Mother, Father, Sister, Home" required>`)}
    <p class="lead">Each book keeps its own accounts, so you always know whose money is where.</p></div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
  const f = s.querySelector('#bf');
  f.onsubmit = e => { e.preventDefault(); const n = readForm(f).name.trim(); if (!n) return; save('books', { ...b, name: n, order: b.order ?? D.books.length }); closeSheet(); snack('Book saved'); };
  const del = s.querySelector('#bf-del');
  if (del) del.onclick = () => {
    if (D.accounts.some(a => a.bookId === id)) { snack('Move or delete this book’s accounts first'); return; }
    closeSheet(); removeMany([['books', id]], 'Book deleted');
  };
}
function openValueForm(id) {
  const a = D.accounts.find(x => x.id === id); if (!a) return;
  const s = openSheet(`<form id="vf">${sheetHead('Current value – ' + a.name)}<div class="sheet-body">
    <label class="amount-field"><b>₹</b><input name="value" inputmode="decimal" value="${esc(a.value ?? '')}" placeholder="0"></label>
    <p class="lead">Check the current value in the Groww app and type it here. Money put in so far: ${inr(X().bal.get(id))}.</p></div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
  s.querySelector('#vf').onsubmit = e => { e.preventDefault(); const v = evalAmount(readForm(e.target).value); if (isNaN(v)) return; save('accounts', { ...a, value: v, valueDate: today() }); closeSheet(); snack('Value updated'); };
  setTimeout(() => s.querySelector('input').focus(), 80);
}

/* ============================================================
   People (lending / borrowing)
   ============================================================ */
function owesText(v) {
  if (Math.abs(v) < 0.005) return `<span class="muted">Settled</span>`;
  return v > 0 ? `<span class="pos">${inr(v)}</span><small>owes you</small>` : `<span class="neg">${inrAbs(v)}</span><small>you owe</small>`;
}
function pagePeople() {
  const x = X();
  const people = D.people.slice().sort((a, b) => Math.abs(x.owes.get(b.id) || 0) - Math.abs(x.owes.get(a.id) || 0) || byName(a, b));
  const owed = sum(people, p => Math.max(0, x.owes.get(p.id) || 0)), owe = sum(people, p => Math.max(0, -(x.owes.get(p.id) || 0)));
  const body = `<div class="card primary"><div class="stats">
      <div class="stat"><span>Others owe you</span><b>${inr(owed)}</b></div>
      <div class="stat"><span>You owe others</span><b>${inr(owe)}</b></div></div>
      <p class="hero-label" style="margin-top:10px">Lent money from cash, bank or your credit card? Record it here and tick off repayments.</p></div>
    <div class="card flush" style="margin-top:12px">${people.map(p => `<a class="li" href="#/person/${p.id}"><span class="avatar" style="--c:${colorFor(p.name)}">${esc(initials(p.name))}</span>
      <span class="li-text"><span class="li-title">${esc(p.name)}</span><span class="li-sub">${esc([p.relation, p.phone].filter(Boolean).join(' · ') || ' ')}</span></span>
      <span class="li-end">${owesText(x.owes.get(p.id) || 0)}</span></a>`).join('') || `<div class="empty">${ic('handshake')}No people yet. Add family members and friends you lend to.</div>`}</div>`;
  return { title: 'People', body, fabAct: 'editPerson', fabIcon: 'person_add', fabLabel: 'Add person' };
}
function pagePerson(id) {
  const x = X(), p = x.person.get(id);
  if (!p) return { title: 'Person', back: '#/people', body: `<div class="empty">Not found.</div>` };
  const bal = x.owes.get(id) || 0;
  const list = D.txns.filter(t => t.personId === id).sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
  let run = num(p.opening);
  const rows = list.map(t => { run += (t.type === 'lend' || t.type === 'repay' ? 1 : -1) * num(t.amount); return { t, run }; }).reverse();
  const body = `<div class="card primary"><div class="hero-label">${bal > 0 ? `${esc(p.name)} owes you` : bal < 0 ? `You owe ${esc(p.name)}` : 'All settled'}</div>
      <div class="hero-num">${inrAbs(bal)}</div>${p.phone ? `<div class="hero-label">${esc(p.phone)}</div>` : ''}</div>
    <div class="action-row" style="margin-top:12px">
      <button class="act" data-act="addEntry" data-type="lend" data-person="${id}">${ic('north_east')}Lent</button>
      <button class="act" data-act="addEntry" data-type="collect" data-person="${id}">${ic('south_west')}Got back</button>
      <button class="act" data-act="addEntry" data-type="borrow" data-person="${id}">${ic('south_west')}Borrowed</button>
      <button class="act" data-act="addEntry" data-type="repay" data-person="${id}">${ic('north_east')}Repaid</button>
      ${bal > 0 ? `<button class="act" data-act="sharePerson" data-id="${id}">${ic('chat')}Remind</button>` : ''}
      <button class="act" data-act="sharePerson" data-id="${id}">${ic('picture_as_pdf')}Statement</button>
      ${p.phone ? `<a class="act" href="tel:${esc(p.phone)}">${ic('call')}Call</a>` : ''}
      <button class="act" data-act="editPerson" data-id="${id}">${ic('edit')}Edit</button>
    </div>
    <div class="card flush" style="margin-top:12px">
      ${rows.map(({ t, run }) => `<button class="li" data-act="editEntry" data-id="${t.id}"><span class="avatar" style="--c:${t.type === 'lend' || t.type === 'repay' ? '#c8742a' : '#2e7d5b'}">${ic(TT[t.type].icon)}</span>
        <span class="li-text"><span class="li-title">${TT[t.type].label} ${inr(t.amount)} ${t.type === 'lend' && t.dueDate ? `<span class="tag ${t.dueDate < today() && bal > 0 ? 'bad' : ''}">by ${fmtDay(t.dueDate)}</span>` : ''}</span>
        <span class="li-sub">${esc([fmtDate(t.date), t.mode, accLabel(t.accountId, x), t.note].filter(Boolean).join(' · '))}</span></span>
        <span class="li-end"><small>balance</small>${run >= 0 ? inr(run) : inrAbs(run) + ' (you owe)'}</span></button>`).join('')}
      ${num(p.opening) ? `<div class="li static"><span class="avatar">${ic('info')}</span><span class="li-text"><span class="li-title">Opening balance</span><span class="li-sub">Before using Exsy</span></span><span class="li-end">${inr(p.opening)}</span></div>` : ''}
      ${!rows.length && !num(p.opening) ? `<div class="empty">No entries with ${esc(p.name)} yet</div>` : ''}
    </div>`;
  return { title: p.name, back: '#/people', body, fab: false };
}
function openPersonForm(id) {
  const p = D.people.find(x => x.id === id) || {};
  const used = id && D.txns.some(t => t.personId === id);
  const s = openSheet(`<form id="pf">${sheetHead(id ? 'Edit person' : 'New person', id ? `<button type="button" class="icon-btn" id="pf-del" aria-label="Delete">${ic('delete')}</button>` : '')}
    <div class="sheet-body">
      ${field('Name', `<input name="name" value="${esc(p.name || '')}" required placeholder="e.g. Sister, Ravi">`)}
      ${field('Phone (for WhatsApp reminders)', `<input name="phone" type="tel" inputmode="tel" value="${esc(p.phone || '')}" placeholder="10-digit mobile">`)}
      <div class="form-label">Relation</div><div class="chips">${['Family', 'Relative', 'Friend', 'Work', 'Other'].map(r => chip('relation', r, r, p.relation === r)).join('')}</div>
      ${field('Old balance before Exsy', `<input name="opening" inputmode="decimal" value="${esc(p.opening ?? '')}" placeholder="0">`, 'Positive = they owe you. Negative (e.g. -2000) = you owe them.')}
    </div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
  const f = s.querySelector('#pf');
  f.onsubmit = e => {
    e.preventDefault(); const v = readForm(f); if (!v.name.trim()) return;
    const op = evalAmount(v.opening);
    const doc = save('people', { ...p, name: v.name.trim(), phone: v.phone.trim(), relation: v.relation || '', opening: isNaN(op) ? 0 : op });
    closeSheet(); snack('Saved'); if (!id) go('#/person/' + doc.id);
  };
  const del = s.querySelector('#pf-del');
  if (del) del.onclick = () => { if (used) { snack('Delete their entries first'); return; } closeSheet(); removeMany([['people', id]], 'Person deleted'); go('#/people'); };
}
