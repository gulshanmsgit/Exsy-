'use strict';
/* Chit business (you are the organizer).
   A group has N members who each pay `monthly` for `months` months. Every month one member who has
   not won yet is picked at random and gets the pot (monthly × members) minus your commission. */

function chitInfo(ch) {
  const members = D.chitMembers.filter(m => m.chitId === ch.id).sort((a, b) => (a.seat || 0) - (b.seat || 0) || byName(a, b));
  const pays = D.chitPayments.filter(p => p.chitId === ch.id);
  const draws = D.chitDraws.filter(d => d.chitId === ch.id).sort((a, b) => a.month - b.month);
  const months = +ch.months || members.length || 12;
  const monthly = num(ch.monthly), commission = num(ch.commission);
  const pot = monthly * members.length;
  const monthKey = m => addMonths(ch.startMonth, m - 1);
  const dueDate = m => { const k = monthKey(m); return `${k}-${pad(Math.min(+ch.dueDay || 1, daysIn(k)))}`; };
  const cur = clamp(monthsBetween(ch.startMonth, thisMonth()) + 1, 0, months + 1);   // 0 = not started, months+1 = finished
  const paid = new Map();
  for (const p of pays) { const k = p.memberId + '#' + p.month; paid.set(k, (paid.get(k) || 0) + num(p.amount)); }
  const paidOf = (mid, m) => paid.get(mid + '#' + m) || 0;
  const t0 = today();
  const status = (mid, m) => {
    const p = paidOf(mid, m);
    if (p >= monthly - 0.005) return 'paid';
    if (t0 > dueDate(m)) return 'over';
    if (p > 0) return 'part';
    return m <= cur ? 'due' : 'future';
  };
  const overdue = [];
  for (let m = 1; m <= Math.min(cur, months); m++) {
    if (t0 <= dueDate(m)) continue;
    for (const mb of members) { const due = monthly - paidOf(mb.id, m); if (due > 0.005) overdue.push({ member: mb, m, due, days: daysBetween(dueDate(m), t0) }); }
  }
  const drawOf = new Map(draws.map(d => [d.month, d]));
  const winner = new Map(draws.map(d => [d.memberId, d]));
  const collected = sum(pays, p => p.amount);
  const paidOut = sum(draws.filter(d => d.paid), d => d.payout);
  return {
    ch, members, memberById: new Map(members.map(m => [m.id, m])), pays, draws, months, monthly, commission, pot, payout: pot - commission,
    monthKey, dueDate, cur, paidOf, status, overdue, drawOf, winner, collected, paidOut,
    commissionEarned: sum(draws, d => d.commission ?? commission), cashHeld: collected - paidOut,
    expectedSoFar: monthly * members.length * Math.min(cur, months)
  };
}
const chitMonthSel = ci => clamp(+UI.chitMonth[ci.ch.id] || ci.cur || 1, 1, ci.months);
const STATUS_TAG = { paid: ['ok', 'Paid'], part: ['warn', 'Part paid'], due: ['', 'Due'], over: ['bad', 'Overdue'], future: ['', 'Upcoming'] };

/* ---------- list of chit groups ---------- */
function pageChits() {
  const chits = D.chits.slice().sort((a, b) => (a.closed ? 1 : 0) - (b.closed ? 1 : 0) || (b.startMonth || '').localeCompare(a.startMonth || ''));
  const infos = chits.map(chitInfo);
  const active = infos.filter(ci => !ci.ch.closed);
  const k = thisMonth();
  const monthExpected = sum(active.filter(ci => ci.cur >= 1 && ci.cur <= ci.months), ci => ci.monthly * ci.members.length);
  const monthGot = sum(active.filter(ci => ci.cur >= 1 && ci.cur <= ci.months), ci => sum(ci.members, mb => Math.min(ci.monthly, ci.paidOf(mb.id, ci.cur))));
  const year = today().slice(0, 4);
  const commYear = sum(D.chitDraws.filter(d => (d.drawDate || '').startsWith(year)), d => d.commission);
  const toCollect = collectList();
  const body = `${active.length ? `<a class="card tert collect-cta" href="#/collect">${ic('event_available')}<span class="li-text"><span class="li-title">Collection day</span>
      <span class="li-sub">${toCollect.length ? `${toCollect.length} member${toCollect.length > 1 ? 's' : ''} to collect ${inr(sum(toCollect, r => r.total))} from` : 'Everyone has paid'}</span></span>${ic('chevron_right')}</a>` : ''}
    <div class="card primary" style="margin-top:12px">
      <div class="hero-label">This month (${fmtMonth(k)}) collected</div>
      <div class="hero-num">${inr(monthGot)} <span style="font-size:18px;opacity:.75">of ${inr(monthExpected)}</span></div>
      <div class="progress"><i style="width:${monthExpected ? monthGot / monthExpected * 100 : 0}%"></i></div>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><span>Overdue</span><b>${inr(sum(active, ci => sum(ci.overdue, o => o.due)))}</b></div>
        <div class="stat"><span>Cash with you</span><b>${inr(sum(active, ci => ci.cashHeld))}</b></div>
        <div class="stat"><span>Commission ${year}</span><b>${inr(commYear)}</b></div>
      </div></div>
    ${infos.map(ci => {
      const ch = ci.ch, m = clamp(ci.cur, 1, ci.months);
      const paidNow = ci.members.filter(mb => ci.status(mb.id, m) === 'paid').length;
      const draw = ci.drawOf.get(m);
      const state = ch.closed ? `<span class="tag">Closed</span>` : ci.cur === 0 ? `<span class="tag info">Starts ${fmtMonth(ch.startMonth)}</span>` : ci.cur > ci.months ? `<span class="tag ok">All months done</span>` : '';
      return `<a class="card" href="#/chit/${ch.id}" style="display:block;color:inherit;margin-top:12px">
        <div class="card-title">${ic('groups')}<span style="flex:1">${esc(ch.name)}</span>${state}${ci.overdue.length ? `<span class="tag bad">${ci.overdue.length} overdue</span>` : ''}</div>
        <div class="muted">${inr(ci.monthly)} × ${ci.members.length} members · ${ci.months} months · winner gets ${inr(ci.payout)}</div>
        ${!ch.closed && ci.cur >= 1 && ci.cur <= ci.months ? `<div style="margin:12px 0 6px;display:flex;justify-content:space-between;font-size:13px"><span>Month ${m} of ${ci.months} · ${fmtMonth(ci.monthKey(m))}</span><b>${paidNow}/${ci.members.length} paid</b></div>
        <div class="progress"><i style="width:${ci.members.length ? paidNow / ci.members.length * 100 : 0}%"></i></div>
        <div style="margin-top:10px">${draw ? `<span class="tag ok">${ic('emoji_events')}${esc(ci.memberById.get(draw.memberId)?.name || '?')} won</span> ${draw.paid ? '' : `<span class="tag warn">payout pending</span>`}` : `<span class="tag info">${ic('casino')}Draw pending</span>`}</div>` : ''}
      </a>`;
    }).join('') || `<div class="empty" style="margin-top:24px">${ic('groups')}No chit groups yet.<br>Tap “New chit” to set one up – 12 names, ₹5,000 a month.</div>`}`;
  return { title: 'Chits', body, fabAct: 'editChit', fabIcon: 'add', fabLabel: 'New chit' };
}

/* ---------- one chit group ---------- */
function pageChit(id) {
  const ch = D.chits.find(c => c.id === id);
  if (!ch) return { title: 'Chit', back: '#/chits', body: `<div class="empty">This chit was deleted.</div>` };
  const ci = chitInfo(ch), tab = UI.chitTab || 'month';
  const tabs = [['month', 'Month', 'today'], ['grid', 'Grid', 'table_chart'], ['members', 'Members', 'groups'], ['draws', 'Draws', 'emoji_events']];
  const body = `<div class="card primary">
      <div class="hero-label">${inr(ci.monthly)} × ${ci.members.length} members · ${ci.months} months · due on ${ordinal(+ch.dueDay || 1)}</div>
      <div class="hero-num">${inr(ci.pot)} <span style="font-size:16px;opacity:.8">pot</span></div>
      <div class="stats">
        <div class="stat"><span>Winner gets</span><b>${inr(ci.payout)}</b></div>
        <div class="stat"><span>Your commission</span><b>${inr(ci.commission)}/month</b></div>
        <div class="stat"><span>Collected</span><b>${inr(ci.collected)}</b></div>
        <div class="stat"><span>Paid out</span><b>${inr(ci.paidOut)}</b></div>
        <div class="stat"><span>Cash with you</span><b>${inr(ci.cashHeld)}</b></div>
        <div class="stat"><span>Commission earned</span><b>${inr(ci.commissionEarned)}</b></div>
        <div class="stat"><span>Overdue</span><b>${inr(sum(ci.overdue, o => o.due))}</b></div>
      </div></div>
    <div class="seg" style="margin-top:16px">${tabs.map(([k, l, i]) => `<button class="${tab === k ? 'on' : ''}" data-act="chitTab" data-k="${k}">${tab === k ? ic('check') : ic(i)}<span>${l}</span></button>`).join('')}</div>
    <div style="margin-top:12px">${tab === 'grid' ? chitGrid(ci) : tab === 'members' ? chitMembers(ci) : tab === 'draws' ? chitDraws(ci) : chitMonth(ci)}</div>`;
  return { title: ch.name, back: '#/chits', body, fab: false,
    actions: `<button class="icon-btn" data-act="shareChit" data-id="${id}" title="Chit report PDF" aria-label="Chit report PDF">${ic('picture_as_pdf')}</button>
      <button class="icon-btn" data-act="editChit" data-id="${id}" title="Edit chit" aria-label="Edit chit">${ic('edit')}</button>` };
}
const ordinal = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

function chitMonth(ci) {
  const m = chitMonthSel(ci), ch = ci.ch, draw = ci.drawOf.get(m);
  const eligible = ci.members.filter(mb => !ci.winner.has(mb.id));
  const got = sum(ci.members, mb => Math.min(ci.monthly, ci.paidOf(mb.id, m)));
  const due = ci.dueDate(m);
  let drawCard;
  if (draw) {
    const w = ci.memberById.get(draw.memberId);
    drawCard = `<div class="card tert"><div class="card-title">${ic('emoji_events', 'fill')}Month ${m} winner</div>
      <div style="font-size:24px;line-height:32px">${esc(w?.name || '?')}</div>
      <div class="hero-label" style="margin:4px 0 12px">Drawn ${fmtDate(draw.drawDate)} · gets ${inr(draw.payout)} (pot ${inr(draw.payout + num(draw.commission))} − commission ${inr(draw.commission)})</div>
      ${draw.paid ? `<span class="tag ok">${ic('check')}Paid ${fmtDate(draw.payoutDate)}${draw.payoutAccountId ? ' from ' + esc(accLabel(draw.payoutAccountId, X())) : ''}</span> <button class="btn text sm" data-act="drawInfo" data-id="${draw.id}">Details</button>`
        : `<div class="btn-row"><button class="btn filled" data-act="payout" data-id="${draw.id}">${ic('paid')}Pay ${inr(draw.payout)}</button><button class="btn text" data-act="drawInfo" data-id="${draw.id}">Details</button></div>`}</div>`;
  } else if (eligible.length) {
    drawCard = `<div class="card tert"><div class="card-title">${ic('casino')}Draw for month ${m}</div>
      <p style="margin-bottom:12px">${eligible.length} name${eligible.length > 1 ? 's' : ''} left: ${esc(eligible.map(e => e.name).join(', '))}</p>
      <div class="btn-row"><button class="btn filled" data-act="draw" data-id="${ch.id}" data-m="${m}">${ic('casino')}${eligible.length === 1 ? 'Confirm last winner' : 'Pick winner'}</button>
      <button class="btn text" data-act="drawManual" data-id="${ch.id}" data-m="${m}">Enter manually</button></div></div>`;
  } else drawCard = '';
  const rows = ci.members.map(mb => {
    const st = ci.status(mb.id, m), p = ci.paidOf(mb.id, m), [cls, lbl] = STATUS_TAG[st];
    const won = ci.winner.get(mb.id);
    const msg = `Hi ${mb.name}, gentle reminder: chit "${ch.name}" month ${m} (${fmtMonth(ci.monthKey(m))}) amount ${inr(ci.monthly - p)} is pending. Due date: ${fmtDate(due)}. Thank you!`;
    return `<div class="li" style="padding-right:8px"><button class="li" style="padding:0;flex:1;min-width:0;border:0" data-act="payCell" data-id="${ch.id}" data-mb="${mb.id}" data-m="${m}">
      <span class="avatar" style="--c:${colorFor(mb.name)}">${esc(initials(mb.name))}</span>
      <span class="li-text"><span class="li-title">${esc(mb.name)} ${won ? `<span class="tag ok" title="Won month ${won.month}">${ic('emoji_events')}M${won.month}</span>` : ''}</span>
      <span class="li-sub"><span class="tag ${cls}">${lbl}</span> ${p > 0 ? inr(p) + (p < ci.monthly ? ' of ' + inr(ci.monthly) : '') + ' · ' + esc(payModesText(ci.pays.filter(x => x.memberId === mb.id && x.month === m))) : ''}</span></span></button>
      ${st === 'paid' ? `<span class="ms pos" style="margin:0 8px">check_circle</span>` : `
        ${mb.phone && (st === 'over' || st === 'due' || st === 'part') ? `<a class="icon-btn" href="${waLink(mb.phone, msg)}" target="_blank" rel="noopener" aria-label="WhatsApp reminder">${ic('chat')}</a>` : ''}
        <button class="btn tonal sm" data-act="payCell" data-id="${ch.id}" data-mb="${mb.id}" data-m="${m}">${ic('check')}Paid</button>`}
    </div>`;
  }).join('');
  return `<div class="card" style="padding:8px 8px 8px 16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <div style="flex:1;min-width:150px"><b style="font-weight:500">Month ${m} · ${fmtMonth(ci.monthKey(m))}</b><div class="muted">Due ${fmtDate(due)} · ${inr(got)} of ${inr(ci.monthly * ci.members.length)} collected</div></div>
      <button class="icon-btn" data-act="chitMonth" data-id="${ch.id}" data-d="-1" ${m <= 1 ? 'disabled' : ''} aria-label="Previous month">${ic('chevron_left')}</button>
      <button class="icon-btn" data-act="chitMonth" data-id="${ch.id}" data-d="1" ${m >= ci.months ? 'disabled' : ''} aria-label="Next month">${ic('chevron_right')}</button></div>
    ${drawCard ? `<div style="margin-top:12px">${drawCard}</div>` : ''}
    <div class="card flush" style="margin-top:12px">${rows || `<div class="empty">Add members in the Members tab</div>`}</div>
    <p class="muted" style="margin:10px 4px">Tap “Paid” to record a payment – choose cash, UPI or bank and where the money went. Part payments are fine.</p>`;
}

function chitGrid(ci) {
  const head = Array.from({ length: ci.months }, (_, i) => `<th>M${i + 1}<br><span class="muted" style="font-weight:400">${MON[+ci.monthKey(i + 1).slice(5) - 1]}</span></th>`).join('');
  const rows = ci.members.map(mb => `<tr><th class="name" title="${esc(mb.name)}">${esc(mb.name)}</th>${Array.from({ length: ci.months }, (_, i) => {
    const m = i + 1, st = ci.status(mb.id, m), p = ci.paidOf(mb.id, m), won = ci.winner.get(mb.id)?.month === m;
    const txt = st === 'paid' ? ic('check') : p > 0 ? Math.round(p / 100) / 10 + 'k' : st === 'over' ? '!' : '';
    return `<td><button class="${st} ${won ? 'won' : ''}" data-act="payCell" data-id="${ci.ch.id}" data-mb="${mb.id}" data-m="${m}" title="${esc(mb.name)} · month ${m}: ${STATUS_TAG[st][1]}${won ? ' · winner' : ''}">${won && st === 'paid' ? ic('emoji_events') : txt}</button></td>`;
  }).join('')}</tr>`).join('');
  const totals = Array.from({ length: ci.months }, (_, i) => `<td style="font-size:11px;font-weight:500">${Math.round(sum(ci.members, mb => ci.paidOf(mb.id, i + 1)) / 1000)}k</td>`).join('');
  return `<div class="grid-wrap"><table class="cg"><thead><tr><th class="name">Member</th>${head}</tr></thead><tbody>${rows}<tr><th class="name">Collected</th>${totals}</tr></tbody></table></div>
    <div class="legend-row"><span><i style="background:color-mix(in srgb,var(--pos) 30%,var(--surface))"></i>Paid</span><span><i style="background:var(--warn-container)"></i>Part paid</span><span><i style="background:var(--error-container)"></i>Overdue</span><span><i style="background:var(--sc-high)"></i>Due</span><span><i style="outline:2px solid var(--primary);outline-offset:-2px"></i>Won that month</span></div>`;
}

function chitMembers(ci) {
  const upto = Math.min(ci.cur, ci.months);
  return `<div class="card flush">${ci.members.map(mb => {
    const paid = sum(ci.pays.filter(p => p.memberId === mb.id), p => p.amount);
    const pending = sum(ci.overdue.filter(o => o.member.id === mb.id), o => o.due);
    const won = ci.winner.get(mb.id);
    return `<button class="li" data-act="memberInfo" data-id="${mb.id}"><span class="avatar" style="--c:${colorFor(mb.name)}">${esc(initials(mb.name))}</span>
      <span class="li-text"><span class="li-title">${esc(mb.name)} ${won ? `<span class="tag ok">${ic('emoji_events')}Month ${won.month}${won.paid ? '' : ' · unpaid'}</span>` : ''}</span>
      <span class="li-sub">Paid ${inr(paid)} of ${inr(ci.monthly * upto)} so far${mb.phone ? ' · ' + esc(mb.phone) : ''}</span></span>
      <span class="li-end">${pending > 0 ? `<span class="neg">${inr(pending)}</span><small>overdue</small>` : `<span class="pos">${ic('check_circle')}</span>`}</span></button>`;
  }).join('')}
  <button class="li" data-act="addMember" data-id="${ci.ch.id}"><span class="avatar">${ic('person_add')}</span><span class="li-text"><span class="li-title">Add member</span><span class="li-sub">Pot = ${inr(ci.monthly)} × number of members</span></span></button></div>`;
}

function chitDraws(ci) {
  const x = X();
  return `<div class="card flush">${Array.from({ length: ci.months }, (_, i) => {
    const m = i + 1, d = ci.drawOf.get(m), w = d && ci.memberById.get(d.memberId);
    return `<button class="li" ${d ? `data-act="drawInfo" data-id="${d.id}"` : `data-act="chitGoMonth" data-id="${ci.ch.id}" data-m="${m}"`}>
      <span class="avatar" style="--c:${d ? '#2e7d5b' : '#6b7a83'}">${d ? ic('emoji_events', 'fill') : m}</span>
      <span class="li-text"><span class="li-title">${d ? esc(w?.name || '?') : 'Not drawn yet'}</span>
      <span class="li-sub">Month ${m} · ${fmtMonth(ci.monthKey(m))}${d ? ' · drawn ' + fmtDate(d.drawDate) : ''}</span></span>
      <span class="li-end">${d ? (d.paid ? `<span class="pos">${inr(d.payout)}</span><small>paid ${fmtDay(d.payoutDate)}${d.payoutAccountId ? ' · ' + esc(accLabel(d.payoutAccountId, x)) : ''}</small>` : `${inr(d.payout)}<small class="neg">to pay</small>`) : ''}</span></button>`;
  }).join('')}</div>`;
}

/* ---------- chit forms ---------- */
function openChitForm(id) {
  const ch = D.chits.find(c => c.id === id) || { monthly: 5000, commission: 2500, dueDay: 10, startMonth: thisMonth() };
  const ci = id ? chitInfo(ch) : null;
  const s = openSheet(`<form id="cf">${sheetHead(id ? 'Edit chit' : 'New chit group', id ? `<button type="button" class="icon-btn" id="cf-del" aria-label="Delete">${ic('delete')}</button>` : '')}
    <div class="sheet-body">
      ${field('Chit name', `<input name="name" value="${esc(ch.name || '')}" placeholder="e.g. Oct 2026 – 60k chit" required>`)}
      <div class="grid2">
        ${field('Monthly amount (each member)', `<input name="monthly" inputmode="decimal" value="${esc(ch.monthly)}" required>`)}
        ${field('Your commission per draw', `<input name="commission" inputmode="decimal" value="${esc(ch.commission)}">`)}
        ${field('First month', `<input type="month" name="startMonth" value="${esc(ch.startMonth)}" required>`)}
        ${field('Pay by (day of month)', `<input type="number" name="dueDay" min="1" max="31" value="${esc(ch.dueDay)}">`)}
      </div>
      ${field('Number of months', `<input type="number" name="months" min="1" max="60" value="${esc(ch.months || '')}" placeholder="same as members (12)">`)}
      ${id ? `<label class="switch-row"><span>Chit finished – close it</span><input type="checkbox" name="closed" ${ch.closed ? 'checked' : ''}></label>`
        : field('Member names – one per line (add phone after a comma)', `<textarea name="names" rows="8" placeholder="Ramesh, 9876543210&#10;Suresh&#10;Lakshmi, 9123456780"></textarea>`, 'One person can take two seats – just write the name twice. You can add or edit members later.')}
      <div class="banner info" id="cf-sum"></div>
    </div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
  const f = s.querySelector('#cf');
  const names = () => (readForm(f).names || '').split('\n').map(l => l.trim()).filter(Boolean);
  const upd = () => {
    const v = readForm(f), n = id ? ci.members.length : names().length, mo = num(v.monthly), c = num(v.commission);
    s.querySelector('#cf-sum').innerHTML = !n ? `${ic('info')}<div>Type the member names below – the pot and the winner's amount are worked out from them.</div>` : `${ic('info')}<div>${n} members × ${inr(mo)} = pot <b>${inr(mo * n)}</b>. Each month's winner gets <b>${inr(mo * n - c)}</b>; you keep ${inr(c)}. Runs ${+v.months || n || 12} months.</div>`;
  };
  f.oninput = upd; upd();
  f.onsubmit = e => {
    e.preventDefault();
    const v = readForm(f);
    const list = id ? null : names();
    if (!id && list.length < 2) { snack('Add at least 2 member names'); return; }
    const doc = save('chits', { ...ch, name: v.name.trim(), monthly: num(v.monthly), commission: num(v.commission), startMonth: v.startMonth, dueDay: +v.dueDay || 1, months: +v.months || (id ? ci.members.length : list.length), closed: id ? !!v.closed : false });
    if (list) list.forEach((line, i) => { const [name, phone] = line.split(',').map(s => s.trim()); save('chitMembers', { chitId: doc.id, name, phone: phone || '', seat: i + 1 }); });
    closeSheet(); snack('Chit saved');
    if (!id) go('#/chit/' + doc.id);
  };
  const del = s.querySelector('#cf-del');
  if (del) del.onclick = () => confirmSheet({
    title: 'Delete this chit?', danger: true, ok: 'Delete', typeWord: 'DELETE',
    text: `This removes “${esc(ch.name)}” with its ${ci.members.length} members, ${ci.pays.length} payments and ${ci.draws.length} draws.`,
    onOk: () => { removeMany([['chits', id], ...ci.members.map(m => ['chitMembers', m.id]), ...ci.pays.map(p => ['chitPayments', p.id]), ...ci.draws.map(d => ['chitDraws', d.id])], 'Chit deleted'); go('#/chits'); }
  });
}

/* ---------- how money was paid, and which cash/bank it went to ---------- */
const PAY_MODES = ['Cash', 'UPI', 'Bank transfer', 'Cheque'];
const MODE_ICON = { Cash: 'payments', UPI: 'phone_android', 'Bank transfer': 'account_balance', 'Net banking': 'account_balance', Card: 'credit_card', Cheque: 'receipt' };
// Each payment method remembers the account it was last used with (Cash -> my cash, UPI -> SBI, ...)
function accForMode(mode) {
  const mem = lsGet('exsy.modeAcc', {});
  if (mem[mode] !== undefined && (mem[mode] === '' || D.accounts.some(a => a.id === mem[mode] && !a.archived))) return mem[mode];
  const me = meBook()?.id, want = mode === 'Cash' ? 'cash' : 'bank';
  return (D.accounts.find(a => a.type === want && a.bookId === me && !a.archived) || D.accounts.find(a => a.type === want && !a.archived) || {}).id || '';
}
function rememberPay(mode, acc) { const m = lsGet('exsy.modeAcc', {}); m[mode] = acc || ''; lsSet('exsy.modeAcc', m); lsSet('exsy.chitMode', mode); }
function accChipsOptional(name, sel) {
  return accChips(name, sel, a => a.type !== 'card' && a.type !== 'invest') + `<div class="chip-group" style="margin-top:8px">${chip(name, '', 'Don\u2019t track', !sel, 'more_horiz')}</div>`;
}
function payMethodFields(accLabelText, mode, accountId) {
  mode = PAY_MODES.includes(mode) ? mode : lsGet('exsy.chitMode', 'Cash');
  return `<div class="form-label">How was it paid?</div><div class="chips">${PAY_MODES.map(m => chip('mode', m, m, m === mode, MODE_ICON[m])).join('')}</div>
    <div class="form-label">${accLabelText}</div>${accChipsOptional('accountId', accountId || accForMode(mode))}`;
}
function wirePayMethod(form) {
  form.addEventListener('change', e => {
    if (e.target.name !== 'mode') return;
    const r = form.querySelector(`input[name=accountId][value="${accForMode(e.target.value)}"]`);
    if (r) r.checked = true;
  });
}
const payModesText = list => [...new Set(list.map(p => p.mode).filter(Boolean))].join(', ');

// pre = values read from a pasted message: { amount, mode, accountId, date, note, info }
function openPayCell(chId, mbId, m, pre = {}) {
  const ch = D.chits.find(c => c.id === chId); if (!ch) return;
  const ci = chitInfo(ch), mb = ci.memberById.get(mbId), x = X();
  const paidList = ci.pays.filter(p => p.memberId === mbId && p.month === m).sort((a, b) => a.date.localeCompare(b.date));
  const rest = Math.max(0, ci.monthly - ci.paidOf(mbId, m));
  const s = openSheet(`<form id="cp">${sheetHead(`${mb?.name} · month ${m}`)}
    <p class="lead">${fmtMonth(ci.monthKey(m))} · due ${fmtDate(ci.dueDate(m))} · ${rest ? `${inr(rest)} pending` : 'fully paid'}</p>
    ${pre.info ? `<div class="banner info" style="margin-top:12px">${ic('auto_awesome')}<div>${esc(pre.info)}</div></div>` : ''}
    ${paidList.length ? `<div class="card flush" style="margin-top:12px">${paidList.map(p => `<div class="li static"><span class="avatar" style="--c:#2e7d5b">${ic('check')}</span>
      <span class="li-text"><span class="li-title">${inr(p.amount)}</span><span class="li-sub">${esc([fmtDate(p.date), p.mode, p.accountId && accLabel(p.accountId, x), p.note].filter(Boolean).join(' · '))}</span></span>
      <button type="button" class="icon-btn" data-delpay="${p.id}" aria-label="Delete payment">${ic('delete')}</button></div>`).join('')}</div>` : ''}
    ${rest > 0 ? `<label class="amount-field"><b>₹</b><input name="amount" inputmode="decimal" value="${pre.amount || rest}"></label>
      ${payMethodFields('Money went to (whose cash / which bank)', pre.mode === 'Net banking' ? 'Bank transfer' : pre.mode, pre.accountId)}
      <div class="grid2" style="margin-top:16px">${field('Date', `<input type="date" name="date" value="${pre.date || today()}">`)}${field('Note / UPI ref', `<input name="note" placeholder="optional" value="${esc(pre.note || '')}">`)}</div>` : ''}
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Close</button>${rest > 0 ? `<button class="btn filled">${ic('check')}Save payment</button>` : ''}</div></form>`);
  const f = s.querySelector('#cp');
  wirePayMethod(f);
  f.onsubmit = e => {
    e.preventDefault();
    const v = readForm(f), amt = evalAmount(v.amount);
    if (!(amt > 0)) { snack('Enter the amount'); return; }
    save('chitPayments', { chitId: chId, memberId: mbId, month: m, amount: amt, date: v.date || today(), mode: v.mode, accountId: v.accountId || '', note: (v.note || '').trim() });
    rememberPay(v.mode, v.accountId);
    buzz();
    closeSheet(); snack(`${mb?.name}: ${inr(amt)} by ${v.mode} saved`);
  };
  $$('[data-delpay]', s).forEach(b => b.onclick = () => { closeSheet(); removeMany([['chitPayments', b.dataset.delpay]], 'Payment deleted'); });
}

/* ---------- the draw ---------- */
function openDraw(chId, m) {
  const ch = D.chits.find(c => c.id === chId), ci = chitInfo(ch);
  if (ci.drawOf.get(m)) return snack('Month ' + m + ' already has a winner');
  const eligible = ci.members.filter(mb => !ci.winner.has(mb.id));
  if (!eligible.length) return snack('Everyone has already won');
  const s = openSheet(`${sheetHead(`Draw · month ${m}`)}
    <div class="draw-stage"><div class="draw-name" id="dn">${eligible.length === 1 ? esc(eligible[0].name) : '?'}</div>
    <div class="draw-sub" id="ds">${eligible.length === 1 ? 'Only one name left – this member gets the last month' : `${eligible.length} names in the draw · already won: ${ci.winner.size}`}</div></div>
    <div class="chips" style="margin-top:16px">${eligible.map(e => `<span class="tag">${esc(e.name)}</span>`).join('')}</div>
    <p class="lead" style="margin-top:12px">Winner gets <b>${inr(ci.payout)}</b> (${inr(ci.pot)} − your ${inr(ci.commission)}).</p>
    <div class="sheet-actions"><button class="btn text" data-act="closeSheet">Cancel</button>
      <button class="btn tonal ${eligible.length === 1 ? 'hide' : ''}" id="d-go">${ic('casino')}Start draw</button>
      <button class="btn filled ${eligible.length === 1 ? '' : 'hide'}" id="d-ok">${ic('check')}Confirm winner</button></div>`);
  let winner = eligible.length === 1 ? eligible[0] : null;
  const nameEl = s.querySelector('#dn'), go = s.querySelector('#d-go'), ok = s.querySelector('#d-ok');
  go.onclick = () => {
    go.disabled = true;
    winner = eligible[randInt(eligible.length)];
    const t0 = performance.now(), dur = 2600;
    let i = randInt(eligible.length);
    const step = () => {
      const el = performance.now() - t0;
      if (el < dur) { nameEl.textContent = eligible[i++ % eligible.length].name; setTimeout(step, 45 + (el / dur) ** 2 * 260); }
      else {
        nameEl.textContent = winner.name; nameEl.classList.add('win');
        s.querySelector('#ds').textContent = `Winner of month ${m} 🎉`;
        go.classList.add('hide'); ok.classList.remove('hide');
      }
    };
    step();
  };
  ok.onclick = () => { if (!winner) return; saveDraw(ci, m, winner.id, today()); buzz([30, 60, 30]); closeSheet(); snack(`${winner.name} won month ${m}`); };
}
function saveDraw(ci, m, memberId, date) {
  return save('chitDraws', { chitId: ci.ch.id, month: m, memberId, drawDate: date, payout: ci.payout, commission: ci.commission, paid: false });
}
function openDrawManual(chId, m) {
  const ch = D.chits.find(c => c.id === chId), ci = chitInfo(ch);
  const eligible = ci.members.filter(mb => !ci.winner.has(mb.id));
  const s = openSheet(`<form id="dm">${sheetHead(`Winner of month ${m}`)}
    <p class="lead">Use this if the draw was done offline.</p>
    <div class="chips" style="margin-top:12px">${eligible.map(e => chip('memberId', e.id, e.name, false, 'person')).join('')}</div>
    <div style="margin-top:16px">${field('Draw date', `<input type="date" name="date" value="${today()}">`)}</div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save winner</button></div></form>`);
  s.querySelector('#dm').onsubmit = e => {
    e.preventDefault(); const v = readForm(e.target);
    if (!v.memberId) { snack('Choose the winner'); return; }
    saveDraw(ci, m, v.memberId, v.date || today()); closeSheet(); snack('Winner saved');
  };
}
function openPayout(drawId) {
  const d = D.chitDraws.find(x => x.id === drawId); if (!d) return;
  const ch = D.chits.find(c => c.id === d.chitId), ci = chitInfo(ch), w = ci.memberById.get(d.memberId);
  const s = openSheet(`<form id="po">${sheetHead(`Pay ${w?.name || 'winner'}`)}
    <p class="lead">Month ${d.month} prize: ${inr(d.payout + num(d.commission))} pot − ${inr(d.commission)} commission.</p>
    <label class="amount-field"><b>₹</b><input name="payout" inputmode="decimal" value="${d.payout}"></label>
    ${payMethodFields('Paid from (whose cash / which bank)')}
    <div style="margin-top:16px">${field('Date', `<input type="date" name="date" value="${today()}">`)}</div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Mark as paid</button></div></form>`);
  wirePayMethod(s.querySelector('#po'));
  s.querySelector('#po').onsubmit = e => {
    e.preventDefault(); const v = readForm(e.target), amt = evalAmount(v.payout);
    if (!(amt > 0)) return;
    rememberPay(v.mode, v.accountId);
    save('chitDraws', { ...d, payout: amt, commission: round2(d.payout + num(d.commission) - amt), paid: true, payoutDate: v.date || today(), payoutAccountId: v.accountId || '', payoutMode: v.mode });
    closeSheet(); snack(`Paid ${inr(amt)} to ${w?.name}`);
  };
}
function openDrawInfo(drawId) {
  const d = D.chitDraws.find(x => x.id === drawId); if (!d) return;
  const ch = D.chits.find(c => c.id === d.chitId), ci = chitInfo(ch), w = ci.memberById.get(d.memberId), x = X();
  const s = openSheet(`${sheetHead(`Month ${d.month} · ${w?.name || '?'}`)}
    <div class="kv"><span>Draw date</span><b>${fmtDate(d.drawDate)}</b></div>
    <div class="kv"><span>Pot</span><b>${inr(d.payout + num(d.commission))}</b></div>
    <div class="kv"><span>Your commission</span><b>${inr(d.commission)}</b></div>
    <div class="kv"><span>Winner gets</span><b>${inr(d.payout)}</b></div>
    <div class="kv"><span>Payout</span><b>${d.paid ? `Paid ${fmtDate(d.payoutDate)}${d.payoutMode ? ' · ' + esc(d.payoutMode) : ''}${d.payoutAccountId ? ' · ' + esc(accLabel(d.payoutAccountId, x)) : ''}` : 'Not paid yet'}</b></div>
    <div class="sheet-actions">
      ${d.paid ? `<button class="btn text danger" id="di-unpay">Mark as not paid</button>` : `<button class="btn text danger" id="di-del">${ic('delete')}Undo draw</button><button class="btn filled" data-act="payout" data-id="${d.id}">${ic('paid')}Pay now</button>`}
    </div>`);
  const un = s.querySelector('#di-unpay');
  if (un) un.onclick = () => { save('chitDraws', { ...d, paid: false, payoutDate: '', payoutAccountId: '' }); closeSheet(); snack('Marked as not paid'); };
  const del = s.querySelector('#di-del');
  if (del) del.onclick = () => { closeSheet(); removeMany([['chitDraws', d.id]], 'Draw removed'); };
}

function openMemberInfo(mbId) {
  const mb = D.chitMembers.find(m => m.id === mbId); if (!mb) return;
  const ch = D.chits.find(c => c.id === mb.chitId), ci = chitInfo(ch), won = ci.winner.get(mbId);
  const pending = ci.overdue.filter(o => o.member.id === mbId);
  const msg = `Hi ${mb.name}, gentle reminder for chit "${ch.name}": ${pending.map(o => `month ${o.m} (${fmtMonth(ci.monthKey(o.m))}) ${inr(o.due)}`).join(', ')} pending – total ${inr(sum(pending, o => o.due))}. Thank you!`;
  const s = openSheet(`<form id="mf">${sheetHead(mb.name, ci.pays.some(p => p.memberId === mbId) || won ? '' : `<button type="button" class="icon-btn" id="mf-del" aria-label="Remove member">${ic('delete')}</button>`)}
    <div class="grid2">${field('Name', `<input name="name" value="${esc(mb.name)}" required>`)}${field('Phone', `<input name="phone" type="tel" value="${esc(mb.phone || '')}">`)}</div>
    <div class="btn-row" style="margin-top:12px">
      ${pending.length && mb.phone ? `<a class="btn tonal" href="${waLink(mb.phone, msg)}" target="_blank" rel="noopener">${ic('chat')}WhatsApp reminder</a>` : ''}
      ${mb.phone ? `<a class="btn outlined" href="tel:${esc(mb.phone)}">${ic('call')}Call</a>` : ''}
      <button type="button" class="btn tonal" data-act="shareMember" data-id="${mb.id}">${ic('picture_as_pdf')}Statement PDF</button>
    </div>
    <div class="form-label">Statement</div>
    <div class="card flush">${Array.from({ length: ci.months }, (_, i) => {
      const m = i + 1, st = ci.status(mbId, m), p = ci.paidOf(mbId, m), [cls, lbl] = STATUS_TAG[st];
      return `<div class="li static" style="min-height:44px"><span class="li-text"><span class="li-title" style="font-size:14px">Month ${m} · ${fmtMonth(ci.monthKey(m))} ${won?.month === m ? `<span class="tag ok">${ic('emoji_events')}Won</span>` : ''}</span></span>
        <span class="tag ${cls}">${lbl}</span><span class="li-end" style="min-width:80px">${p ? inr(p) : '—'}</span></div>`;
    }).join('')}</div>
    ${won ? `<p class="lead" style="margin-top:12px">Won month ${won.month}: ${inr(won.payout)} ${won.paid ? 'paid on ' + fmtDate(won.payoutDate) : '<b>not paid yet</b>'}.</p>` : ''}
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Close</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
  s.querySelector('#mf').onsubmit = e => { e.preventDefault(); const v = readForm(e.target); save('chitMembers', { ...mb, name: v.name.trim() || mb.name, phone: v.phone.trim() }); closeSheet(); snack('Member saved'); };
  const del = s.querySelector('#mf-del');
  if (del) del.onclick = () => { closeSheet(); removeMany([['chitMembers', mbId]], 'Member removed'); };
}
function addMember(chId) {
  const s = openSheet(`<form id="am">${sheetHead('Add member')}
    <div class="grid2">${field('Name', `<input name="name" required>`)}${field('Phone', `<input name="phone" type="tel">`)}</div>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Add</button></div></form>`);
  s.querySelector('#am').onsubmit = e => {
    e.preventDefault(); const v = readForm(e.target); if (!v.name.trim()) return;
    save('chitMembers', { chitId: chId, name: v.name.trim(), phone: v.phone.trim(), seat: D.chitMembers.filter(m => m.chitId === chId).length + 1 });
    closeSheet(); snack('Member added');
  };
  setTimeout(() => s.querySelector('input').focus(), 80);
}
