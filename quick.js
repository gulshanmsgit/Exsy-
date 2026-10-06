'use strict';
/* Faster entry:
   - paste (or share into the installed app) a bank SMS / GPay / PhonePe message → a filled-in entry,
     linked to a person in People when the name matches
   - "Where the money is" list on Home and "Count cash / update balance" corrections
   - shop → usual category suggestion */

/* ============================================================
   Reading a payment message
   ============================================================ */
const BANK_WORDS = [['sbi', /\bsbi\b|state bank/i], ['canara', /canara/i], ['icici', /icici/i], ['hdfc', /hdfc/i], ['axis', /\baxis\b/i], ['kotak', /kotak/i],
  ['baroda', /\bbob\b|baroda/i], ['union', /union bank/i], ['pnb', /\bpnb\b|punjab national/i], ['indian', /indian bank/i], ['federal', /federal/i], ['idfc', /idfc/i], ['paytm', /paytm/i], ['yes', /yes bank/i]];
const MON3 = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const STOP_AFTER = '(?=\\s+(?:on|via|using|ref|refno|ref\\.?no|upi|a\\/c|ac|from|for|is|was|with|txn|avl|avbl|bal|info|thru|through|dated|date|-)\\b|[.,;:(\\n]|\\s*$)';

function parsePayText(raw) {
  const text = String(raw || '').replace(/ /g, ' ');
  const t = text.replace(/\s+/g, ' ');
  const r = { amount: 0, dir: '', party: '', ref: '', date: '', mode: '', accountId: '' };
  // amount
  let m = t.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) || t.match(/\b(?:debited|credited|paid|sent|received|spent)\s+(?:by|with|of|for)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (m) r.amount = round2(parseFloat(m[1].replace(/,/g, '')));
  // direction
  if (/debited|\bpaid\b|\bsent\b|spent|withdrawn|purchase|payment of|\bdr\b|transferred to/i.test(t)) r.dir = 'out';
  else if (/credited|received|deposited|refund|\bcr\b|added to/i.test(t)) r.dir = 'in';
  // other party
  const pats = r.dir === 'in'
    ? [new RegExp('(?:received from|from|by)\\s+([A-Za-z][A-Za-z0-9 .&\'_@-]{1,40}?)' + STOP_AFTER, 'i')]
    : [new RegExp('(?:paid to|sent to|trf to|transferred to|to|at)\\s+([A-Za-z][A-Za-z0-9 .&\'_@-]{1,40}?)' + STOP_AFTER, 'i')];
  for (const p of pats) {
    const mm = t.match(p);
    if (mm && !/^(your|a\/c|ac|account|you|my|the)\b/i.test(mm[1].trim())) { r.party = mm[1].trim(); break; }
  }
  const vpa = t.match(/\b([\w.\-]{2,})@[a-z]{2,}\b/i);
  if (!r.party && vpa) r.party = vpa[1];
  if (r.party.includes('@')) r.party = r.party.split('@')[0];
  r.party = r.party.replace(/\b(upi|vpa|neft|imps)\b/gi, '').replace(/[._-]+/g, ' ').trim();
  // reference number
  m = t.match(/\bupi[:\s]+(\d{9,})/i) || t.match(/(?:upi\s*ref(?:\.|erence)?\s*(?:no\.?|number|id)?|ref\s*(?:no\.?|number)?|refno|utr|txn\s*(?:id|no\.?)|transaction id)\s*[:#.\-]?\s*([A-Za-z0-9]{6,})/i);
  if (m) r.ref = m[1];
  // date (12-10-26, 12/10/2026, 12 Oct 2026, 12-Oct-26)
  m = t.match(/\b(\d{1,2})[-\/. ]([A-Za-z]{3,9}|\d{1,2})[-\/. ,]+(\d{2,4})\b/) || t.match(/\b(\d{1,2})([A-Za-z]{3})(\d{2,4})\b/);
  if (m) {
    const mon = /\d/.test(m[2]) ? +m[2] : MON3[m[2].slice(0, 3).toLowerCase()];
    let y = +m[3]; if (y < 100) y += 2000;
    const d = `${y}-${pad(mon)}-${pad(+m[1])}`;
    if (mon >= 1 && mon <= 12 && +m[1] >= 1 && +m[1] <= 31 && d <= today() && d > '2000') r.date = d;
  }
  // how it was paid
  r.mode = /\bupi\b|@|gpay|google pay|phonepe|paytm/i.test(t) ? 'UPI' : /neft|imps|rtgs|net ?banking/i.test(t) ? 'Net banking' : /\bcard\b|pos\b/i.test(t) ? 'Card' : /atm|cash/i.test(t) ? 'Cash' : '';
  // which of my accounts: last 4 digits first, then bank name
  const accs = D.accounts.filter(a => !a.archived);
  const digits = [...t.matchAll(/(?:a\/c|ac|acct|account|card)\s*(?:no\.?)?\s*[x*.\s]*(\d{3,4})\b/gi)].map(x => x[1]);
  let acc = accs.find(a => a.last4 && digits.some(d => String(a.last4).endsWith(d) || d.endsWith(String(a.last4))));
  if (!acc) for (const [word, re] of BANK_WORDS) if (re.test(t)) { acc = accs.find(a => a.name.toLowerCase().includes(word) && a.bookId === meBook()?.id) || accs.find(a => a.name.toLowerCase().includes(word)); if (acc) break; }
  if (acc) r.accountId = acc.id;
  return r;
}

const normName = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function matchPerson(party) {
  const p = party.toLowerCase().trim(); if (p.length < 3) return null;
  const words = p.split(/\s+/).filter(w => w.length >= 3);
  return D.people.find(x => normName(x.name) === normName(p))
    || D.people.find(x => { const n = x.name.toLowerCase(); return words.some(w => n.split(/\s+/).includes(w)) || (n.length >= 4 && p.includes(n)); })
    || null;
}
function findStoreIn(text) {
  const t = normName(text);
  return D.stores.find(s => s.name.split('/').map(normName).some(w => w.length >= 4 && t.includes(w))) || null;
}
// Chit member who still owes something and whose name matches → { ch, mb, m } for the oldest unpaid month
function matchChitMember(party) {
  const p = party.toLowerCase(); if (p.length < 3) return null;
  const words = p.split(/\s+/).filter(w => w.length >= 3);
  for (const ch of D.chits.filter(c => !c.closed)) {
    const ci = chitInfo(ch);
    const mb = ci.members.find(x => normName(x.name) === normName(p)) || ci.members.find(x => words.some(w => x.name.toLowerCase().split(/\s+/).includes(w)));
    if (!mb) continue;
    for (let m = 1; m <= Math.min(Math.max(ci.cur, 1), ci.months); m++) if (ci.paidOf(mb.id, m) < ci.monthly - 0.005) return { ch, mb, m };
  }
  return null;
}
function matchStore(party) {
  const p = normName(party); if (p.length < 3) return null;
  return D.stores.find(s => s.name.split('/').map(normName).some(w => w.length >= 4 && (p.includes(w) || w.includes(p)))) || null;
}
// The category used most often with a shop
function catForStore(storeId) {
  const n = new Map();
  for (const t of D.txns) if (t.storeId === storeId && t.categoryId) n.set(t.categoryId, (n.get(t.categoryId) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function entryFromText(text) {
  const r = parsePayText(text);
  if (!r.amount) { snack('Could not find an amount in that message'); openPasteSheet(text); return; }
  const cm = r.dir === 'in' && r.party && matchChitMember(r.party);
  if (cm) {
    openPayCell(cm.ch.id, cm.mb.id, cm.m, { amount: r.amount, mode: r.mode, accountId: r.accountId, date: r.date, note: r.ref ? 'Ref ' + r.ref : '',
      info: `Read from the message: ${inr(r.amount)} from ${r.party} – matched chit member ${cm.mb.name} (${cm.ch.name}, month ${cm.m}). Check and save.` });
    return;
  }
  const person = r.party && matchPerson(r.party), shop = !person && (r.party && matchStore(r.party) || (r.dir !== 'in' && findStoreIn(text)));
  const f = { amount: String(r.amount), date: r.date || today(), mode: r.mode || undefined, fromPaste: true };
  if (r.accountId) f.accountId = r.accountId;
  if (person) { f.type = r.dir === 'in' ? 'collect' : 'lend'; f.personId = person.id; }
  else if (r.dir === 'in') { f.type = 'income'; }
  else { f.type = 'expense'; if (shop) { f.storeId = shop.id; f.categoryId = catForStore(shop.id); } }
  f.note = [!person && !shop && r.party ? (r.dir === 'in' ? 'From ' : 'To ') + r.party : '', r.ref ? 'Ref ' + r.ref : ''].filter(Boolean).join(' · ');
  f.pasteInfo = [r.dir === 'in' ? 'Money received' : r.dir === 'out' ? 'Money paid' : 'Payment', inr(r.amount),
    person ? `· matched ${person.name} in People` : shop ? `· shop ${shop.name}` : r.party ? `· ${r.dir === 'in' ? 'from' : 'to'} ${r.party}` : '',
    r.accountId ? `· ${accLabel(r.accountId, X())}` : '· choose the account'].filter(Boolean).join(' ');
  openEntry(f);
}

function openPasteSheet(prefill = '') {
  const s = openSheet(`${sheetHead('Paste a payment message')}
    <div class="sheet-body">
      <p class="lead">Copy the bank SMS, or the GPay / PhonePe / Paytm payment message, and paste it here. Exsy fills in the amount, account, date and person or shop – you check and save.</p>
      ${field('Message', `<textarea id="pm-text" rows="6" placeholder="e.g. Rs.450.00 debited from A/c XX1234 on 06-10-26 to DMART UPI Ref 6280…">${esc(prefill)}</textarea>`)}
    </div>
    <div class="sheet-actions">
      <button type="button" class="btn text" id="pm-clip">${ic('content_paste')}Paste from clipboard</button>
      <button type="button" class="btn filled" id="pm-go">${ic('auto_awesome')}Fill entry</button>
    </div>`);
  const ta = s.querySelector('#pm-text');
  s.querySelector('#pm-clip').onclick = async () => {
    try { ta.value = await navigator.clipboard.readText(); if (ta.value.trim()) entryFromText(ta.value); }
    catch { snack('Long-press the box and choose Paste'); ta.focus(); }
  };
  s.querySelector('#pm-go').onclick = () => { if (ta.value.trim()) entryFromText(ta.value); else ta.focus(); };
  if (!prefill) setTimeout(() => ta.focus(), 80);
}

// Text shared into the installed app (manifest share_target) arrives as ?text=…
let pendingShare = '';
function takeSharedText() {
  const q = new URLSearchParams(location.search);
  const txt = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join(' ').trim();
  if (q.has('text') || q.has('title') || q.has('url')) history.replaceState(null, '', location.pathname + (location.hash || '#/home'));
  pendingShare = txt;
}
function handleShare() {
  if (!pendingShare || locked || !ready() || !D.books.length) return;
  const t = pendingShare; pendingShare = '';
  entryFromText(t);
}

/* ============================================================
   Where the money is + correcting a balance after counting
   ============================================================ */
function balancesCard(x, accs) {
  const rows = accs.filter(a => a.type !== 'invest' && a.type !== 'card');
  if (!rows.length) return '';
  return `<div class="card flush"><div class="card-title" style="padding:4px 16px 0">${ic('account_balance_wallet')}<span style="flex:1">Where the money is</span><a class="btn text sm" href="#/accounts">All accounts</a></div>
    ${rows.map(a => {
      const v = x.bal.get(a.id) || 0, b = x.book.get(a.bookId);
      return `<div class="li" style="min-height:52px"><a class="li" style="padding:0;border:0;flex:1;min-width:0" href="#/account/${a.id}">
        <span class="avatar" style="--c:${a.type === 'cash' ? '#2e7d5b' : '#2a8f99'}">${ic(ACC_T[a.type]?.icon || 'wallet')}</span>
        <span class="li-text"><span class="li-title">${esc(a.name)}</span><span class="li-sub">${esc(b?.name || '')}${a.checkedOn ? ' · checked ' + fmtDay(a.checkedOn) : ''}</span></span>
        <span class="li-end ${v < 0 ? 'neg' : ''}">${inr(v)}</span></a>
        <button class="icon-btn" data-act="countBal" data-id="${a.id}" title="${a.type === 'cash' ? 'Count cash' : 'Update balance'}" aria-label="${a.type === 'cash' ? 'Count cash' : 'Update balance'}">${ic(a.type === 'cash' ? 'payments' : 'tune')}</button></div>`;
    }).join('')}</div>`;
}

function correctionCat(kind) {
  return D.categories.find(c => c.kind === kind && c.name === 'Balance correction') || save('categories', { name: 'Balance correction', icon: 'tune', kind });
}
function openCountSheet(accId) {
  const x = X(), a = x.acc.get(accId); if (!a) return;
  const bal = x.bal.get(accId) || 0, isCash = a.type === 'cash';
  const s = openSheet(`<form id="cc">${sheetHead(isCash ? `Count cash · ${a.name}` : `Update balance · ${a.name}`)}
    <div class="sheet-body">
      <div class="kv"><span>Exsy says</span><b>${inr(bal)}</b></div>
      <p class="lead">${isCash ? 'Count the notes in hand and type the real amount.' : 'Check the balance in the bank app or passbook and type it.'} Exsy adds one “Balance correction” entry for the difference, so the books match again.</p>
      <label class="amount-field"><b>₹</b><input id="cc-real" name="real" inputmode="decimal" placeholder="${round2(bal)}"></label>
      <div class="amount-hint" id="cc-diff"></div>
    </div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
  const inp = s.querySelector('#cc-real'), out = s.querySelector('#cc-diff');
  inp.oninput = () => {
    const v = evalAmount(inp.value);
    if (!inp.value || isNaN(v)) { out.textContent = ''; return; }
    const d = round2(v - bal);
    out.textContent = !d ? 'Matches – nothing to correct' : d > 0 ? `${inr(d)} more than Exsy shows – will be added` : `${inr(-d)} less than Exsy shows – will be recorded as spent`;
  };
  s.querySelector('#cc').onsubmit = e => {
    e.preventDefault();
    const v = evalAmount(inp.value);
    if (!inp.value || isNaN(v)) { inp.focus(); return; }
    const d = round2(v - bal);
    if (d) save('txns', { type: d > 0 ? 'income' : 'expense', amount: Math.abs(d), date: today(), accountId: accId, categoryId: correctionCat(d > 0 ? 'income' : 'expense').id, mode: isCash ? 'Cash' : '', note: isCash ? 'Cash count' : 'Balance check', forWhom: a.bookId });
    save('accounts', { ...a, checkedOn: today() });
    closeSheet(); snack(d ? `Corrected by ${inr(d, true)}` : 'Balance matches');
  };
  setTimeout(() => inp.focus(), 80);
}
