'use strict';
/* PDF statements and reports (jsPDF from cdnjs, loaded on first use), shared with a message
   through the phone's share sheet (WhatsApp etc.) or downloaded. */

const PDF_LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'];
let pdfReady = null;
const loadScript = src => new Promise((res, rej) => {
  const s = document.createElement('script');
  s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load the PDF maker – check the internet connection'));
  document.head.appendChild(s);
});
function loadPdf() {
  if (!pdfReady) pdfReady = (async () => { for (const s of PDF_LIBS) await loadScript(s); return window.jspdf.jsPDF; })().catch(e => { pdfReady = null; throw e; });
  return pdfReady;
}
// The built-in PDF font has no ₹ or Indian-script glyphs
const pt = s => String(s ?? '').replace(/₹/g, 'Rs.').replace(/[–—−]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/·/g, '-').replace(/[^\x00-\xFF]/g, '');
const rs = n => { const v = round2(+n || 0); return (v < 0 ? '-' : '') + 'Rs. ' + Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 2 }); };
const GREEN = [0, 108, 76];

async function makePdf(title, subtitle, build) {
  const JsPDF = await loadPdf();
  const doc = new JsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 70, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(pt(title), 40, 32);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(pt(subtitle), 40, 52);
  doc.text('Prepared ' + fmtDate(today()), W - 40, 52, { align: 'right' });
  let y = 96;
  const room = need => { if (y + need > H - 50) { doc.addPage(); y = 50; } };
  const d = {
    kv(rows) {
      doc.autoTable({ startY: y, body: rows.map(([k, v]) => [pt(k), pt(v)]), theme: 'plain', margin: { left: 40, right: 40 },
        styles: { fontSize: 11, cellPadding: 4 }, columnStyles: { 0: { textColor: [80, 90, 85] }, 1: { fontStyle: 'bold', halign: 'right' } } });
      y = doc.lastAutoTable.finalY + 16;
    },
    heading(t) { room(60); doc.setTextColor(...GREEN); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(pt(t), 40, y); doc.setTextColor(30); y += 10; },
    table(head, body, opts = {}) {
      if (!body.length) { d.para('Nothing to show.'); return; }
      doc.autoTable({ startY: y, head: [head.map(pt)], body: body.map(r => r.map(pt)), margin: { left: 40, right: 40 },
        styles: { fontSize: 9, cellPadding: 5, overflow: 'linebreak' }, headStyles: { fillColor: GREEN, textColor: 255 },
        alternateRowStyles: { fillColor: [239, 245, 239] }, ...opts });
      y = doc.lastAutoTable.finalY + 22;
    },
    para(t) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60); const lines = doc.splitTextToSize(pt(t), W - 80); room(lines.length * 13); doc.text(lines, 40, y); y += lines.length * 13 + 8; doc.setTextColor(30); }
  };
  build(d);
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(130); doc.text(`Exsy money book  -  page ${i} of ${n}`, W - 40, H - 20, { align: 'right' }); }
  return doc.output('blob');
}

/* ---------- share sheet: message + PDF ---------- */
function openShareSheet({ title, fileName, message, phone, build }) {
  const s = openSheet(`${sheetHead(title)}
    <div class="sheet-body">
      ${message != null ? field('Message', `<textarea id="sh-msg" rows="4">${esc(message)}</textarea>`) : ''}
      <p class="lead" id="sh-state">${ic('hourglass_top', 'sm')} Preparing PDF…</p>
    </div>
    <div class="sheet-actions" style="justify-content:flex-start">
      <button class="btn filled" id="sh-share" disabled>${ic('share')}Share PDF${message != null ? ' + message' : ''}</button>
      <button class="btn tonal" id="sh-dl" disabled>${ic('download')}Download PDF</button>
      ${message != null ? `<a class="btn outlined" id="sh-wa" target="_blank" rel="noopener">${ic('chat')}Message only</a>` : ''}
    </div>`);
  const msg = () => s.querySelector('#sh-msg')?.value || '';
  const wa = s.querySelector('#sh-wa');
  if (wa) { const upd = () => { wa.href = waLink(phone, msg()); }; upd(); s.querySelector('#sh-msg').oninput = upd; }
  // Build straight away so the Share tap still counts as a user action when the PDF is ready
  let blob = null;
  build().then(b => {
    blob = b;
    if (!s.isConnected) return;
    s.querySelector('#sh-state').innerHTML = `${ic('check_circle', 'sm')} PDF ready. Share opens the list of apps – pick WhatsApp and the contact. (Some apps keep only the file; use “Message only” for the text.)`;
    s.querySelector('#sh-share').disabled = s.querySelector('#sh-dl').disabled = false;
  }).catch(e => { if (s.isConnected) s.querySelector('#sh-state').textContent = e.message || 'Could not make the PDF'; });
  s.querySelector('#sh-dl').onclick = () => { if (blob) { downloadBlob(fileName, blob); snack('PDF downloaded'); } };
  s.querySelector('#sh-share').onclick = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'application/pdf' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title, text: msg() });
      else {
        downloadBlob(fileName, blob);
        if (msg()) { try { await navigator.clipboard.writeText(msg()); snack('This browser can’t share files – PDF downloaded and message copied'); } catch { snack('PDF downloaded'); } }
        else snack('PDF downloaded');
      }
    } catch (e) { if (e.name !== 'AbortError') snack(e.message || 'Could not share'); }
  };
}
const safeName = s => String(s || 'statement').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'statement';

/* ---------- person statement ---------- */
function personReminder(p, bal) {
  return bal > 0 ? `Hi ${p.name}, a gentle reminder: ${inr(bal)} is pending with me. I have attached the statement. Please return it when you can. Thank you!`
    : bal < 0 ? `Hi ${p.name}, here is the statement of our money. I have to give you ${inr(-bal)}.`
      : `Hi ${p.name}, here is the statement of our money – all settled. Thank you!`;
}
function sharePerson(id) {
  const x = X(), p = x.person.get(id); if (!p) return;
  const bal = x.owes.get(id) || 0;
  openShareSheet({ title: `Statement · ${p.name}`, fileName: `Statement-${safeName(p.name)}-${today()}.pdf`, message: personReminder(p, bal), phone: p.phone, build: () => personPdf(id) });
}
function personPdf(id) {
  const x = X(), p = x.person.get(id), bal = x.owes.get(id) || 0;
  const list = D.txns.filter(t => t.personId === id).sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
  let run = num(p.opening);
  const rows = run ? [['', 'Old balance', '', '', '', rs(run)]] : [];
  for (const t of list) {
    const out = t.type === 'lend' || t.type === 'repay';
    run += (out ? 1 : -1) * num(t.amount);
    rows.push([fmtDate(t.date), TT[t.type].label + (t.dueDate ? ` (return by ${fmtDate(t.dueDate)})` : ''), out ? rs(t.amount) : '', out ? '' : rs(t.amount),
      [t.mode, whereLabel(t.accountId, x)].filter(Boolean).join(' - ') + (t.note ? ' - ' + t.note : ''), run < 0 ? rs(-run) + ' (I owe)' : rs(run)]);
  }
  const given = sum(list.filter(t => t.type === 'lend' || t.type === 'repay'), t => t.amount), got = sum(list.filter(t => t.type === 'collect' || t.type === 'borrow'), t => t.amount);
  return makePdf(`Statement - ${p.name}`, [p.relation, p.phone].filter(Boolean).join('  -  ') || 'Money given and received', d => {
    d.kv([[bal > 0 ? `Balance ${p.name} has to pay` : bal < 0 ? `Balance I have to pay ${p.name}` : 'Balance', bal ? rs(Math.abs(bal)) : 'Settled'],
      ['Total given', rs(given + Math.max(0, num(p.opening)))], ['Total received', rs(got + Math.max(0, -num(p.opening)))]]);
    d.heading('All entries');
    d.table(['Date', 'Entry', 'Given', 'Received', 'How / where', 'Balance'], rows, { columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } } });
  });
}

/* ---------- chit member statement ---------- */
function chitMemberReminder(ch, ci, mb) {
  const pending = ci.overdue.filter(o => o.member.id === mb.id);
  return pending.length
    ? `Hi ${mb.name}, gentle reminder for chit "${ch.name}": ${pending.map(o => `month ${o.m} (${fmtMonth(ci.monthKey(o.m))}) ${inr(o.due)}`).join(', ')} – total ${inr(sum(pending, o => o.due))} pending. Statement attached. Thank you!`
    : `Hi ${mb.name}, here is your statement for chit "${ch.name}". Thank you!`;
}
function shareChitMember(mbId) {
  const mb = D.chitMembers.find(m => m.id === mbId); if (!mb) return;
  const ch = D.chits.find(c => c.id === mb.chitId), ci = chitInfo(ch);
  openShareSheet({ title: `Chit statement · ${mb.name}`, fileName: `Chit-${safeName(ch.name)}-${safeName(mb.name)}.pdf`, message: chitMemberReminder(ch, ci, mb), phone: mb.phone, build: () => chitMemberPdf(mbId) });
}
// "Cash (Me)", "SBI (Me)", "Bank account (Mother)" – always says whose money it is
const whereLabel = (id, x) => { const a = x.acc.get(id); return a ? `${a.name} (${x.book.get(a.bookId)?.name || ''})` : ''; };
function payDetail(list, x) { return list.map(p => `${fmtDay(p.date)}: ${rs(p.amount)}${p.mode ? ' by ' + p.mode : ''}${p.accountId ? ' - into ' + whereLabel(p.accountId, x) : ''}`).join('\n'); }
function chitMemberPdf(mbId) {
  const x = X(), mb = D.chitMembers.find(m => m.id === mbId), ch = D.chits.find(c => c.id === mb.chitId), ci = chitInfo(ch), won = ci.winner.get(mbId);
  const pays = ci.pays.filter(p => p.memberId === mbId);
  const rows = Array.from({ length: ci.months }, (_, i) => {
    const m = i + 1, list = pays.filter(p => p.month === m).sort((a, b) => a.date.localeCompare(b.date));
    return [`${m}`, fmtMonth(ci.monthKey(m)), fmtDate(ci.dueDate(m)), ci.paidOf(mbId, m) ? rs(ci.paidOf(mbId, m)) : '-', payDetail(list, x), STATUS_TAG[ci.status(mbId, m)][1] + (won?.month === m ? ' - WON' : '')];
  });
  const pending = sum(ci.overdue.filter(o => o.member.id === mbId), o => o.due);
  return makePdf(`Chit statement - ${mb.name}`, `${ch.name}  -  ${rs(ci.monthly)} x ${ci.members.length} members  -  ${ci.months} months`, d => {
    d.kv([['Paid so far', rs(sum(pays, p => p.amount))], ['Pending (overdue)', pending ? rs(pending) : 'Nothing pending'],
      ['Won', won ? `Month ${won.month} (${fmtMonth(ci.monthKey(won.month))})` : 'Not yet'],
      ...(won ? [['Prize amount', `${rs(won.payout)}${won.paid ? ' - paid ' + fmtDate(won.payoutDate) + (won.payoutMode ? ' by ' + won.payoutMode : '') : ' - not paid yet'}`]] : [])]);
    d.heading('Month by month');
    d.table(['#', 'Month', 'Due date', 'Paid', 'Payments (date, how, where)', 'Status'], rows, { columnStyles: { 0: { cellWidth: 22 }, 3: { halign: 'right' } } });
  });
}

/* ---------- chit group report ---------- */
function shareChitGroup(chId) {
  const ch = D.chits.find(c => c.id === chId); if (!ch) return;
  openShareSheet({ title: `Chit report · ${ch.name}`, fileName: `Chit-${safeName(ch.name)}-${today()}.pdf`, message: null, build: () => chitGroupPdf(chId) });
}
function chitGroupPdf(chId) {
  const x = X(), ch = D.chits.find(c => c.id === chId), ci = chitInfo(ch), upto = Math.min(ci.cur, ci.months);
  return makePdf(`Chit report - ${ch.name}`, `${rs(ci.monthly)} x ${ci.members.length} members  -  ${ci.months} months from ${fmtMonth(ch.startMonth)}  -  due on day ${ch.dueDay}`, d => {
    d.kv([['Pot per month', rs(ci.pot)], ['Winner gets', rs(ci.payout)], ['Commission per draw', rs(ci.commission)], ['Collected', rs(ci.collected)],
      ['Paid out', rs(ci.paidOut)], ['Cash with organizer', rs(ci.cashHeld)], ['Commission earned', rs(ci.commissionEarned)], ['Overdue', rs(sum(ci.overdue, o => o.due))]]);
    d.heading('Members');
    d.table(['Member', 'Phone', 'Paid', `Due till month ${upto}`, 'Overdue', 'Won'], ci.members.map(mb => {
      const won = ci.winner.get(mb.id);
      return [mb.name, mb.phone || '', rs(sum(ci.pays.filter(p => p.memberId === mb.id), p => p.amount)), rs(ci.monthly * upto), rs(sum(ci.overdue.filter(o => o.member.id === mb.id), o => o.due)), won ? `Month ${won.month}` : ''];
    }), { columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
    d.heading('Draws and payouts');
    d.table(['Month', 'Winner', 'Draw date', 'Prize', 'Paid'], ci.draws.map(dr => [`${dr.month} - ${fmtMonth(ci.monthKey(dr.month))}`, ci.memberById.get(dr.memberId)?.name || '?', fmtDate(dr.drawDate), rs(dr.payout),
      dr.paid ? `${fmtDate(dr.payoutDate)}${dr.payoutMode ? ' by ' + dr.payoutMode : ''}${dr.payoutAccountId ? ' - from ' + whereLabel(dr.payoutAccountId, x) : ''}` : 'Not paid']));
    if (ci.overdue.length) { d.heading('Overdue payments'); d.table(['Member', 'Month', 'Amount', 'Days late'], ci.overdue.map(o => [o.member.name, `${o.m} - ${fmtMonth(ci.monthKey(o.m))}`, rs(o.due), String(o.days)])); }
  });
}

/* ---------- report for the period shown on the Reports page ---------- */
function shareReport() {
  const label = UI.repMode === 'month' ? fmtMonth(UI.repMonth) : UI.repMode === 'year' ? UI.repYear : 'All time';
  openShareSheet({ title: `Report · ${label}`, fileName: `Exsy-report-${safeName(label)}.pdf`, message: null, build: () => reportPdf(label) });
}
function reportPdf(label) {
  const x = X(), key = UI.repMode === 'month' ? UI.repMonth : UI.repMode === 'year' ? UI.repYear : '';
  const list = D.txns.filter(t => (!key || t.date.startsWith(key)) && inBook(t, x)).sort((a, b) => a.date.localeCompare(b.date));
  const exp = list.filter(t => t.type === 'expense'), inc = list.filter(t => t.type === 'income');
  const book = UI.book === 'all' ? 'All books' : x.book.get(UI.book)?.name;
  const rowsOf = (rows, name) => rows.map(([k, v]) => [name(k), rs(v)]);
  return makePdf(`Money report - ${label}`, book, d => {
    d.kv([['Income', rs(sum(inc, t => t.amount))], ['Spent', rs(sum(exp, t => t.amount))], ['Saved', rs(sum(inc, t => t.amount) - sum(exp, t => t.amount))],
      ['Lent', rs(sum(list.filter(t => t.type === 'lend'), t => t.amount))], ['Got back', rs(sum(list.filter(t => t.type === 'collect'), t => t.amount))]]);
    d.heading('Spent by category');
    d.table(['Category', 'Amount'], rowsOf(spendBreakdown(exp, x, t => t.categoryId, 30), k => x.cat.get(k)?.name || k), { columnStyles: { 1: { halign: 'right' } } });
    d.heading('Spent by shop');
    d.table(['Shop', 'Amount'], rowsOf(spendBreakdown(exp.filter(t => t.storeId), x, t => t.storeId, 30), k => x.store.get(k)?.name || k), { columnStyles: { 1: { halign: 'right' } } });
    d.heading('All entries');
    d.table(['Date', 'Type', 'What', 'Account / how', 'Amount'], list.map(t => [fmtDate(t.date), TT[t.type].label, [txTitle(t, x), x.store.get(t.storeId)?.name, t.note].filter(Boolean).join(' - '),
      (t.type === 'transfer' ? `${accLabel(t.accountId, x)} > ${accLabel(t.toAccountId, x)}` : accLabel(t.accountId, x)) + (t.mode ? ' / ' + t.mode : ''), rs(t.amount)]), { columnStyles: { 4: { halign: 'right' } } });
  });
}
