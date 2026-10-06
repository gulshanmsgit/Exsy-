'use strict';
/* Exsy – personal money book.
   One page app. Data lives in this browser (localStorage) or in Firestore under a sync code,
   so phone and laptop see the same book. Pages are plain template strings re-rendered on change. */

/* ============================================================
   Config
   ============================================================ */
const APP_VERSION = '1.2.0';
const FIREBASE_VERSION = '10.12.2';
// Exsy's own Firebase project (exsy-591a1). Data lives under FIRESTORE_ROOT/{syncCode}/…
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBnHMDdTtFUzadQs4M4HBQtUWYlyPne1No",
  authDomain: "exsy-591a1.firebaseapp.com",
  projectId: "exsy-591a1",
  storageBucket: "exsy-591a1.firebasestorage.app",
  messagingSenderId: "739111637553",
  appId: "1:739111637553:web:b3cfe8236824a660c0bb10"
};
const FIRESTORE_ROOT = 'moneybooks';
const COLLS = ['books', 'accounts', 'txns', 'categories', 'stores', 'people', 'recurring', 'chits', 'chitMembers', 'chitPayments', 'chitDraws', 'prefs'];
const LS = { mode: 'exsy.mode', code: 'exsy.code', cfg: 'exsy.fbcfg', local: 'exsy.local', pin: 'exsy.pin', theme: 'exsy.theme', ui: 'exsy.ui', last: 'exsy.last' };

/* ============================================================
   Small helpers
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const thisMonth = () => today().slice(0, 7);
const fmtDate = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${+d} ${MON[m - 1]} ${y}`; };
const fmtDay = s => { if (!s) return ''; const [, m, d] = s.split('-'); return `${+d} ${MON[m - 1]}`; };
const fmtMonth = k => `${MON[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;
const fmtMonthShort = k => `${MON[+k.slice(5, 7) - 1]} ’${k.slice(2, 4)}`;
const addMonths = (k, n) => { let [y, m] = k.split('-').map(Number); m += n - 1; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12 + 1; return `${y}-${pad(m)}`; };
const monthsBetween = (a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
const daysIn = k => new Date(+k.slice(0, 4), +k.slice(5, 7), 0).getDate();
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const round2 = n => Math.round(n * 100) / 100;
const sum = (arr, f = x => x) => arr.reduce((s, x) => s + num(f(x)), 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function inr(n, sign) {
  const v = round2(+n || 0);
  const s = '₹' + Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return v < 0 ? '−' + s : (sign && v > 0 ? '+' + s : s);
}
const inrAbs = n => inr(Math.abs(+n || 0));
function evalAmount(s) {
  s = String(s ?? '').replace(/[,₹\s]/g, '');
  if (!s) return 0;
  if (!/^[\d+\-*/.()]+$/.test(s)) return NaN;
  try { const v = Function('"use strict";return (' + s + ')')(); return isFinite(v) ? round2(v) : NaN; } catch { return NaN; }
}
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const clean = d => { const o = JSON.parse(JSON.stringify(d)); delete o.id; return o; };
const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
const byOrder = (a, b) => (a.order ?? 99) - (b.order ?? 99) || byName(a, b);
const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0);
const PALETTE = ['#2e7d5b', '#3f6fb5', '#c8742a', '#a14d8f', '#2a8f99', '#b5483f', '#8a7a2a', '#5b5fb0', '#4f8a3a', '#8a5a44', '#6b7a83', '#c05a7a'];
const phoneDigits = p => { let d = String(p || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; return d; };
const waLink = (phone, text) => `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(text)}`;
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const colorFor = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return PALETTE[Math.abs(h) % PALETTE.length]; };
const randInt = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const randCode = (n = 32) => { const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += abc[randInt(abc.length)]; return s; };

/* ---------- icons (Material Symbols, only the glyphs we use are downloaded) ---------- */
const ICON_CHOICES = ['shopping_basket', 'nutrition', 'local_drink', 'cleaning_services', 'medication', 'bolt', 'water_drop', 'local_fire_department', 'wifi', 'local_gas_station', 'directions_bus', 'restaurant', 'checkroom', 'school', 'house', 'account_balance', 'shield', 'redeem', 'temple_hindu', 'build', 'spa', 'movie', 'category', 'payments', 'family_restroom', 'percent', 'currency_exchange', 'groups', 'savings', 'shopping_cart', 'storefront', 'shopping_bag', 'local_shipping', 'store', 'local_pharmacy', 'delivery_dining', 'language', 'more_horiz', 'pets', 'child_care', 'sports_cricket', 'flight', 'train', 'two_wheeler', 'directions_car', 'phone_iphone', 'tv', 'laptop', 'celebration', 'volunteer_activism', 'work', 'receipt', 'local_cafe', 'bakery_dining', 'egg', 'set_meal', 'lunch_dining', 'local_laundry_service', 'content_cut', 'fitness_center', 'hotel', 'checklist', 'local_hospital', 'agriculture', 'construction', 'card_giftcard', 'person', 'face', 'elderly', 'elderly_woman', 'woman', 'man', 'home_work'];
const UI_ICONS = ['home', 'receipt_long', 'handshake', 'menu', 'add', 'close', 'arrow_back', 'chevron_left', 'chevron_right', 'edit', 'delete', 'search', 'more_vert', 'cloud_done', 'cloud_off', 'phone_android', 'lock', 'lock_open', 'backspace', 'check', 'check_circle', 'schedule', 'warning', 'error', 'casino', 'emoji_events', 'person_add', 'account_balance_wallet', 'credit_card', 'trending_up', 'trending_down', 'swap_horiz', 'north_east', 'south_west', 'download', 'upload', 'settings', 'dark_mode', 'light_mode', 'contrast', 'event_repeat', 'bar_chart', 'pie_chart', 'content_copy', 'share', 'link', 'info', 'expand_more', 'expand_less', 'notifications', 'chat', 'call', 'today', 'calendar_month', 'tune', 'visibility', 'visibility_off', 'restart_alt', 'undo', 'account_circle', 'sync', 'add_card', 'payments', 'account_balance', 'savings', 'groups', 'storefront', 'category', 'person', 'pending', 'task_alt', 'hourglass_top', 'military_tech', 'table_chart', 'list', 'event', 'auto_awesome', 'science', 'delete_forever', 'cloud_sync', 'key', 'dataset', 'insights', 'paid', 'filter_alt_off', 'wallet', 'move_down', 'more_horiz', 'picture_as_pdf', 'description', 'content_paste'];
const ALL_ICONS = new Set([...ICON_CHOICES, ...UI_ICONS]);
(function loadIconFont() {
  const names = [...ALL_ICONS].sort().join(',');
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=${names}&display=block`;
  document.head.appendChild(l);
})();
const ic = (name, cls = '') => {
  if (!ALL_ICONS.has(name)) console.warn('icon not in font subset:', name);
  return `<span class="ms ${cls}" aria-hidden="true">${name}</span>`;
};

/* ============================================================
   Domain constants
   ============================================================ */
const TT = {
  expense: { label: 'Expense', icon: 'trending_down', sign: -1 },
  income: { label: 'Income', icon: 'trending_up', sign: 1 },
  transfer: { label: 'Transfer', icon: 'swap_horiz', sign: 0 },
  lend: { label: 'Lent', icon: 'north_east', sign: -1, verb: 'Lent to' },
  collect: { label: 'Got back', icon: 'south_west', sign: 1, verb: 'Got back from' },
  borrow: { label: 'Borrowed', icon: 'south_west', sign: 1, verb: 'Borrowed from' },
  repay: { label: 'Repaid', icon: 'north_east', sign: -1, verb: 'Repaid to' }
};
const PERSON_T = new Set(['lend', 'collect', 'borrow', 'repay']);
const OUT_T = new Set(['expense', 'lend', 'repay']);
const IN_T = new Set(['income', 'collect', 'borrow']);
const ACC_T = {
  cash: { label: 'Cash', icon: 'payments', mode: 'Cash' },
  bank: { label: 'Bank account', icon: 'account_balance', mode: 'UPI' },
  card: { label: 'Credit card', icon: 'credit_card', mode: 'Card' },
  wallet: { label: 'Wallet / UPI', icon: 'account_balance_wallet', mode: 'UPI' },
  invest: { label: 'Investment', icon: 'trending_up', mode: 'Net banking' }
};
const MODES = ['Cash', 'UPI', 'Card', 'Net banking', 'Cheque'];
const DEFAULT_CATS = [
  ['Groceries', 'shopping_basket'], ['Vegetables & fruits', 'nutrition'], ['Milk', 'local_drink'], ['Household items', 'cleaning_services'],
  ['Medical', 'medication'], ['Electricity', 'bolt'], ['Water', 'water_drop'], ['Gas cylinder', 'local_fire_department'],
  ['Mobile & internet', 'wifi'], ['Fuel', 'local_gas_station'], ['Travel', 'directions_bus'], ['Food outside', 'restaurant'],
  ['Clothes & shopping', 'checkroom'], ['Education', 'school'], ['Rent', 'house'], ['EMI / loan', 'account_balance'],
  ['Insurance', 'shield'], ['Gifts', 'redeem'], ['Festivals & pooja', 'temple_hindu'], ['Repairs', 'build'],
  ['Personal care', 'spa'], ['Entertainment', 'movie'], ['Other', 'category']
];
const DEFAULT_INCOME = [['Salary', 'payments'], ['Family money', 'family_restroom'], ['Interest', 'percent'], ['Refund / cashback', 'currency_exchange'], ['Chit commission', 'groups'], ['Other income', 'savings']];
const DEFAULT_STORES = [['DMart', 'storefront'], ['Amazon', 'shopping_cart'], ['Flipkart', 'shopping_bag'], ['BigBasket', 'shopping_basket'], ['Blinkit', 'bolt'], ['Zepto', 'local_shipping'], ['Local kirana', 'store'], ['Medical shop', 'local_pharmacy'], ['Swiggy / Zomato', 'delivery_dining'], ['Petrol bunk', 'local_gas_station'], ['Other online', 'language'], ['Other', 'more_horiz']];

/* ============================================================
   Storage: localStorage (this device) or Firestore (sync)
   Layout in Firestore: moneybooks/{syncCode}/{collection}/{id}
   ============================================================ */
const D = Object.fromEntries(COLLS.map(c => [c, []]));
let store = null, loaded = new Set(), sigs = {}, storeErr = '';
let VER = 0, memo = { v: -1 };

function localStore() {
  const m = lsGet(LS.local, {}) || {};
  const persist = () => { try { localStorage.setItem(LS.local, JSON.stringify(m)); } catch { snack('This device is out of space – download a backup'); } };
  return {
    kind: 'local',
    start(cb) { for (const c of COLLS) cb(c, Object.entries(m[c] || {}).map(([id, d]) => ({ ...d, id })), false); },
    put(c, id, d) { (m[c] = m[c] || {})[id] = clean(d); persist(); },
    del(c, id) { if (m[c]) { delete m[c][id]; persist(); } },
    stop() {}
  };
}

let fbMods = null;
async function cloudStore(cfg, ws) {
  if (!fbMods) {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
    const [A, F] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-firestore.js')]);
    const app = A.initializeApp(cfg);
    let db;
    try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
    catch { db = F.getFirestore(app); }
    fbMods = { F, db };
  }
  const { F, db } = fbMods;
  const ref = (c, id) => F.doc(db, FIRESTORE_ROOT, ws, c, id);
  const unsubs = [];
  return {
    kind: 'cloud',
    start(cb, err) {
      for (const c of COLLS) unsubs.push(F.onSnapshot(F.collection(db, FIRESTORE_ROOT, ws, c),
        s => cb(c, s.docs.map(d => ({ ...d.data(), id: d.id })), s.metadata.fromCache), e => err(c, e)));
    },
    put: (c, id, d) => F.setDoc(ref(c, id), clean(d)),
    del: (c, id) => F.deleteDoc(ref(c, id)),
    stop() { unsubs.splice(0).forEach(u => u()); }
  };
}

const sigOf = arr => arr.map(d => d.id + ':' + (d.updatedAt || 0)).sort().join('|');
function onData(c, docs, fromCache) {
  const wasReady = ready();
  if (!fromCache || !navigator.onLine || store.kind === 'local') loaded.add(c);
  const sig = sigOf(docs);
  if (sigs[c] !== sig) { sigs[c] = sig; D[c] = docs; VER++; scheduleRender(); }
  else if (!wasReady && ready()) scheduleRender();
}
function onStoreErr(c, e) {
  console.error(c, e);
  storeErr = e && e.code === 'permission-denied'
    ? 'Firestore refused access. Publish the rules from firestore.rules in the Firebase console (Firestore → Rules).'
    : 'Sync problem: ' + (e && e.message || e);
  loaded.add(c);
  scheduleRender();
}
const ready = () => !!store && COLLS.every(c => loaded.has(c));
const writeErr = e => { console.error(e); snack('Could not save: ' + (e && e.code || e)); };

function save(c, doc) {
  const now = Date.now();
  doc = { ...doc, id: doc.id || uid(), updatedAt: now };
  if (!doc.createdAt) doc.createdAt = now;
  const i = D[c].findIndex(x => x.id === doc.id);
  D[c] = i >= 0 ? D[c].map((x, j) => j === i ? doc : x) : [...D[c], doc];
  sigs[c] = sigOf(D[c]); VER++; scheduleRender();
  Promise.resolve().then(() => store.put(c, doc.id, doc)).catch(writeErr);
  return doc;
}
function removeDoc(c, id) {
  const old = D[c].find(x => x.id === id);
  if (!old) return null;
  D[c] = D[c].filter(x => x.id !== id);
  sigs[c] = sigOf(D[c]); VER++; scheduleRender();
  Promise.resolve().then(() => store.del(c, id)).catch(writeErr);
  return old;
}
// Delete several docs and offer one Undo for all of them
function removeMany(list, msg) {
  const gone = list.map(([c, id]) => [c, removeDoc(c, id)]).filter(([, d]) => d);
  snack(msg, { label: 'Undo', fn: () => gone.forEach(([c, d]) => save(c, d)) });
}

async function connect(mode) {
  if (store) store.stop();
  for (const c of COLLS) D[c] = [];
  loaded = new Set(); sigs = {}; storeErr = ''; VER++;
  if (mode === 'cloud') {
    const cfg = FIREBASE_CONFIG || lsGet(LS.cfg, null), code = lsGet(LS.code, '');
    if (!cfg || !code) { store = null; return; }
    try { store = await cloudStore(cfg, code); }
    catch (e) { console.error(e); store = localStore(); storeErr = 'Could not load Firebase (offline on first use?). Showing this device\'s data.'; }
  } else store = localStore();
  store.start(onData, onStoreErr);
  setTimeout(() => { if (!ready()) { COLLS.forEach(c => loaded.add(c)); scheduleRender(); } }, 9000);
}

/* ============================================================
   Derived data (balances etc.), recomputed when data changes
   ============================================================ */
function X() {
  if (memo.v === VER) return memo;
  const m = { v: VER };
  m.book = new Map(D.books.map(b => [b.id, b]));
  m.acc = new Map(D.accounts.map(a => [a.id, a]));
  m.cat = new Map(D.categories.map(c => [c.id, c]));
  m.store = new Map(D.stores.map(s => [s.id, s]));
  m.person = new Map(D.people.map(p => [p.id, p]));
  m.bal = new Map(D.accounts.map(a => [a.id, num(a.opening)]));
  m.owes = new Map(D.people.map(p => [p.id, num(p.opening)]));
  m.catUse = new Map(); m.storeUse = new Map();
  const add = (map, k, v) => { if (k && map.has(k)) map.set(k, map.get(k) + v); };
  for (const t of D.txns) {
    const a = num(t.amount);
    if (OUT_T.has(t.type)) add(m.bal, t.accountId, -a);
    else if (IN_T.has(t.type)) add(m.bal, t.accountId, a);
    else if (t.type === 'transfer') { add(m.bal, t.accountId, -a); add(m.bal, t.toAccountId, a); }
    if (t.type === 'lend' || t.type === 'repay') add(m.owes, t.personId, a);
    if (t.type === 'collect' || t.type === 'borrow') add(m.owes, t.personId, -a);
    if (t.categoryId) m.catUse.set(t.categoryId, (m.catUse.get(t.categoryId) || 0) + 1);
    if (t.storeId) m.storeUse.set(t.storeId, (m.storeUse.get(t.storeId) || 0) + 1);
  }
  m.chitHeld = new Map();
  for (const p of D.chitPayments) { add(m.bal, p.accountId, num(p.amount)); if (p.accountId) m.chitHeld.set(p.accountId, (m.chitHeld.get(p.accountId) || 0) + num(p.amount)); }
  for (const d of D.chitDraws) if (d.paid) { add(m.bal, d.payoutAccountId, -num(d.payout)); if (d.payoutAccountId) m.chitHeld.set(d.payoutAccountId, (m.chitHeld.get(d.payoutAccountId) || 0) - num(d.payout)); }
  memo = m;
  return m;
}
const accValue = (a, x) => a.type === 'invest' && a.value != null && a.value !== '' ? num(a.value) : x.bal.get(a.id) || 0;
const booksSorted = () => D.books.slice().sort(byOrder);
const accsOf = (bookId, all) => D.accounts.filter(a => a.bookId === bookId && (all || !a.archived)).sort(byOrder);
const meBook = () => D.books.find(b => b.primary) || booksSorted()[0];
function accLabel(id, x) {
  const a = x.acc.get(id); if (!a) return 'Deleted account';
  const b = x.book.get(a.bookId);
  return b && !b.primary ? `${b.name} · ${a.name}` : a.name;
}
function forWhomLabel(t, x) {
  if (t.type !== 'expense' || !t.forWhom) return '';
  if (t.forWhom === 'home') return 'for Home';
  const b = x.book.get(t.forWhom);
  const accBook = x.acc.get(t.accountId)?.bookId;
  return b && b.id !== accBook ? 'for ' + b.name : '';
}
const txBook = (t, x) => x.acc.get(t.accountId)?.bookId;
function cardDue(a, x) {
  const out = -(x.bal.get(a.id) || 0);
  if (!a.dueDay || out <= 0) return null;
  const t = today(), k = thisMonth();
  let due = `${k}-${pad(Math.min(+a.dueDay, daysIn(k)))}`;
  if (due < t) { const n = addMonths(k, 1); due = `${n}-${pad(Math.min(+a.dueDay, daysIn(n)))}`; }
  return { amount: out, date: due, days: daysBetween(t, due) };
}

/* ============================================================
   UI state, rendering, routing
   ============================================================ */
const app = document.getElementById('app');
const UI = Object.assign({ book: 'all', txMonth: thisMonth(), q: '', txType: '', txCat: '', txAcc: '', txStore: '', chitTab: 'month', chitMonth: {}, repMode: 'month', repMonth: thisMonth(), repYear: today().slice(0, 4), catTab: 'expense', homeMonth: thisMonth() }, lsGet(LS.ui, {}));
UI.q = '';
function setUI(k, v) { UI[k] = v; lsSet(LS.ui, { book: UI.book, chitTab: UI.chitTab, repMode: UI.repMode, catTab: UI.catTab }); scheduleRender(); }
let locked = false, rq = 0, lastRoute = '';
const scheduleRender = () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; render(); }); };

const NAV = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'txns', label: 'Entries', icon: 'receipt_long' },
  { id: 'chits', label: 'Chits', icon: 'groups' },
  { id: 'people', label: 'People', icon: 'handshake' },
  { id: 'more', label: 'More', icon: 'menu' }
];
const NAV_OF = { chit: 'chits', person: 'people', accounts: 'more', account: 'more', reports: 'more', cats: 'more', recurring: 'more', sync: 'more' };
function route() {
  const [p, a] = location.hash.replace(/^#\/?/, '').split('/');
  return { p: PAGES[p] ? p : 'home', a: a ? decodeURIComponent(a) : '' };
}
function go(h) {
  if (sheetOpen) closeSheet();
  if (popPending) queuedHash = h; else location.hash = h;
}

function render() {
  if (locked) return renderLock();
  if (!store) return renderWelcome();
  if (!ready()) { app.innerHTML = `<div class="center-screen"><img src="icons/icon-192.png" alt=""><p class="muted">Loading your money book…</p></div>`; return; }
  if (!D.books.length) return renderSetup();
  const { p, a } = route();
  const key = p + '/' + a;
  const act = document.activeElement, fid = act && act.id && app.contains(act) ? act.id : null;
  const sel = fid && act.selectionStart;
  let pg;
  try { pg = PAGES[p](a); }
  catch (e) { console.error(e); pg = { title: 'Oops', body: `<div class="banner">${ic('error')}<div>Something went wrong showing this page: ${esc(e.message)}</div></div>` }; }
  app.innerHTML = shell(pg, NAV_OF[p] || p);
  if (pendingShare) setTimeout(handleShare, 60);
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { el.setSelectionRange(sel, sel); } catch { /* not a text input */ } } }
  if (key !== lastRoute) { lastRoute = key; window.scrollTo(0, 0); }
}

function shell(pg, active) {
  const nav = NAV.map(n => `<a class="nav-item ${n.id === active ? 'on' : ''}" href="#/${n.id}"><span class="pill">${ic(n.icon)}</span><span>${n.label}</span></a>`).join('');
  const sync = store.kind === 'cloud'
    ? `<a class="icon-btn" href="#/sync" title="${navigator.onLine ? 'Synced with cloud' : 'Offline – changes will sync later'}">${ic(navigator.onLine ? 'cloud_done' : 'cloud_off')}</a>`
    : `<a class="icon-btn" href="#/sync" title="Saved on this device only">${ic('phone_android')}</a>`;
  const fabLabel = pg.fabLabel || 'Add entry';
  const fab = pg.fab === false ? '' : `<button class="fab" data-act="${pg.fabAct || 'addEntry'}" ${pg.fabData || ''} aria-label="${esc(fabLabel)}" title="${esc(fabLabel)}">${ic(pg.fabIcon || 'add')}<span>${fabLabel}</span></button>`;
  return `<div class="layout">
    <nav class="rail"><div class="brand"><img src="icons/icon-192.png" alt="Exsy"></div>${nav}</nav>
    <div class="main">
      <header class="topbar">
        ${pg.back ? `<a class="icon-btn" href="${pg.back}" aria-label="Back">${ic('arrow_back')}</a>` : `<div class="brand"><img src="icons/icon-192.png" alt=""></div>`}
        <h1>${esc(pg.title)}</h1>
        <div class="actions">${pg.actions || ''}${sync}</div>
      </header>
      <main class="content">${storeErr ? `<div class="banner">${ic('warning')}<div>${esc(storeErr)}</div></div>` : ''}${pg.body}</main>
    </div>
    <nav class="navbar">${nav}</nav>
    ${fab}
  </div>`;
}

/* ---------- sheets (bottom sheet on phone, dialog on laptop) ---------- */
let sheetOpen = false, popPending = false, queuedPush = false, queuedHash = '';
const sheetRoot = document.getElementById('sheet-root');
// Each open sheet adds a history entry so the phone's Back button closes it.
// history.back() is asynchronous, so a sheet opened (or a page change) right after closing waits for that pop.
function openSheet(html) {
  sheetRoot.innerHTML = `<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="handle"></div>${html}</div>`;
  sheetRoot.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (!sheetOpen) {
    sheetOpen = true;
    if (popPending) queuedPush = true; else history.pushState({ sheet: 1 }, '');
  }
  return sheetRoot.querySelector('.sheet');
}
function closeSheet(fromPop) {
  if (!sheetOpen) return;
  sheetOpen = false;
  sheetRoot.classList.remove('open');
  sheetRoot.innerHTML = '';
  document.body.style.overflow = '';
  if (queuedPush) queuedPush = false;
  else if (!fromPop && history.state && history.state.sheet) { popPending = true; history.back(); }
}
window.addEventListener('popstate', () => {
  if (popPending) {
    popPending = false;
    if (queuedPush) { queuedPush = false; history.pushState({ sheet: 1 }, ''); }
    if (queuedHash) { const h = queuedHash; queuedHash = ''; location.hash = h; }
    return;
  }
  if (sheetOpen) closeSheet(true);
});
const sheetHead = (title, extra = '') => `<div class="sheet-head"><h2>${esc(title)}</h2>${extra}<button type="button" class="icon-btn" data-act="closeSheet" aria-label="Close">${ic('close')}</button></div>`;
function confirmSheet({ title, text, ok = 'OK', danger, onOk, typeWord }) {
  const s = openSheet(`${sheetHead(title)}<div class="sheet-body"><p class="lead">${text}</p>
    ${typeWord ? `<label class="field"><span>Type ${typeWord} to confirm</span><input id="cf-word" autocomplete="off"></label>` : ''}</div>
    <div class="sheet-actions"><button class="btn text" data-act="closeSheet">Cancel</button><button class="btn filled ${danger ? 'danger' : ''}" id="cf-ok">${esc(ok)}</button></div>`);
  s.querySelector('#cf-ok').onclick = () => {
    if (typeWord && s.querySelector('#cf-word').value.trim().toUpperCase() !== typeWord) { s.querySelector('#cf-word').focus(); return; }
    closeSheet(); onOk();
  };
}

/* ---------- snackbar ---------- */
let snackT = 0;
function snack(msg, action) {
  const el = document.getElementById('snack');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { el.classList.remove('show'); action.fn(); };
  el.classList.add('show');
  clearTimeout(snackT);
  snackT = setTimeout(() => el.classList.remove('show'), action ? 6000 : 3000);
}

/* ---------- form bits ---------- */
const chip = (name, value, label, on, icon, cls = '') => `<label class="chip ${cls}"><input type="radio" name="${name}" value="${esc(value)}" ${on ? 'checked' : ''}><span>${icon ? ic(icon) : ''}${esc(label)}</span></label>`;
const field = (label, input, hint = '') => `<label class="field"><span>${esc(label)}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`;
const readForm = f => Object.fromEntries(new FormData(f));
function accChips(name, sel, filter) {
  return booksSorted().map(b => {
    const accs = accsOf(b.id).filter(a => !filter || filter(a));
    if (!accs.length) return '';
    return `<div class="chip-group"><span class="chip-group-label">${esc(b.name)}</span>${accs.map(a => chip(name, a.id, a.name, a.id === sel, ACC_T[a.type]?.icon)).join('')}</div>`;
  }).join('');
}
// Chip list showing the `limit` most used items, with a "More" toggle for the rest
function usageChips(name, items, sel, use, limit = 9) {
  const sorted = items.slice().sort((a, b) => (use.get(b.id) || 0) - (use.get(a.id) || 0) || byName(a, b));
  const top = new Set(sorted.slice(0, limit).map(i => i.id));
  if (sel) top.add(sel);
  const extra = sorted.length > top.size;
  return `<div class="chips ${extra ? 'collapsed' : ''}">${sorted.map(i => chip(name, i.id, i.name, i.id === sel, i.icon, top.has(i.id) ? '' : 'extra')).join('')}
    ${extra ? `<button type="button" class="btn text sm" data-more>${ic('expand_more')}More</button>` : ''}</div>`;
}
function wireMore(root) {
  $$('[data-more]', root).forEach(b => b.onclick = () => { b.parentElement.classList.remove('collapsed'); b.remove(); });
}
function monthNav(key, value, label) {
  return `<div class="month-nav"><button class="icon-btn" data-act="monthStep" data-k="${key}" data-d="-1" aria-label="Previous">${ic('chevron_left')}</button><b>${esc(label)}</b><button class="icon-btn" data-act="monthStep" data-k="${key}" data-d="1" aria-label="Next">${ic('chevron_right')}</button></div>`;
}
const download = (name, text, type) => downloadBlob(name, new Blob([text], { type }));
function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function copyText(t, msg) {
  try { await navigator.clipboard.writeText(t); snack(msg || 'Copied'); }
  catch { prompt('Copy this:', t); }
}
