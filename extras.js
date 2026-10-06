'use strict';
/* Everyday comfort: quick buttons, swipe on entries, pull to refresh + sync status, calendar, search,
   hide amounts, vibration, and the chit "collection day" screen. */

/* ============================================================
   Vibration and hiding amounts
   ============================================================ */
const buzz = (p = 12) => { try { if (lsGet('exsy.buzz', true) && navigator.vibrate) navigator.vibrate(p); } catch { /* not supported */ } };
const privacyOn = () => !!lsGet('exsy.hide', false);
function applyPrivacy() { document.documentElement.classList.toggle('privacy', privacyOn()); }
function togglePrivacy() { lsSet('exsy.hide', !privacyOn()); applyPrivacy(); buzz(); render(); snack(privacyOn() ? 'Amounts hidden – tap the eye to show' : 'Amounts shown'); }
const inrShort = n => { const a = Math.abs(n); const s = a >= 1e7 ? round2(a / 1e7) + 'Cr' : a >= 1e5 ? round2(a / 1e5) + 'L' : a >= 1e3 ? Math.round(a / 100) / 10 + 'k' : String(Math.round(a)); return (n < 0 ? '−' : '') + '₹' + s; };

/* ============================================================
   Sync status + pull to refresh
   ============================================================ */
let lastSyncAt = 0;
const pendingColls = new Set();
const ago = t => { if (!t) return 'a moment ago'; const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : fmtDate(ymd(new Date(t))); };
function syncLine() {
  let txt;
  if (store.kind !== 'cloud') txt = `${ic('phone_android', 'sm')}Saved on this phone · <a href="#/sync">turn on sync</a>`;
  else if (!navigator.onLine) txt = `${ic('cloud_off', 'sm')}Offline – ${pendingColls.size ? 'your changes will upload when back online' : 'showing saved data'}`;
  else if (pendingColls.size) txt = `${ic('cloud_upload', 'sm')}Uploading changes…`;
  else txt = `${ic('cloud_done', 'sm')}Synced ${ago(lastSyncAt)} · pull down to refresh`;
  return `<div class="sync-line">${txt}</div>`;
}
function refreshNow() {
  buzz();
  if (store.kind === 'cloud' && store.refresh) { store.refresh(); snack(navigator.onLine ? 'Checking for changes…' : 'Offline – will sync when back online'); }
  else snack('Up to date');
  scheduleRender();
}
(function pullToRefresh() {
  let y0 = null, dy = 0, el = null;
  const ind = () => { if (!el) { el = document.createElement('div'); el.className = 'ptr'; el.innerHTML = ic('refresh'); document.body.appendChild(el); } return el; };
  addEventListener('touchstart', e => { y0 = window.scrollY <= 0 && !sheetOpen && !locked && store && e.touches.length === 1 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  addEventListener('touchmove', e => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    const i = ind();
    if (dy <= 10) { i.classList.remove('show', 'ready'); return; }
    const d = Math.min(dy, 140);
    i.classList.add('show'); i.classList.toggle('ready', dy > 90);
    i.style.transform = `translate(-50%, ${d * 0.55}px) rotate(${d * 2.5}deg)`;
  }, { passive: true });
  addEventListener('touchend', () => {
    if (y0 == null) return;
    const go = dy > 90; y0 = null;
    if (el) { el.classList.remove('show', 'ready'); el.style.transform = ''; }
    if (go) refreshNow();
  }, { passive: true });
})();

/* ============================================================
   Swipe an entry: left = delete (Undo), right = copy to today
   ============================================================ */
let suppressClick = false;
function duplicateTxn(id) {
  const t = D.txns.find(x => x.id === id); if (!t) return;
  const { id: _i, createdAt: _c, updatedAt: _u, recurringId: _r, ...rest } = t;
  const n = save('txns', { ...rest, date: today() });
  snack(`Copied to today: ${txTitle(n, X())} ${inr(n.amount)}`, { label: 'Undo', fn: () => removeDoc('txns', n.id) });
}
(function swipeRows() {
  let row = null, x0 = 0, y0 = 0, dx = 0, active = false, pid = null;
  document.addEventListener('pointerdown', e => {
    const r = e.target.closest('.swipe');
    if (!r || e.button > 0) return;
    row = r; x0 = e.clientX; y0 = e.clientY; dx = 0; active = false; pid = e.pointerId;
  });
  document.addEventListener('pointermove', e => {
    if (!row || e.pointerId !== pid) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!active) {
      if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) { active = true; row.classList.add('swiping'); }
      else { if (Math.abs(my) > 12) row = null; return; }
    }
    dx = mx;
    row.querySelector('.li').style.transform = `translateX(${dx}px)`;
    row.classList.toggle('to-del', dx < 0);
    const armed = Math.abs(dx) > 96;
    if (armed !== row.classList.contains('armed')) { row.classList.toggle('armed', armed); if (armed) buzz(8); }
  });
  const end = () => {
    if (!row) return;
    const r = row, d = dx, was = active; row = null;
    r.querySelector('.li').style.transform = '';
    r.classList.remove('swiping', 'armed', 'to-del');
    if (!was) return;
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 80);
    if (Math.abs(d) > 96) { buzz(20); if (d < 0) removeMany([['txns', r.dataset.id]], 'Entry deleted'); else duplicateTxn(r.dataset.id); }
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  document.addEventListener('click', e => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; } }, true);
})();

/* ============================================================
   Quick buttons: save an entry once, then one tap records it again
   (kept in prefs/quick so no new Firestore collection is needed)
   ============================================================ */
const quickItems = () => (D.prefs.find(p => p.id === 'quick') || {}).items || [];
function saveQuickItems(items) { const doc = D.prefs.find(p => p.id === 'quick') || { id: 'quick' }; save('prefs', { ...doc, items }); }
function quickLabel(t, x) {
  if (PERSON_T.has(t.type)) return txTitle(t, x);
  if (t.type === 'transfer') return `${x.acc.get(t.accountId)?.name || ''} → ${x.acc.get(t.toAccountId)?.name || ''}`;
  return [x.store.get(t.storeId)?.name, x.cat.get(t.categoryId)?.name].filter(Boolean).join(' · ') || TT[t.type].label;
}
function addQuick(t) {
  const x = X(), items = quickItems();
  const q = { type: t.type, amount: t.amount, accountId: t.accountId, toAccountId: t.toAccountId || '', categoryId: t.categoryId || '', storeId: t.storeId || '',
    forWhom: t.forWhom || '', mode: t.mode || '', personId: t.personId || '', note: t.note || '', label: quickLabel(t, x),
    icon: (t.type === 'expense' || t.type === 'income') && x.cat.get(t.categoryId)?.icon || TT[t.type].icon };
  saveQuickItems([...items.filter(i => i.label !== q.label || i.amount !== q.amount), q].slice(-12));
}
function quickRow() {
  const items = quickItems();
  if (!items.length) return `<p class="muted quick-hint">${ic('bolt', 'sm')} Tip: tick “Also add as a quick button” when saving an entry – next time it is one tap.</p>`;
  return `<div class="quick-row">${items.map((q, i) => `<button class="quick" data-act="quickUse" data-i="${i}" title="Save ${esc(q.label)} for today">
      <span class="avatar" style="--c:${q.type === 'income' ? '#12804a' : colorFor(q.label)}">${ic(q.icon || 'bolt')}</span><span class="quick-text"><b>${esc(q.label)}</b><small>${q.amount ? inr(q.amount) : 'ask amount'}</small></span></button>`).join('')}
    <button class="quick ghost" data-act="quickEdit" aria-label="Edit quick buttons">${ic('edit')}</button></div>`;
}
function useQuick(i) {
  const q = quickItems()[i]; if (!q) return;
  const { label, icon, ...f } = q;
  const okAcc = D.accounts.some(a => a.id === f.accountId && !a.archived) && (f.type !== 'transfer' || D.accounts.some(a => a.id === f.toAccountId));
  if (!f.amount || !okAcc || (PERSON_T.has(f.type) && !D.people.some(p => p.id === f.personId))) { openEntry({ ...f, amount: f.amount ? String(f.amount) : '' }); return; }
  const t = save('txns', { ...f, date: today() });
  buzz();
  snack(`Saved ${label} ${inr(f.amount)}`, { label: 'Undo', fn: () => removeDoc('txns', t.id) });
}
function openQuickEdit() {
  const items = quickItems();
  const s = openSheet(`${sheetHead('Quick buttons')}
    <p class="lead">One tap on Home saves these for today. Rename, reorder or remove them here. To add one, tick “Also add as a quick button” when saving an entry.</p>
    <div class="card flush" style="margin-top:12px">${items.map((q, i) => `<div class="li static">
      <span class="avatar" style="--c:${colorFor(q.label)}">${ic(q.icon || 'bolt')}</span>
      <span class="li-text"><input class="plain-input" data-qi="${i}" value="${esc(q.label)}" aria-label="Name"><span class="li-sub">${q.amount ? inr(q.amount) : 'asks amount'} · ${esc(accLabel(q.accountId, X()))}</span></span>
      <button class="icon-btn" data-qup="${i}" aria-label="Move up" ${i ? '' : 'disabled'}>${ic('arrow_upward')}</button>
      <button class="icon-btn" data-qdel="${i}" aria-label="Remove">${ic('delete')}</button></div>`).join('') || `<div class="empty">${ic('bolt')}No quick buttons yet</div>`}</div>
    <div class="sheet-actions"><button class="btn filled" id="qe-done">${ic('check')}Done</button></div>`);
  const cur = () => quickItems().slice();
  $$('[data-qi]', s).forEach(inp => inp.onchange = () => { const it = cur(); it[+inp.dataset.qi].label = inp.value.trim() || it[+inp.dataset.qi].label; saveQuickItems(it); });
  $$('[data-qup]', s).forEach(b => b.onclick = () => { const it = cur(), i = +b.dataset.qup; [it[i - 1], it[i]] = [it[i], it[i - 1]]; saveQuickItems(it); openQuickEdit(); });
  $$('[data-qdel]', s).forEach(b => b.onclick = () => { const it = cur(); it.splice(+b.dataset.qdel, 1); saveQuickItems(it); openQuickEdit(); });
  s.querySelector('#qe-done').onclick = () => closeSheet();
}

/* ============================================================
   Calendar
   ============================================================ */
function pageCalendar() {
  const x = X(), k = UI.calMonth || thisMonth();
  const first = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).getDay(), n = daysIn(k);
  const list = D.txns.filter(t => t.date.startsWith(k) && inBook(t, x));
  const spent = {}, inc = {}, cnt = {};
  for (const t of list) {
    const d = +t.date.slice(8, 10); cnt[d] = (cnt[d] || 0) + 1;
    if (t.type === 'expense') spent[d] = (spent[d] || 0) + num(t.amount);
    if (t.type === 'income') inc[d] = (inc[d] || 0) + num(t.amount);
  }
  const max = Math.max(1, ...Object.values(spent));
  const t0 = today(), sel = UI.calDay && UI.calDay.startsWith(k) ? UI.calDay : k === thisMonth() ? t0 : `${k}-01`;
  const lastDay = k === thisMonth() ? +t0.slice(8) : k < thisMonth() ? n : 0;
  const noSpend = Array.from({ length: lastDay }, (_, i) => i + 1).filter(d => !spent[d]).length;
  const cells = Array.from({ length: first }, () => '<span></span>').join('') + Array.from({ length: n }, (_, i) => {
    const d = i + 1, date = `${k}-${pad(d)}`, sp = spent[d] || 0;
    return `<button class="cal-day ${date === t0 ? 'today' : ''} ${date === sel ? 'sel' : ''} ${date > t0 ? 'future' : ''}" data-act="calDay" data-d="${date}" style="--h:${sp ? 0.12 + 0.6 * sp / max : 0}">
      <span class="cal-n">${d}</span>${sp ? `<span class="cal-amt">${inrShort(sp)}</span>` : ''}${inc[d] ? '<i class="cal-dot"></i>' : ''}</button>`;
  }).join('');
  const dayList = list.filter(t => t.date === sel);
  const body = `${bookFilterChips()}
    <div class="card" style="margin-top:12px">
      <div class="card-title"><span style="flex:1">${fmtMonth(k)}</span>${monthNav('calMonth', k, '')}</div>
      <div class="cal-head">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(w => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="legend-row"><span><i style="background:color-mix(in srgb,#c8742a 55%,transparent)"></i>More spent</span><span><i style="background:var(--pos);border-radius:50%"></i>Money received</span></div>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><span>Spent</span><b>${inr(sum(Object.values(spent)))}</b></div>
        <div class="stat"><span>Income</span><b class="pos">${inr(sum(Object.values(inc)))}</b></div>
        <div class="stat"><span>No-spend days</span><b>${noSpend}</b></div>
      </div>
    </div>
    <div class="section-head" style="margin-top:12px"><h2>${fmtDate(sel)}</h2><button class="btn tonal sm" data-act="addEntryOn" data-d="${sel}">${ic('add')}Add on this day</button></div>
    <div class="card flush">${txList(dayList, x, { flat: true, empty: 'Nothing on this day' })}</div>`;
  return { title: 'Calendar', back: '#/txns', body, fabAct: 'addEntryOn', fabData: `data-d="${sel}"` };
}

/* ============================================================
   Search everything
   ============================================================ */
function openSearch() {
  const s = openSheet(`${sheetHead('Search')}
    <div class="search">${ic('search')}<input id="gs" type="search" placeholder="Name, shop, note or amount" autocomplete="off"></div>
    <div id="gs-res" style="margin-top:8px"></div>`);
  const inp = s.querySelector('#gs'), out = s.querySelector('#gs-res');
  const run = () => { const q = inp.value.trim().toLowerCase(); out.innerHTML = q.length < 2 ? '<p class="lead" style="padding:12px 4px">Type at least 2 letters or an amount.</p>' : searchHtml(q); };
  inp.oninput = run; run();
  setTimeout(() => inp.focus(), 80);
}
function searchHtml(q) {
  const x = X(), has = v => String(v ?? '').toLowerCase().includes(q), qn = q.replace(/[,₹\s]/g, '');
  const sec = (title, rows) => rows.length ? `<div class="form-label">${title}</div><div class="card flush">${rows.join('')}</div>` : '';
  const row = (act, icon, color, title, sub, end = '') => `<button class="li" ${act}><span class="avatar" style="--c:${color}">${icon}</span>
    <span class="li-text"><span class="li-title">${esc(title)}</span><span class="li-sub">${esc(sub)}</span></span><span class="li-end">${end}</span></button>`;
  const people = D.people.filter(p => has(p.name) || has(p.phone)).slice(0, 8).map(p => { const b = x.owes.get(p.id) || 0;
    return row(`data-act="goto" data-href="#/person/${p.id}"`, esc(initials(p.name)), colorFor(p.name), p.name, p.relation || 'Person', b ? (b > 0 ? `<span class="pos">${inr(b)}</span><small>owes you</small>` : `${inrAbs(b)}<small>you owe</small>`) : ''); });
  const members = D.chitMembers.filter(m => has(m.name) || has(m.phone)).slice(0, 8).map(m => { const ch = D.chits.find(c => c.id === m.chitId);
    return row(`data-act="memberInfo" data-id="${m.id}"`, esc(initials(m.name)), colorFor(m.name), m.name, `Chit member · ${ch?.name || ''}`); });
  const chits = D.chits.filter(c => has(c.name)).map(c => row(`data-act="goto" data-href="#/chit/${c.id}"`, ic('groups'), '#3f6fb5', c.name, `${inr(c.monthly)} a month`));
  const accs = D.accounts.filter(a => has(a.name) || has(x.book.get(a.bookId)?.name)).slice(0, 8).map(a => row(`data-act="goto" data-href="#/account/${a.id}"`, ic(ACC_T[a.type]?.icon || 'wallet'), '#2a8f99', accLabel(a.id, x), ACC_T[a.type]?.label, inr(accValue(a, x))));
  const txns = D.txns.filter(t => has(txTitle(t, x)) || has(t.note) || has(x.store.get(t.storeId)?.name) || (/^\d+(\.\d+)?$/.test(qn) && String(t.amount).includes(qn))).sort(byDateDesc);
  const html = sec('People', people) + sec('Chit members', members) + sec('Chits', chits) + sec('Accounts', accs)
    + (txns.length ? `<div class="form-label">Entries (${txns.length})</div><div class="card flush">${txns.slice(0, 30).map(t => txRow(t, x)).join('')}</div>` : '');
  return html || `<div class="empty">${ic('search')}Nothing found for “${esc(q)}”</div>`;
}

/* ============================================================
   Chit collection day: everyone who still has to pay, most overdue first
   ============================================================ */
function collectList() {
  const t0 = today(), rows = [];
  for (const ch of D.chits.filter(c => !c.closed)) {
    const ci = chitInfo(ch);
    for (const mb of ci.members) {
      const months = [];
      for (let m = 1; m <= Math.min(ci.cur, ci.months); m++) { const due = ci.monthly - ci.paidOf(mb.id, m); if (due > 0.005) months.push({ m, due, late: t0 > ci.dueDate(m) ? daysBetween(ci.dueDate(m), t0) : 0 }); }
      if (months.length) rows.push({ ci, mb, months, total: sum(months, o => o.due), late: Math.max(...months.map(o => o.late)) });
    }
  }
  return rows.sort((a, b) => b.late - a.late || b.total - a.total);
}
function pageCollect() {
  const rows = collectList(), t0 = today();
  const gotToday = sum(D.chitPayments.filter(p => p.date === t0), p => p.amount);
  const body = `<div class="card primary">
      <div class="hero-label">Still to collect</div><div class="hero-num">${inr(sum(rows, r => r.total))}</div>
      <div class="stats"><div class="stat"><span>Collected today</span><b>${inr(gotToday)}</b></div>
        <div class="stat"><span>Members to visit</span><b>${rows.length}</b></div>
        <div class="stat"><span>Overdue</span><b>${rows.filter(r => r.late).length}</b></div></div></div>
    <div class="card flush" style="margin-top:12px">${rows.map(r => {
      const { ci, mb } = r, first = r.months[0];
      const msg = `Hi ${mb.name}, gentle reminder for chit "${ci.ch.name}": ${r.months.map(o => `month ${o.m} (${fmtMonth(ci.monthKey(o.m))}) ${inr(o.due)}`).join(', ')} – total ${inr(r.total)}. Thank you!`;
      return `<div class="li"><button class="li" style="padding:0;border:0;flex:1;min-width:0" data-act="memberInfo" data-id="${mb.id}">
        <span class="avatar" style="--c:${r.late ? 'var(--error)' : colorFor(mb.name)}">${esc(initials(mb.name))}</span>
        <span class="li-text"><span class="li-title">${esc(mb.name)} ${r.late ? `<span class="tag bad">${r.late} days late</span>` : `<span class="tag">due ${fmtDay(ci.dueDate(first.m))}</span>`}</span>
        <span class="li-sub">${esc(ci.ch.name)} · ${r.months.map(o => 'M' + o.m).join(', ')} · ${inr(r.total)}</span></span></button>
        ${mb.phone ? `<a class="icon-btn" href="${waLink(mb.phone, msg)}" target="_blank" rel="noopener" aria-label="WhatsApp reminder">${ic('chat')}</a>` : ''}
        <button class="btn tonal sm" data-act="payCell" data-id="${ci.ch.id}" data-mb="${mb.id}" data-m="${first.m}">${ic('check')}Paid</button></div>`;
    }).join('') || `<div class="empty">${ic('task_alt')}Everyone has paid. Nothing to collect.</div>`}</div>
    <p class="muted" style="margin:10px 4px">Most overdue first. “Paid” records the oldest pending month; tap a name for the full statement.</p>`;
  return { title: 'Collection day', back: '#/chits', body, fab: false };
}

/* ============================================================
   Keep the screen current: redraw when the app comes back to the front, and when the date changes
   (pay days, due dates and "today" depend on it)
   ============================================================ */
let shownDay = today();
document.addEventListener('visibilitychange', () => { if (!document.hidden && store) { shownDay = today(); scheduleRender(); } });
window.addEventListener('pageshow', () => { if (store) scheduleRender(); });
setInterval(() => { if (today() !== shownDay && store) { shownDay = today(); scheduleRender(); } }, 60e3);
