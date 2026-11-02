'use strict';
/* Monthly budgets with a mood emoji (😊 on track … 😱 over budget) and spending trend graphs on Home.
   Settings live in prefs/budget { total, scope: 'all' | bookId, cats: { categoryId: monthly limit } }. */

const budgetPrefs = () => D.prefs.find(p => p.id === 'budget') || {};
const saveBudgetPrefs = patch => save('prefs', { ...budgetPrefs(), id: 'budget', ...patch });
// Budget counts your own spending unless you choose otherwise
const budgetScope = () => { const s = budgetPrefs().scope; return s && (s === 'all' || D.books.some(b => b.id === s)) ? s : meBook()?.id || 'all'; };
const isCorrection = t => /balance correction/i.test(X().cat.get(t.categoryId)?.name || '');
// Spending that counts: expenses (not balance corrections) from accounts in the chosen book(s)
function spendIn(k, { scope = budgetScope(), catId = '' } = {}) {
  const x = X();
  return sum(D.txns.filter(t => t.type === 'expense' && t.date.startsWith(k) && !isCorrection(t) && (!catId || t.categoryId === catId)
    && (scope === 'all' || x.acc.get(t.accountId)?.bookId === scope)), t => t.amount);
}
const monthProgress = k => { const dim = daysIn(k), day = k === thisMonth() ? +today().slice(8) : k < thisMonth() ? dim : 0; return { dim, day, left: dim - day }; };
function mood(spent, limit, k) {
  const { dim, day } = monthProgress(k), used = limit ? spent / limit : 0, time = day / dim;
  if (used > 1) return { emoji: '😱', label: `Over budget by ${inr(spent - limit)}`, cls: 'bad' };
  if (used >= 0.9) return { emoji: '😟', label: 'Almost at the limit', cls: 'warn' };
  if (used > time + 0.1) return { emoji: '😬', label: 'Spending faster than planned', cls: 'warn' };
  if (used < time - 0.15) return { emoji: '🤩', label: 'Well under budget', cls: 'ok' };
  return { emoji: '😊', label: 'On track', cls: 'ok' };
}

/* ---------- Home: mood card ---------- */
function moodCard() {
  const total = num(budgetPrefs().total), k = thisMonth();
  if (!total) return `<a class="card mood-empty" href="#/budgets">${ic('savings')}<span>Set a monthly budget – Exsy shows 😊 when you are on track and 😱 when you cross it</span>${ic('chevron_right')}</a>`;
  const spent = spendIn(k), m = mood(spent, total, k), pr = monthProgress(k), left = total - spent;
  return `<a class="card mood mood-${m.cls}" href="#/budgets">
    <span class="mood-emoji" aria-hidden="true">${m.emoji}</span>
    <span class="mood-text"><b>${m.label}</b>
      <span>${inr(spent)} of ${inr(total)} spent · ${Math.round(spent / total * 100)}%</span>
      <span class="progress"><i style="width:${Math.min(100, spent / total * 100)}%"></i></span>
      <small>${left >= 0 ? `${inr(left)} left · ${pr.left ? `about ${inr(Math.floor(left / pr.left))} a day for ${pr.left} more day${pr.left > 1 ? 's' : ''}` : 'last day'}` : `${inr(-left)} more than planned`}</small></span></a>`;
}

/* ---------- Budgets page ---------- */
function catAvg(catId, scope) { const ks = [1, 2, 3].map(i => addMonths(thisMonth(), -i)); return Math.round(sum(ks, k => spendIn(k, { scope, catId })) / 3); }
function pageBudgets() {
  const x = X(), bp = budgetPrefs(), scope = budgetScope(), k = UI.budMonth || thisMonth(), total = num(bp.total);
  const spent = spendIn(k, { scope }), m = total ? mood(spent, total, k) : null;
  const cats = D.categories.filter(c => c.kind === 'expense' && !/balance correction/i.test(c.name));
  const rows = cats.map(c => ({ c, spent: spendIn(k, { scope, catId: c.id }), limit: num((bp.cats || {})[c.id]) }))
    .filter(r => r.spent || r.limit).sort((a, b) => (b.limit ? 1 : 0) - (a.limit ? 1 : 0) || b.spent - a.spent);
  const unbudgeted = cats.filter(c => !num((bp.cats || {})[c.id]) && !rows.some(r => r.c.id === c.id));
  const last3 = Math.round(sum([1, 2, 3], i => spendIn(addMonths(thisMonth(), -i), { scope })) / 3);
  const body = `<div class="card ${m ? 'mood mood-' + m.cls : ''}" style="display:block">
      <div class="card-title"><span style="flex:1">${fmtMonth(k)}</span>${monthNav('budMonth', k, '')}</div>
      ${total ? `<div style="display:flex;gap:14px;align-items:center"><span class="mood-emoji">${m.emoji}</span><div style="flex:1;min-width:0">
        <b style="font-size:18px;font-weight:500">${m.label}</b><div>${inr(spent)} of ${inr(total)} · ${Math.round(spent / total * 100)}%</div>
        <div class="progress" style="margin-top:8px"><i style="width:${Math.min(100, spent / total * 100)}%"></i></div></div></div>`
        : `<p>Spent ${inr(spent)}. Set a monthly budget below to see how you are doing.</p>`}
    </div>
    <div class="card" style="margin-top:12px"><div class="card-title">${ic('savings')}Monthly budget</div>
      <div class="grid2">${field('Total for a month', `<input id="bud-total" inputmode="decimal" value="${total || ''}" placeholder="${last3 ? 'e.g. ' + last3 : 'e.g. 20000'}">`, last3 ? `Average of the last 3 months: ${inr(last3)}` : '')}</div>
      <div class="form-label">Counts spending from</div>
      <div class="chips">${[meBook(), { id: 'all', name: 'All books' }, ...booksSorted().filter(b => b.id !== meBook()?.id)].filter(Boolean).map(b => `<button class="chip ${scope === b.id ? 'on' : ''}" data-act="budScope" data-b="${b.id}">${scope === b.id ? ic('check') : ''}${esc(b.name)}</button>`).join('')}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn filled" data-act="budSave">${ic('check')}Save</button></div></div>
    <div class="section-head" style="margin-top:12px"><h2>By category</h2></div>
    <div class="card flush">${rows.map(r => {
      const cm = r.limit ? mood(r.spent, r.limit, k) : null;
      return `<button class="li" data-act="budCat" data-id="${r.c.id}"><span class="avatar" style="--c:${colorFor(r.c.name)}">${ic(r.c.icon || 'category')}</span>
        <span class="li-text"><span class="li-title">${esc(r.c.name)} ${cm ? `<span aria-hidden="true">${cm.emoji}</span>` : ''}</span>
        <span class="li-sub">${r.limit ? `${inr(r.spent)} of ${inr(r.limit)}` : `${inr(r.spent)} · no limit – tap to set`}</span>
        ${r.limit ? `<span class="progress" style="margin-top:6px"><i style="width:${Math.min(100, r.spent / r.limit * 100)}%;${r.spent > r.limit ? 'background:var(--error)' : ''}"></i></span>` : ''}</span>
        <span class="li-end">${r.limit ? (r.limit - r.spent >= 0 ? `${inr(r.limit - r.spent)}<small>left</small>` : `<span class="neg">${inr(r.spent - r.limit)}</span><small>over</small>`) : ''}</span></button>`;
    }).join('') || `<div class="empty">No spending in ${fmtMonth(k)}</div>`}
      ${unbudgeted.length ? `<button class="li" data-act="budCatPick"><span class="avatar">${ic('add')}</span><span class="li-text"><span class="li-title">Set a limit for another category</span></span></button>` : ''}</div>`;
  return { title: 'Budget', back: '#/home', body, fab: false };
}
function openCatBudget(catId) {
  const c = X().cat.get(catId); if (!c) return;
  const cur = num((budgetPrefs().cats || {})[catId]), avg = catAvg(catId, budgetScope());
  const s = openSheet(`<form id="cb">${sheetHead(`Budget · ${c.name}`)}
    <p class="lead">Monthly limit for ${esc(c.name)}.${avg ? ` You spent about ${inr(avg)} a month lately.` : ''} Leave empty to remove the limit.</p>
    <label class="amount-field"><b>₹</b><input name="limit" inputmode="decimal" value="${cur || ''}" placeholder="${avg || 0}"></label>
    <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled">${ic('check')}Save</button></div></form>`);
  s.querySelector('#cb').onsubmit = e => {
    e.preventDefault();
    const v = evalAmount(readForm(e.target).limit), cats = { ...(budgetPrefs().cats || {}) };
    if (v > 0) cats[catId] = v; else delete cats[catId];
    saveBudgetPrefs({ cats }); closeSheet(); buzz(); snack(v > 0 ? `${c.name}: ${inr(v)} a month` : `${c.name}: no limit`);
  };
  setTimeout(() => s.querySelector('input').focus(), 80);
}
function openCatBudgetPick() {
  const bp = budgetPrefs(), cats = D.categories.filter(c => c.kind === 'expense' && !/balance correction/i.test(c.name) && !num((bp.cats || {})[c.id]));
  const s = openSheet(`${sheetHead('Choose a category')}<div class="chips">${cats.map(c => `<button class="chip" data-pick="${c.id}">${ic(c.icon || 'category')}${esc(c.name)}</button>`).join('')}</div>`);
  $$('[data-pick]', s).forEach(b => b.onclick = () => openCatBudget(b.dataset.pick));
}

/* ---------- Home: spending trend graph with modes and filters ---------- */
function trendCard() {
  const x = X(), mode = UI.trendMode || 'month', cat = UI.trendCat || '';
  const exp = k => sum(D.txns.filter(t => t.type === 'expense' && t.date.startsWith(k) && !isCorrection(t) && inBook(t, x) && (!cat || t.categoryId === cat)), t => t.amount);
  const limit = cat ? num((budgetPrefs().cats || {})[cat]) : num(budgetPrefs().total);
  const catOpts = D.categories.filter(c => c.kind === 'expense' && !/balance correction/i.test(c.name) && x.catUse.get(c.id)).sort(byName);
  let svg, note;
  if (mode === 'month') {
    // cumulative spending day by day: this month vs last month, and the budget pace
    const k = thisMonth(), pk = addMonths(k, -1), dim = daysIn(k), today_ = +today().slice(8);
    const daily = kk => { const a = Array(32).fill(0); for (const t of D.txns) if (t.type === 'expense' && t.date.startsWith(kk) && !isCorrection(t) && inBook(t, x) && (!cat || t.categoryId === cat)) a[+t.date.slice(8)] += num(t.amount); for (let i = 1; i < 32; i++) a[i] += a[i - 1]; return a; };
    const cur = daily(k), prev = daily(pk);
    const max = Math.max(1, limit, cur[today_], prev[daysIn(pk)]);
    const W = 320, H = 150, P = 6, xs = d => P + (d - 1) / (dim - 1) * (W - 2 * P), ys = v => H - P - v / max * (H - 2 * P - 14);
    const path = (arr, upto) => Array.from({ length: upto }, (_, i) => `${i ? 'L' : 'M'}${xs(i + 1).toFixed(1)},${ys(arr[i + 1]).toFixed(1)}`).join('');
    svg = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending this month">
      ${limit ? `<line x1="${xs(1)}" y1="${ys(0)}" x2="${xs(dim)}" y2="${ys(limit)}" class="t-budget"/><text x="${W - P}" y="${ys(limit) - 4}" class="t-lbl" text-anchor="end">budget ${inrShort(limit)}</text>` : ''}
      <path d="${path(prev, Math.min(dim, daysIn(pk)))}" class="t-prev"/>
      <path d="${path(cur, today_)}" class="t-cur"/>
      <circle cx="${xs(today_)}" cy="${ys(cur[today_])}" r="4" class="t-dot"/>
      <text x="${Math.min(xs(today_), W - 60)}" y="${ys(cur[today_]) - 8}" class="t-lbl t-strong">${inrShort(cur[today_])}</text></svg>
      <div class="legend-row"><span><i style="background:var(--primary)"></i>${fmtMonth(k)}</span><span><i style="background:var(--outline)"></i>${fmtMonth(pk)}</span>${limit ? '<span><i style="background:var(--error)"></i>Budget pace</span>' : ''}</div>`;
    const prevSame = prev[Math.min(today_, daysIn(pk))];
    note = prevSame ? `By today you spent ${inr(cur[today_])} – ${cur[today_] > prevSame ? `${inr(cur[today_] - prevSame)} more` : `${inr(prevSame - cur[today_])} less`} than by this day last month.` : '';
  } else {
    const n = mode === '6m' ? 6 : 12, ks = Array.from({ length: n }, (_, i) => addMonths(thisMonth(), i - n + 1)), vals = ks.map(exp);
    const max = Math.max(1, limit, ...vals), avg = sum(vals.slice(0, -1)) / Math.max(1, n - 1);
    const W = 320, H = 150, P = 6, bw = (W - 2 * P) / n, ys = v => H - 18 - v / max * (H - 36);
    svg = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending by month">
      ${limit ? `<line x1="${P}" y1="${ys(limit)}" x2="${W - P}" y2="${ys(limit)}" class="t-budget"/><text x="${W - P}" y="${ys(limit) - 4}" class="t-lbl" text-anchor="end">budget</text>` : ''}
      ${vals.map((v, i) => `<g data-act="trendMonth" data-k="${ks[i]}" style="cursor:pointer"><rect x="${(P + i * bw + bw * 0.15).toFixed(1)}" y="${ys(v).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${(H - 18 - ys(v)).toFixed(1)}" rx="3" class="${limit && v > limit ? 't-over' : i === n - 1 ? 't-now' : 't-bar'}"/>
        <text x="${(P + i * bw + bw / 2).toFixed(1)}" y="${H - 4}" class="t-lbl" text-anchor="middle">${MON[+ks[i].slice(5) - 1].slice(0, n > 6 ? 1 : 3)}</text></g>`).join('')}
      <text x="${(P + (n - 1) * bw + bw / 2).toFixed(1)}" y="${ys(vals[n - 1]) - 4}" class="t-lbl t-strong" text-anchor="middle">${inrShort(vals[n - 1])}</text></svg>`;
    note = `Average ${inr(Math.round(avg))} a month before this one. Highest: ${fmtMonth(ks[vals.indexOf(Math.max(...vals))])}. Tap a bar to see its entries.`;
  }
  return `<div class="card">
    <div class="card-title">${ic('insights')}<span style="flex:1">Spending trend</span></div>
    <div class="seg" style="margin-bottom:10px">${[['month', 'This month'], ['6m', '6 months'], ['12m', '12 months']].map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="trendMode" data-k="${k}">${l}</button>`).join('')}</div>
    <select class="filter ${cat ? 'on' : ''}" data-ui="trendCat" aria-label="Category" style="margin-bottom:8px"><option value="">All categories</option>${catOpts.map(c => `<option value="${c.id}" ${cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    ${svg}
    ${note ? `<p class="muted" style="margin-top:8px;font-size:13px">${note}</p>` : ''}</div>`;
}
