'use strict';
/* Reports, More/Settings, Sync, Categories, Recurring, first-run setup, lock screen, actions and start-up */

/* ============================================================
   Reports
   ============================================================ */
function pageReports() {
  const x = X(), mode = UI.repMode;
  const key = mode === 'month' ? UI.repMonth : mode === 'year' ? UI.repYear : '';
  const inPeriod = t => !key || t.date.startsWith(key);
  const list = D.txns.filter(t => inPeriod(t) && inBook(t, x));
  const exp = list.filter(t => t.type === 'expense'), inc = list.filter(t => t.type === 'income');
  const spent = sum(exp, t => t.amount), earned = sum(inc, t => t.amount);
  const bars = (rows, label, iconOf) => {
    const max = rows[0]?.[1] || 1;
    return rows.length ? `<div class="bars">${rows.map(([k, v], i) => `<div class="bar-row"><span>${iconOf ? ic(iconOf(k)) : ''}${esc(label(k))}</span><b>${inr(v)}</b><div class="track"><i style="width:${v / max * 100}%;--c:${PALETTE[i % PALETTE.length]}"></i></div></div>`).join('')}</div>` : `<div class="empty">Nothing in this period</div>`;
  };
  const card = (title, icon, inner) => `<div class="card"><div class="card-title">${ic(icon)}${title}</div>${inner}</div>`;
  const byCat = spendBreakdown(exp, x, t => t.categoryId, 12);
  const byStore = spendBreakdown(exp.filter(t => t.storeId), x, t => t.storeId, 10);
  const byWhom = spendBreakdown(exp, x, t => t.forWhom === 'home' ? 'home' : t.forWhom || txBook(t, x), 10);
  const byAcc = spendBreakdown(exp, x, t => t.accountId, 10);
  const byInc = spendBreakdown(inc, x, t => t.categoryId, 8);
  let trend = '';
  if (mode === 'year') {
    const ms = Array.from({ length: 12 }, (_, i) => `${UI.repYear}-${pad(i + 1)}`);
    const vals = ms.map(k => ({ k, e: sum(exp.filter(t => t.date.startsWith(k)), t => t.amount), i: sum(inc.filter(t => t.date.startsWith(k)), t => t.amount) }));
    const max = Math.max(1, ...vals.map(v => Math.max(v.e, v.i)));
    trend = card('Month by month', 'bar_chart', `<div class="vbars">${vals.map(v => `<button class="vbar" data-act="repMonth" data-k="${v.k}" title="${fmtMonth(v.k)}: spent ${inr(v.e)}, income ${inr(v.i)}"><span class="pair"><i style="height:${v.i / max * 100}%;background:var(--pos)"></i><i style="height:${v.e / max * 100}%;background:#c8742a"></i></span><small>${MON[+v.k.slice(5) - 1][0]}</small></button>`).join('')}</div>
      <div class="legend-row"><span><i style="background:var(--pos)"></i>Income</span><span><i style="background:#c8742a"></i>Spent</span></div>`);
  }
  const lent = sum(list.filter(t => t.type === 'lend'), t => t.amount), got = sum(list.filter(t => t.type === 'collect'), t => t.amount);
  const comm = sum(D.chitDraws.filter(d => !key || (d.drawDate || '').startsWith(key)), d => d.commission);
  const label = mode === 'month' ? fmtMonth(UI.repMonth) : mode === 'year' ? UI.repYear : 'All time';
  const body = `<div class="seg">${[['month', 'Month'], ['year', 'Year'], ['all', 'All time']].map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="repMode" data-k="${k}">${mode === k ? ic('check') : ''}${l}</button>`).join('')}</div>
    <div class="filters" style="justify-content:space-between">${mode === 'all' ? '<b style="font-weight:500;padding:8px 4px">All time</b>' : monthNav(mode === 'month' ? 'repMonth' : 'repYear', key, label)}
      <div class="btn-row"><button class="btn tonal sm" data-act="shareReport">${ic('picture_as_pdf')}PDF</button><button class="btn text sm" data-act="exportCsv">${ic('download')}CSV</button></div></div>
    ${bookFilterChips()}
    <div class="card primary" style="margin-top:12px"><div class="stats">
      <div class="stat"><span>Income</span><b>${inr(earned)}</b></div><div class="stat"><span>Spent</span><b>${inr(spent)}</b></div>
      <div class="stat"><span>Saved</span><b>${inr(earned - spent)}</b></div>
      ${lent || got ? `<div class="stat"><span>Lent / got back</span><b>${inr(lent)} / ${inr(got)}</b></div>` : ''}
      ${comm ? `<div class="stat"><span>Chit commission</span><b>${inr(comm)}</b></div>` : ''}</div></div>
    <div class="cols two" style="margin-top:12px">
      ${trend}
      ${card('Spent by category', 'category', bars(byCat, k => x.cat.get(k)?.name || k, k => x.cat.get(k)?.icon || 'category'))}
      ${card('Spent by shop', 'storefront', bars(byStore, k => x.store.get(k)?.name || k, k => x.store.get(k)?.icon || 'storefront'))}
      ${card('Spent for whom', 'groups', bars(byWhom, k => k === 'home' ? 'Home' : x.book.get(k)?.name || k))}
      ${card('Paid from', 'account_balance_wallet', bars(byAcc, k => k === 'Others' ? k : accLabel(k, x)))}
      ${card('Income by type', 'trending_up', bars(byInc, k => x.cat.get(k)?.name || k, k => x.cat.get(k)?.icon || 'savings'))}
    </div>`;
  return { title: 'Reports', back: '#/more', body };
}
function exportCsv(all) {
  const x = X(), mode = UI.repMode;
  const key = all ? '' : mode === 'month' ? UI.repMonth : mode === 'year' ? UI.repYear : '';
  const rows = D.txns.filter(t => !key || t.date.startsWith(key)).sort((a, b) => a.date.localeCompare(b.date));
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const head = ['Date', 'Type', 'Amount', 'Book', 'Account', 'To account', 'Category', 'Shop', 'For whom', 'Person', 'Paid by', 'Note'];
  const lines = rows.map(t => [t.date, TT[t.type]?.label, t.amount, x.book.get(txBook(t, x))?.name, x.acc.get(t.accountId)?.name, t.toAccountId ? accLabel(t.toAccountId, x) : '',
    x.cat.get(t.categoryId)?.name, x.store.get(t.storeId)?.name, t.forWhom === 'home' ? 'Home' : x.book.get(t.forWhom)?.name, x.person.get(t.personId)?.name, t.mode, t.note].map(q).join(','));
  download(`exsy-entries-${key || 'all'}.csv`, '﻿' + [head.join(','), ...lines].join('\r\n'), 'text/csv');
}

/* ============================================================
   More (menu + settings)
   ============================================================ */
function pageMore() {
  const theme = lsGet(LS.theme, 'auto'), hasPin = !!lsGet(LS.pin, '');
  const item = (href, icon, title, sub, attr = '') => `<${href ? `a href="${href}"` : 'button'} class="li" ${attr}><span class="avatar">${ic(icon)}</span><span class="li-text"><span class="li-title">${title}</span><span class="li-sub">${sub}</span></span>${href ? ic('chevron_right', 'muted') : ''}</${href ? 'a' : 'button'}>`;
  const body = `<div class="card flush">
      ${item('#/accounts', 'account_balance', 'Accounts & books', `${D.books.length} books · ${D.accounts.filter(a => !a.archived).length} accounts`)}
      ${item('#/reports', 'bar_chart', 'Reports', 'Monthly and yearly spending, shops, for whom')}
      ${item('#/mother', 'house', homePayer() ? `${payerName()}’s money & home costs` : 'Home costs', homePayer() ? (() => { const b = motherLedger().balance; return b >= 0 ? `${inr(b)} of ${payerName()}’s money with you` : `${payerName()} owes you ${inr(-b)}`; })() : 'Choose whose money pays for the home')}
      ${item('#/calendar', 'calendar_month', 'Calendar', 'What was spent on each day')}
      ${item('#/collect', 'event_available', 'Chit collection day', 'Everyone who still has to pay, most overdue first')}
      ${item('', 'bolt', 'Quick buttons', `${quickItems().length} one-tap entries on Home`, 'data-act="quickEdit"')}
      ${item('#/recurring', 'event_repeat', 'Monthly bills & salary', `${D.recurring.length} reminders`)}
      ${item('#/cats', 'category', 'Categories & shops', `${D.categories.length} categories · ${D.stores.length} shops`)}
    </div>
    <div class="section-head" style="margin-top:16px"><h2>Settings</h2></div>
    <div class="card flush">
      ${item('#/sync', store.kind === 'cloud' ? 'cloud_done' : 'phone_android', 'Sync & devices', store.kind === 'cloud' ? 'Synced with Firebase – open on phone and laptop' : 'Saved on this device only – turn on sync')}
      ${item('', 'vibration', lsGet('exsy.buzz', true) ? 'Vibration is on' : 'Vibration is off', 'Short buzz when you save, swipe or draw a winner', 'data-act="buzzToggle"')}
      ${item('', privacyOn() ? 'visibility_off' : 'visibility', privacyOn() ? 'Amounts are hidden' : 'Hide amounts', 'Blur all money figures – also the eye icon at the top', 'data-act="privacy"')}
      ${item('', hasPin ? 'lock' : 'lock_open', hasPin ? 'App lock is on' : 'App lock (PIN)', hasPin ? 'Tap to change or remove the PIN' : 'Ask for a 4-digit PIN when the app opens', 'data-act="pin"')}
      <div class="li static"><span class="avatar">${ic('contrast')}</span><span class="li-text"><span class="li-title">Theme</span></span>
        <div class="seg" style="width:220px">${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button class="${theme === k ? 'on' : ''}" data-act="theme" data-k="${k}">${l}</button>`).join('')}</div></div>
    </div>
    <div class="section-head" style="margin-top:16px"><h2>Your data</h2></div>
    <div class="card flush">
      ${item('', 'download', 'Download backup', 'Everything in one file (JSON) – keep it in Google Drive', 'data-act="backup"')}
      ${item('', 'upload', 'Restore from backup', 'Replaces the data in this book with a backup file', 'data-act="restore"')}
      ${item('', 'table_chart', 'Export all entries (CSV)', 'Opens in Excel / Google Sheets', 'data-act="exportAll"')}
      ${item('', 'science', 'Add sample data', 'Fill in example entries and a chit to try things out', 'data-act="sample"')}
      ${item('', 'delete_forever', 'Erase everything', 'Delete all books, entries and chits', 'data-act="erase"')}
    </div>
    <p class="muted" style="margin:16px 4px">Exsy ${APP_VERSION} · ${store.kind === 'cloud' ? 'cloud sync' : 'this device'}</p>`;
  return { title: 'More', body };
}

/* ---------- Sync & devices ---------- */
function joinLink() {
  const code = lsGet(LS.code, ''), cfg = FIREBASE_CONFIG ? null : lsGet(LS.cfg, null);
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(cfg ? { c: code, f: cfg } : { c: code }))));
  return `${location.origin}${location.pathname}#join=${payload}`;
}
function pageSync() {
  const cloud = store.kind === 'cloud', code = lsGet(LS.code, ''), hasCfg = !!(FIREBASE_CONFIG || lsGet(LS.cfg, null));
  const body = cloud ? `<div class="card primary"><div class="card-title">${ic('cloud_done')}Sync is on</div>
      <p>Everything you add is saved to your Firebase database and shows up on all your devices. Works offline too – changes upload when you are back online.</p></div>
    <div class="card" style="margin-top:12px"><div class="card-title">${ic('link')}Open on another device</div>
      <p class="muted" style="margin-bottom:12px">Copy this link and open it <b>once</b> on your laptop or other phone (send it to yourself on WhatsApp). After that the app opens straight to your money book.</p>
      <div class="btn-row"><button class="btn filled" data-act="copyJoin">${ic('content_copy')}Copy device link</button><button class="btn outlined" data-act="showCode">${ic('key')}Show sync code</button></div>
      <p class="muted" style="margin-top:12px">${ic('warning', 'sm')} Anyone with this link or code can see your money book. Keep it private.</p></div>
    <div class="card" style="margin-top:12px"><div class="card-title">${ic('phone_android')}Stop syncing on this device</div>
      <p class="muted" style="margin-bottom:12px">Your data stays in the cloud. This device goes back to the start screen.</p>
      <button class="btn outlined danger" data-act="signOut">Forget sync code on this device</button></div>`
    : `<div class="card"><div class="card-title">${ic('phone_android')}Saved on this device only</div>
      <p class="muted">Your entries are in this browser. Turn on sync to use the same money book on your phone and laptop, with an online backup.</p></div>
      <div class="card" style="margin-top:12px"><div class="card-title">${ic('cloud_sync')}Turn on sync</div>
      ${hasCfg ? `<div class="btn-row"><button class="btn filled" data-act="newCloud">${ic('add')}Create my sync code</button><button class="btn outlined" data-act="enterCode">${ic('key')}I already have a code</button></div>
        <p class="muted" style="margin-top:12px">Your current entries on this device are copied to the cloud.</p>`
        : `<p class="muted" style="margin-bottom:12px">First connect your Firebase project: Firebase console → Project settings → Your apps → Web app → copy the <b>firebaseConfig</b> block and paste it here.</p>
          <label class="field"><span>Firebase config</span><textarea id="cfg-in" rows="7" placeholder='const firebaseConfig = { apiKey: "…", authDomain: "…", projectId: "…", … };'></textarea></label>
          <div class="btn-row" style="margin-top:12px"><button class="btn filled" data-act="saveCfg">${ic('check')}Save config</button></div>`}
      </div>`;
  return { title: 'Sync & devices', back: '#/more', body, fab: false };
}
function parseFirebaseConfig(text) {
  const o = {};
  for (const m of String(text).matchAll(/([A-Za-z]+)\s*:\s*["']([^"']+)["']/g)) o[m[1]] = m[2];
  return o.apiKey && o.projectId ? o : null;
}
async function turnOnCloud(code, copyLocal) {
  const local = copyLocal ? lsGet(LS.local, {}) : null;
  lsSet(LS.code, code); lsSet(LS.mode, 'cloud');
  await connect('cloud');
  if (!store || store.kind !== 'cloud') { render(); return; }
  if (local && Object.values(local).some(c => Object.keys(c || {}).length)) {
    // wait for the cloud listing, then copy this device's data only into an empty cloud book
    const t0 = Date.now();
    while (!ready() && Date.now() - t0 < 10000) await new Promise(r => setTimeout(r, 200));
    if (!D.books.length) {
      let n = 0;
      for (const [c, docs] of Object.entries(local)) for (const [id, d] of Object.entries(docs || {})) { if (COLLS.includes(c)) { save(c, { ...d, id }); n++; } }
      snack(`Copied ${n} records to the cloud`);
    }
  }
  go('#/sync');
}

/* ============================================================
   Categories & shops
   ============================================================ */
function pageCats() {
  const x = X(), tab = UI.catTab;
  const list = tab === 'stores' ? D.stores.slice().sort(byName) : D.categories.filter(c => c.kind === tab).sort(byName);
  const use = tab === 'stores' ? x.storeUse : x.catUse;
  const body = `<div class="seg">${[['expense', 'Expense'], ['income', 'Income'], ['stores', 'Shops']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="catTab" data-k="${k}">${tab === k ? ic('check') : ''}${l}</button>`).join('')}</div>
    <div class="card flush" style="margin-top:12px">${list.map(c => `<button class="li" data-act="editCat" data-id="${c.id}"><span class="avatar" style="--c:${colorFor(c.name)}">${ic(c.icon || 'category')}</span>
      <span class="li-text"><span class="li-title">${esc(c.name)}</span><span class="li-sub">${use.get(c.id) || 0} entries</span></span>${ic('edit', 'muted')}</button>`).join('')}</div>`;
  return { title: 'Categories & shops', back: '#/more', body, fabAct: 'editCat', fabLabel: tab === 'stores' ? 'Add shop' : 'Add category' };
}
function openCatForm(id) {
  const isStore = UI.catTab === 'stores', coll = isStore ? 'stores' : 'categories';
  const c = D[coll].find(x => x.id === id) || { kind: isStore ? undefined : UI.catTab, icon: isStore ? 'storefront' : 'category' };
  const used = id && D.txns.filter(t => (isStore ? t.storeId : t.categoryId) === id).length;
  const s = openSheet(`<form id="ctf">${sheetHead(id ? 'Edit' : isStore ? 'New shop' : 'New category', id ? `<button type="button" class="icon-btn" id="ct-del" aria-label="Delete">${ic('delete')}</button>` : '')}
    <div class="sheet-body">${field('Name', `<input name="name" value="${esc(c.name || '')}" required>`)}
    <div class="form-label">Icon</div><div class="icon-grid">${ICON_CHOICES.map(i => `<label><input type="radio" name="icon" value="${i}" ${c.icon === i ? 'checked' : ''}><span>${ic(i)}</span></label>`).join('')}</div>
    ${used ? `<p class="lead">${used} entries use this. Deleting moves them to “Other”.</p>` : ''}</div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
  s.querySelector('#ctf').onsubmit = e => { e.preventDefault(); const v = readForm(e.target); if (!v.name.trim()) return; save(coll, { ...c, name: v.name.trim(), icon: v.icon || c.icon }); closeSheet(); snack('Saved'); };
  const del = s.querySelector('#ct-del');
  if (del) del.onclick = () => {
    closeSheet();
    const other = isStore ? '' : (D.categories.find(o => o.kind === c.kind && /^other/i.test(o.name) && o.id !== id) || {}).id || '';
    const moved = D.txns.filter(t => (isStore ? t.storeId : t.categoryId) === id);
    moved.forEach(t => save('txns', { ...t, [isStore ? 'storeId' : 'categoryId']: other }));
    removeMany([[coll, id]], 'Deleted' + (moved.length ? ` – ${moved.length} entries moved` : ''));
  };
}

/* ============================================================
   Monthly bills & salary (recurring reminders)
   ============================================================ */
function pageRecurring() {
  const x = X(), k = thisMonth();
  const list = D.recurring.slice().sort((a, b) => (+a.day || 0) - (+b.day || 0));
  const body = `<p class="muted" style="margin:0 4px 12px">Reminders for things that happen every month – salary into ICICI, electricity bill, recharge, rent, EMI. They show on Home a few days before the date; tap “Add” to record them in one tap.</p>
    <div class="card flush">${list.map(r => {
      const done = r.lastDone === k;
      return `<div class="li"><button class="li" style="padding:0;border:0;flex:1;min-width:0" data-act="editRecurring" data-id="${r.id}">
        <span class="avatar" style="--c:${r.type === 'income' ? '#12804a' : colorFor(r.name)}">${ic(x.cat.get(r.categoryId)?.icon || 'event_repeat')}</span>
        <span class="li-text"><span class="li-title">${esc(r.name)}</span><span class="li-sub">${ordinal(+r.day || 1)} of every month · ${inr(r.amount)} · ${esc(accLabel(r.accountId, x))}${r.type === 'transfer' ? ' → ' + esc(accLabel(r.toAccountId, x)) : ''}</span></span></button>
        ${done ? `<span class="tag ok">${ic('check')}Done</span>` : `<button class="btn tonal sm" data-act="recurNow" data-id="${r.id}">Add</button>`}</div>`;
    }).join('') || `<div class="empty">${ic('event_repeat')}No reminders yet</div>`}</div>`;
  return { title: 'Monthly bills & salary', back: '#/more', body, fabAct: 'editRecurring', fabLabel: 'Add reminder' };
}
function openRecurringForm(id, init = {}) {
  const r = D.recurring.find(x => x.id === id) || { type: 'expense', day: 1, accountId: defaultAccount(), ...init };
  const render = () => {
    const cats = D.categories.filter(c => c.kind === r.type);
    const s = openSheet(`<form id="rf">${sheetHead(id ? 'Edit reminder' : 'New reminder', id ? `<button type="button" class="icon-btn" id="rf-del" aria-label="Delete">${ic('delete')}</button>` : '')}
      <div class="sheet-body">
      <div class="chips">${chip('type', 'expense', 'Bill / expense', r.type === 'expense', 'trending_down')}${chip('type', 'income', 'Income', r.type === 'income', 'trending_up')}${chip('type', 'transfer', 'Money to Mother / transfer', r.type === 'transfer', 'swap_horiz')}</div>
      ${field('Name', `<input name="name" value="${esc(r.name || '')}" placeholder="${r.type === 'transfer' ? 'e.g. Monthly money to Mother' : 'e.g. Electricity bill, Salary'}" required>`)}
      <div class="grid2">${field('Usual amount', `<input name="amount" inputmode="decimal" value="${esc(r.amount ?? '')}">`)}${field('Day of month', `<input type="number" name="day" min="1" max="31" value="${esc(r.day)}">`)}</div>
      <div class="form-label">${r.type === 'transfer' ? 'From' : 'Account'}</div>${accChips('accountId', r.accountId)}
      ${r.type === 'transfer' ? `<div class="form-label">To</div>${accChips('toAccountId', r.toAccountId)}`
        : `<div class="form-label">Category</div><div class="chips">${cats.map(c => chip('categoryId', c.id, c.name, c.id === r.categoryId, c.icon)).join('')}</div>`}
      </div>
      <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
    const f = s.querySelector('#rf');
    f.onchange = e => { if (e.target.name === 'type') { Object.assign(r, readForm(f), { categoryId: '' }); render(); } };
    f.onsubmit = e => { e.preventDefault(); const v = readForm(f); if (!v.name.trim()) return; save('recurring', { ...r, ...v, name: v.name.trim(), amount: evalAmount(v.amount) || 0, day: +v.day || 1 }); closeSheet(); snack('Reminder saved'); };
    const del = s.querySelector('#rf-del');
    if (del) del.onclick = () => { closeSheet(); removeMany([['recurring', id]], 'Reminder deleted'); };
  };
  render();
}
function recurNow(id) {
  const r = D.recurring.find(x => x.id === id); if (!r) return;
  openEntry({ type: r.type, amount: r.amount ? String(r.amount) : '', accountId: r.accountId, toAccountId: r.toAccountId, categoryId: r.categoryId, note: r.name, recurringId: r.id, mode: ACC_T[X().acc.get(r.accountId)?.type]?.mode });
}

/* ============================================================
   First run: welcome, setup, sample data
   ============================================================ */
function renderWelcome() {
  const hasCfg = !!(FIREBASE_CONFIG || lsGet(LS.cfg, null));
  app.innerHTML = `<div class="center-screen"><img src="icons/icon-192.png" alt="">
    <h1>Exsy · Money Book</h1>
    <p class="muted" style="text-align:center;max-width:440px">Your money, your mother’s and father’s money, cash and bank, people who owe you, and your chit business – in one place.</p>
    <div class="welcome">
      <button class="card choice" data-act="startLocal">${ic('phone_android')}<div><h3>Start on this device</h3><p>Begin right away. You can turn on sync later and everything is copied.</p></div></button>
      ${hasCfg ? `<button class="card choice" data-act="enterCode">${ic('key')}<div><h3>I have a sync code</h3><p>Open the money book you already use on another device.</p></div></button>` : ''}
      <p class="muted" style="text-align:center;font-size:13px">Got a device link? Just open it – you will be signed in automatically.</p>
    </div></div>`;
}
function renderSetup() {
  app.innerHTML = `<div class="center-screen"><img src="icons/icon-192.png" alt="">
    <h1>Set up your money book</h1>
    <div class="welcome">
      <div class="card"><div class="card-title">${ic('auto_awesome')}Ready-made start</div>
        <div class="kv"><span>Me</span><b>Cash, SBI, Canara Bank, ICICI (salary), Credit card, Groww</b></div>
        <div class="kv"><span>Mother</span><b>Cash, Bank account</b></div>
        <div class="kv"><span>Father</span><b>Cash</b></div>
        <div class="kv"><span>Categories</span><b>${DEFAULT_CATS.length + DEFAULT_INCOME.length} (groceries, milk, medical, bills…)</b></div>
        <div class="kv"><span>Shops</span><b>DMart, Amazon, Flipkart, kirana…</b></div>
        <p class="muted" style="margin-top:8px">You can rename, add or remove anything later.</p>
        <div class="btn-row" style="margin-top:12px"><button class="btn filled" data-act="setupDefaults">${ic('check')}Create my money book</button></div></div>
      <button class="card choice" data-act="sample">${ic('science')}<div><h3>Try it with sample data first</h3><p>Adds example entries, people and a running chit. Erase it any time from More.</p></div></button>
      ${store.kind === 'cloud' ? `<p class="muted" style="text-align:center">Already used Exsy on another device with this code? Wait a moment – your data is still syncing.</p>` : ''}
    </div></div>`;
}
function setupDefaults() {
  if (D.books.length) return;
  const me = save('books', { name: 'Me', primary: true, order: 0 });
  const mom = save('books', { name: 'Mother', order: 1 });
  const dad = save('books', { name: 'Father', order: 2 });
  const acc = (bookId, name, type, order) => save('accounts', { bookId, name, type, order, opening: 0, openingDate: today() });
  const ids = {
    cash: acc(me.id, 'Cash', 'cash', 0), sbi: acc(me.id, 'SBI', 'bank', 1), canara: acc(me.id, 'Canara Bank', 'bank', 2),
    icici: acc(me.id, 'ICICI (salary)', 'bank', 3), card: acc(me.id, 'Credit card', 'card', 4), groww: acc(me.id, 'Groww', 'invest', 5),
    momCash: acc(mom.id, 'Cash', 'cash', 0), momBank: acc(mom.id, 'Bank account', 'bank', 1), dadCash: acc(dad.id, 'Cash', 'cash', 0)
  };
  const cats = {};
  DEFAULT_CATS.forEach(([name, icon]) => { cats[name] = save('categories', { name, icon, kind: 'expense' }).id; });
  DEFAULT_INCOME.forEach(([name, icon]) => { cats[name] = save('categories', { name, icon, kind: 'income' }).id; });
  const stores = {};
  DEFAULT_STORES.forEach(([name, icon]) => { stores[name] = save('stores', { name, icon }).id; });
  return { me, mom, dad, acc: Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, v.id])), cats, stores };
}
function addSample() {
  let S = setupDefaults();
  if (!S) { // books already exist: look up what we need by name
    const x = X(), A = n => (D.accounts.find(a => a.name === n) || D.accounts[0] || {}).id;
    const byN = (coll, n) => (D[coll].find(c => c.name === n) || {}).id;
    S = { acc: { cash: A('Cash'), sbi: A('SBI'), canara: A('Canara Bank'), icici: A('ICICI (salary)'), card: A('Credit card'), groww: A('Groww'), momCash: (D.accounts.find(a => x.book.get(a.bookId)?.name === 'Mother' && a.type === 'cash') || {}).id, momBank: (D.accounts.find(a => x.book.get(a.bookId)?.name === 'Mother' && a.type === 'bank') || {}).id, dadCash: (D.accounts.find(a => x.book.get(a.bookId)?.name === 'Father') || {}).id },
      cats: Object.fromEntries([...DEFAULT_CATS, ...DEFAULT_INCOME].map(([n]) => [n, byN('categories', n)])), stores: Object.fromEntries(DEFAULT_STORES.map(([n]) => [n, byN('stores', n)])), me: meBook() };
  }
  const a = S.acc, c = S.cats, st = S.stores;
  const setOpen = (id, v) => { const acc = D.accounts.find(x => x.id === id); if (acc) save('accounts', { ...acc, opening: v, openingDate: addMonths(thisMonth(), -2) + '-01' }); };
  setOpen(a.cash, 4000); setOpen(a.sbi, 25000); setOpen(a.canara, 12000); setOpen(a.icici, 18000); setOpen(a.momCash, 6000); setOpen(a.momBank, 40000); setOpen(a.dadCash, 15000);
  const g = D.accounts.find(x => x.id === a.groww); if (g) save('accounts', { ...g, value: 54200, valueDate: today() });
  const tx = (date, type, amount, accountId, more = {}) => save('txns', { date, type, amount, accountId, mode: ACC_T[X().acc.get(accountId)?.type]?.mode || 'Cash', note: '', ...more });
  for (let back = 2; back >= 0; back--) {
    const k = addMonths(thisMonth(), -back), d = n => `${k}-${pad(Math.min(n, back === 0 ? +today().slice(8) : 28))}`;
    tx(d(1), 'income', 42000, a.icici, { categoryId: c['Salary'], note: 'Salary' });
    tx(d(2), 'transfer', 10000, a.icici, { toAccountId: a.groww, note: 'SIP', mode: 'Net banking' });
    tx(d(3), 'expense', 2350, a.momBank, { categoryId: c['Groceries'], storeId: st['DMart'], forWhom: 'home', mode: 'UPI' });
    tx(d(4), 'expense', 1290, a.card, { categoryId: c['Household items'], storeId: st['Amazon'], forWhom: 'home', mode: 'Card' });
    tx(d(5), 'expense', 1860, a.momCash, { categoryId: c['Milk'], forWhom: 'home', note: 'Milk bill' });
    tx(d(6), 'expense', 1420, a.canara, { categoryId: c['Electricity'], forWhom: 'home', note: 'BESCOM' });
    tx(d(8), 'expense', 640, a.dadCash, { categoryId: c['Medical'], storeId: st['Medical shop'], forWhom: S.dad?.id || 'home' });
    tx(d(9), 'expense', 399, a.sbi, { categoryId: c['Mobile & internet'], forWhom: S.me?.id || 'home' });
    tx(d(11), 'expense', 820, a.cash, { categoryId: c['Vegetables & fruits'], storeId: st['Local kirana'], forWhom: 'home' });
    tx(d(12), 'income', 5000, a.canara, { categoryId: c['Family money'], note: 'From Father (bank)' });
    tx(d(14), 'expense', 560, a.sbi, { categoryId: c['Food outside'], storeId: st['Swiggy / Zomato'], forWhom: S.me?.id || 'home' });
  }
  const sis = save('people', { name: 'Sister', relation: 'Family', phone: '' });
  const ravi = save('people', { name: 'Ravi', relation: 'Friend', phone: '' });
  const k1 = addMonths(thisMonth(), -1);
  tx(`${k1}-10`, 'lend', 8000, a.card, { personId: sis.id, note: 'Phone on my credit card', dueDate: `${thisMonth()}-01` });
  tx(`${thisMonth()}-01`, 'collect', 3000, a.sbi, { personId: sis.id, mode: 'UPI' });
  tx(`${k1}-20`, 'lend', 2000, a.cash, { personId: ravi.id });
  // a running chit: started 3 months ago, 12 members
  const names = ['Ramesh', 'Suresh', 'Lakshmi', 'Manjunath', 'Kavya', 'Prakash', 'Geetha', 'Naveen', 'Shobha', 'Raghu', 'Anitha', 'Venkatesh'];
  const ch = save('chits', { name: 'Sample 60k chit', monthly: 5000, commission: 2500, startMonth: addMonths(thisMonth(), -3), dueDay: 10, months: 12 });
  const mbs = names.map((name, i) => save('chitMembers', { chitId: ch.id, name, phone: '', seat: i + 1 }));
  const ci = () => chitInfo(D.chits.find(x => x.id === ch.id));
  for (let m = 1; m <= 4; m++) {
    mbs.forEach((mb, i) => {
      if (m === 4 && i % 2) return;            // this month only half have paid so far
      if (m === 3 && (i === 4 || i === 9)) return; // two overdue from last month
      if (m === 2 && i === 7) { save('chitPayments', { chitId: ch.id, memberId: mb.id, month: m, amount: 2000, date: `${addMonths(ch.startMonth, m - 1)}-12`, mode: 'Cash', accountId: a.cash }); return; }
      save('chitPayments', { chitId: ch.id, memberId: mb.id, month: m, amount: 5000, date: `${addMonths(ch.startMonth, m - 1)}-0${1 + (i % 9)}`, mode: i % 3 ? 'Cash' : 'UPI', accountId: i % 3 ? a.cash : a.sbi });
    });
    if (m <= 3) {
      const d = saveDraw(ci(), m, mbs[[2, 8, 5][m - 1]].id, `${addMonths(ch.startMonth, m - 1)}-15`);
      if (m <= 2) save('chitDraws', { ...d, paid: true, payoutDate: d.drawDate, payoutAccountId: a.cash, payoutMode: 'Cash' });
    }
  }
  save('recurring', { name: 'Electricity bill', type: 'expense', amount: 1400, day: 6, lastDone: thisMonth(), accountId: a.canara, categoryId: c['Electricity'] });
  save('recurring', { name: 'Salary', type: 'income', amount: 42000, day: 1, lastDone: thisMonth(), accountId: a.icici, categoryId: c['Salary'] });
  snack('Sample data added');
}

/* ============================================================
   App lock (PIN, stored only on this device)
   ============================================================ */
async function pinHash(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('exsy-pin:' + pin));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function keypad(onDone, title, sub) {
  let entered = '';
  const draw = (root) => {
    root.innerHTML = `<div class="center-screen"><img src="icons/icon-192.png" alt=""><h1>${esc(title)}</h1><p class="muted">${esc(sub || '')}</p>
      <div class="pin-dots">${[0, 1, 2, 3].map(i => `<i class="${i < entered.length ? 'on' : ''}"></i>`).join('')}</div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button class="ghost" data-k="x" aria-label="Cancel">${ic('close')}</button><button data-k="0">0</button><button class="ghost" data-k="b" aria-label="Delete">${ic('backspace')}</button></div></div>`;
  };
  return {
    draw,
    press(root, k) {
      if (k === 'b') entered = entered.slice(0, -1);
      else if (k === 'x') return onDone(null);
      else if (entered.length < 4) entered += k;
      draw(root);
      if (entered.length === 4) { const v = entered; entered = ''; setTimeout(() => onDone(v, () => { draw(root); const d = root.querySelector('.pin-dots'); d.classList.add('shake'); }), 120); }
    }
  };
}
let lockPad = null;
function renderLock() {
  if (!lockPad) lockPad = keypad(async (pin, fail) => {
    if (pin == null) return;
    if (await pinHash(pin) === lsGet(LS.pin, '')) { locked = false; lockPad = null; try { sessionStorage.setItem('exsy.unlocked', '1'); } catch { /* private mode */ } render(); }
    else fail();
  }, 'Enter PIN', 'Exsy is locked');
  lockPad.draw(app);
  app.onclick = e => { const b = e.target.closest('[data-k]'); if (b && locked && lockPad) lockPad.press(app, b.dataset.k); };
}
function openPinSetup() {
  const has = !!lsGet(LS.pin, '');
  if (has) {
    const s = openSheet(`${sheetHead('App lock')}<p class="lead">The PIN is asked when the app opens on this device. It is not your bank PIN – choose any 4 digits.</p>
      <div class="sheet-actions"><button class="btn text danger" id="pin-off">Turn off</button><button class="btn filled" id="pin-change">Change PIN</button></div>`);
    s.querySelector('#pin-off').onclick = () => { localStorage.removeItem(LS.pin); closeSheet(); snack('App lock turned off'); render(); };
    s.querySelector('#pin-change').onclick = () => newPin();
  } else newPin();
}
function newPin() {
  let first = null;
  const s = openSheet('<div id="pinpad"></div>');
  const root = s.querySelector('#pinpad');
  const kp = keypad(async (pin, fail) => {
    if (pin == null) return closeSheet();
    if (!first) { first = pin; root.querySelector('h1').textContent = 'Repeat the PIN'; return; }
    if (pin !== first) { first = null; fail(); root.querySelector('h1').textContent = 'Did not match – try again'; return; }
    lsSet(LS.pin, await pinHash(pin));
    try { sessionStorage.setItem('exsy.unlocked', '1'); } catch { /* private mode */ }
    closeSheet(); snack('App lock is on'); render();
  }, 'Choose a 4-digit PIN', 'Asked when Exsy opens on this device');
  kp.draw(root);
  root.onclick = e => { const b = e.target.closest('[data-k]'); if (b) kp.press(root, b.dataset.k); };
}

/* ============================================================
   Backup / restore / erase
   ============================================================ */
function backup() {
  const data = Object.fromEntries(COLLS.map(c => [c, D[c]]));
  download(`exsy-backup-${today()}.json`, JSON.stringify({ app: 'exsy', version: 1, at: new Date().toISOString(), data }), 'application/json');
  snack('Backup downloaded');
}
function restore(file) {
  const r = new FileReader();
  r.onload = () => {
    let j; try { j = JSON.parse(r.result); } catch { return snack('That file is not an Exsy backup'); }
    if (!j || j.app !== 'exsy' || !j.data) return snack('That file is not an Exsy backup');
    const n = sum(COLLS, c => (j.data[c] || []).length);
    confirmSheet({
      title: 'Restore backup?', ok: 'Replace my data', danger: true,
      text: `Backup from ${fmtDate((j.at || '').slice(0, 10))} with ${n} records. Your current data (${sum(COLLS, c => D[c].length)} records) will be replaced.`,
      onOk: () => {
        for (const c of COLLS) for (const d of D[c].slice()) removeDoc(c, d.id);
        for (const c of COLLS) for (const d of j.data[c] || []) save(c, d);
        snack(`Restored ${n} records`); go('#/home');
      }
    });
  };
  r.readAsText(file);
}
function eraseAll() {
  confirmSheet({
    title: 'Erase everything?', ok: 'Erase', danger: true, typeWord: 'DELETE',
    text: `This deletes all ${sum(COLLS, c => D[c].length)} records${store.kind === 'cloud' ? ' from the cloud – on every device' : ' on this device'}. Download a backup first if you might need it.`,
    onOk: () => { for (const c of COLLS) for (const d of D[c].slice()) removeDoc(c, d.id); snack('Everything erased'); go('#/home'); }
  });
}

/* ============================================================
   Theme
   ============================================================ */
const darkMq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = lsGet(LS.theme, 'auto'), dark = t === 'dark' || (t === 'auto' && darkMq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]').content = dark ? '#0f1512' : '#f5fbf5';
}
darkMq.addEventListener('change', applyTheme);

/* ============================================================
   Pages and actions
   ============================================================ */
const PAGES = { home: pageHome, txns: pageTxns, chits: pageChits, chit: pageChit, people: pagePeople, person: pagePerson, accounts: pageAccounts, account: pageAccount, more: pageMore, reports: pageReports, cats: pageCats, recurring: pageRecurring, sync: pageSync, calendar: pageCalendar, collect: pageCollect, mother: pageMother, homecosts: pageMother };

const ACT = {
  closeSheet: () => closeSheet(),
  search: () => openSearch(),
  motherMove: d => openMotherMove(d.dir),
  motherSalary: () => saveSalary(),
  homePayer: d => { saveHomePrefs({ payerBook: d.b }); snack(d.b ? `${X().book.get(d.b)?.name}’s money pays for the home` : 'Home costs are only tracked'); },
  addHomeExpense: () => openEntry({ forWhom: 'home' }),
  privacy: () => togglePrivacy(),
  goto: d => go(d.href),
  quickUse: d => useQuick(+d.i),
  quickEdit: () => openQuickEdit(),
  calDay: d => { UI.calDay = d.d; scheduleRender(); },
  addEntryOn: d => openEntry({ date: d.d || today() }),
  buzzToggle: () => { lsSet('exsy.buzz', !lsGet('exsy.buzz', true)); buzz(30); render(); },
  addEntry: d => {
    const init = {};
    if (d.acc) { init.accountId = d.acc; init.mode = ACC_T[X().acc.get(d.acc)?.type]?.mode; }
    if (d.type) init.type = d.type;
    if (d.person) init.personId = d.person;
    if (d.type === 'collect' || d.type === 'borrow') { const acc = D.accounts.find(a => a.type === 'cash' && a.bookId === meBook()?.id); if (acc && !d.acc) { init.accountId = acc.id; init.mode = 'Cash'; } }
    openEntry(init);
  },
  editEntry: d => editEntry(d.id),
  setBook: d => setUI('book', d.id),
  monthStep: d => {
    const k = d.k, step = +d.d;
    if (k === 'repYear') setUI(k, String(+UI.repYear + step));
    else setUI(k, addMonths(UI[k] || thisMonth(), step));
  },
  txMonthAll: () => setUI('txMonth', 'all'),
  txMonthThis: () => setUI('txMonth', thisMonth()),
  clearFilters: () => { UI.txType = UI.txCat = UI.txAcc = UI.txStore = ''; setUI('q', ''); },
  editAccount: d => openAccountForm(d.id, d.book),
  editBook: d => openBookForm(d.id),
  updateValue: d => openValueForm(d.id),
  payCard: d => {
    const a = X().acc.get(d.id), due = Math.max(0, -(X().bal.get(d.id) || 0));
    const from = D.accounts.find(x => x.type === 'bank' && x.bookId === a.bookId && !x.archived);
    openEntry({ type: 'transfer', toAccountId: d.id, accountId: from?.id || defaultAccount(), amount: due ? String(due) : '', note: 'Card bill', mode: 'Net banking' });
  },
  editPerson: d => openPersonForm(d.id),
  editChit: d => openChitForm(d.id),
  chitTab: d => setUI('chitTab', d.k),
  chitMonth: (d, el) => { if (el.disabled) return; const ci = chitInfo(D.chits.find(c => c.id === d.id)); UI.chitMonth[d.id] = clamp(chitMonthSel(ci) + +d.d, 1, ci.months); scheduleRender(); },
  chitGoMonth: d => { UI.chitMonth[d.id] = +d.m; setUI('chitTab', 'month'); },
  payCell: d => openPayCell(d.id, d.mb, +d.m),
  paste: () => openPasteSheet(),
  countBal: d => openCountSheet(d.id),
  sharePerson: d => sharePerson(d.id),
  shareMember: d => shareChitMember(d.id),
  shareChit: d => shareChitGroup(d.id),
  shareReport: () => shareReport(),
  draw: d => openDraw(d.id, +d.m),
  drawManual: d => openDrawManual(d.id, +d.m),
  payout: d => openPayout(d.id),
  drawInfo: d => openDrawInfo(d.id),
  memberInfo: d => openMemberInfo(d.id),
  addMember: d => addMember(d.id),
  editRecurring: d => openRecurringForm(d.id),
  recurNow: d => recurNow(d.id),
  catTab: d => setUI('catTab', d.k),
  editCat: d => openCatForm(d.id),
  repMode: d => setUI('repMode', d.k),
  repMonth: d => { UI.repMonth = d.k; setUI('repMode', 'month'); },
  exportCsv: () => exportCsv(false),
  exportAll: () => exportCsv(true),
  backup,
  restore: () => { const f = $('#file-in'); f.value = ''; f.onchange = () => f.files[0] && restore(f.files[0]); f.click(); },
  erase: eraseAll,
  sample: () => { addSample(); go('#/home'); },
  setupDefaults: () => { setupDefaults(); snack('Your money book is ready – set opening balances in More → Accounts'); go('#/home'); },
  theme: d => { lsSet(LS.theme, d.k); applyTheme(); render(); },
  pin: openPinSetup,
  startLocal: async () => { lsSet(LS.mode, 'local'); await connect('local'); render(); },
  newCloud: () => confirmSheet({ title: 'Create sync code?', ok: 'Create', text: 'A new private sync code is created and this device’s entries are copied to your Firebase database.', onOk: () => turnOnCloud(randCode(32), true) }),
  enterCode: () => {
    const s = openSheet(`<form id="ec">${sheetHead('Enter sync code')}<div class="sheet-body">${field('Sync code', `<input name="code" autocomplete="off" required minlength="24">`, 'Find it on your other device: More → Sync & devices → Show sync code.')}</div>
      <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">Open</button></div></form>`);
    s.querySelector('#ec').onsubmit = e => { e.preventDefault(); const c = readForm(e.target).code.trim(); if (c.length < 24) return snack('The code has at least 24 characters'); closeSheet(); turnOnCloud(c, false); };
  },
  saveCfg: () => {
    const cfg = parseFirebaseConfig($('#cfg-in').value);
    if (!cfg) return snack('Could not read the config – paste the whole firebaseConfig block');
    lsSet(LS.cfg, cfg); snack('Firebase connected – now create your sync code'); render();
  },
  copyJoin: () => copyText(joinLink(), 'Link copied – open it once on your other device'),
  showCode: () => openSheet(`${sheetHead('Your sync code')}<div class="code-box">${esc(lsGet(LS.code, ''))}</div><div class="sheet-actions"><button class="btn filled" id="cc">${ic('content_copy')}Copy</button></div>`).querySelector('#cc').onclick = () => copyText(lsGet(LS.code, '')),
  signOut: () => confirmSheet({ title: 'Stop syncing here?', ok: 'Forget code', text: 'This device forgets the sync code. Your data stays safe in the cloud and on your other devices.', onOk: async () => { localStorage.removeItem(LS.code); lsSet(LS.mode, ''); if (store) store.stop(); store = null; render(); } })
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || locked) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(el.dataset, el, e);
});
const onUiInput = e => { const k = e.target.dataset && e.target.dataset.ui; if (k && UI[k] !== e.target.value) setUI(k, e.target.value); };
app.addEventListener('input', onUiInput);
app.addEventListener('change', onUiInput);
window.addEventListener('hashchange', () => { if (sheetOpen) closeSheet(true); render(); });
// The floating Add button moves out of the way while scrolling down and comes back on scroll up
let lastY = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY, fab = document.querySelector('.fab');
  if (fab) fab.classList.toggle('away', y > lastY + 4 && y > 80 ? true : y < lastY - 4 || y < 80 ? false : fab.classList.contains('away'));
  lastY = y;
}, { passive: true });
window.addEventListener('online', scheduleRender);
window.addEventListener('offline', scheduleRender);
// Lock again when the app comes back after 5 minutes in the background
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (lsGet(LS.pin, '') && hiddenAt && Date.now() - hiddenAt > 5 * 60e3) { locked = true; try { sessionStorage.removeItem('exsy.unlocked'); } catch { /* private mode */ } closeSheet(); render(); }
});

/* ============================================================
   Start-up
   ============================================================ */
(async function boot() {
  applyTheme();
  applyPrivacy();
  takeSharedText();
  // Device link: #join=<base64 {c: code, f?: firebaseConfig}> signs this device in once
  const m = location.hash.match(/^#join=(.+)$/);
  if (m) {
    try {
      const j = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      if (j.f) lsSet(LS.cfg, j.f);
      if (j.c) { lsSet(LS.code, j.c); lsSet(LS.mode, 'cloud'); }
    } catch (e) { console.error('bad join link', e); }
    history.replaceState(null, '', location.pathname + '#/home');
  }
  if (lsGet(LS.pin, '')) { let ok = false; try { ok = sessionStorage.getItem('exsy.unlocked') === '1'; } catch { /* private mode */ } locked = !ok; }
  const mode = lsGet(LS.mode, '');
  if (mode) await connect(mode);
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
