'use strict';
/* Google sign-in. Each signed-in person's money book lives under users/{uid} and the Firestore rules let only that
   account read or write it. The sync-code way (moneybooks/{code}) keeps working next to it.
   Signing in from "this device only" or from a sync code copies that data into the account once – only when the
   account is still empty, so nothing is ever overwritten. */

const MIGRATE = 'exsy.migrateFrom';
const isAccountMode = () => lsGet(LS.mode, '') === 'account';
// Inside the Android app Google blocks its sign-in page in web views, so the phone's own account picker is used
// (@capacitor-firebase/authentication, skipNativeAuth) and its ID token signs in the web Firebase SDK.
const isNativeApp = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
let nativeAuthPlugin = null;
// no bundler here, so @capacitor/core's registerPlugin is not loaded – the native bridge lists the plugin on Capacitor.Plugins
const nativeAuth = () => nativeAuthPlugin || (nativeAuthPlugin = (window.Capacitor.Plugins || {}).FirebaseAuthentication ||
  (window.Capacitor.registerPlugin && window.Capacitor.registerPlugin('FirebaseAuthentication')));
async function nativeGoogleSignIn(fb) {
  const r = await nativeAuth().signInWithGoogle();
  const idToken = r && r.credential && r.credential.idToken;
  if (!idToken) throw Object.assign(new Error('No Google token'), { code: 'native/no-token' });
  await fb.Au.signInWithCredential(fb.auth, fb.Au.GoogleAuthProvider.credential(idToken));
}

async function googleSignIn() {
  const cfg = FIREBASE_CONFIG || lsGet(LS.cfg, null);
  if (!cfg) { snack('Firebase is not set up'); return; }
  // remember where the current data is, so it can be moved into the account after sign-in
  const prev = lsGet(LS.mode, ''), code = lsGet(LS.code, '');
  const hasLocal = Object.values(lsGet(LS.local, {}) || {}).some(c => Object.keys(c || {}).length);
  lsSet(MIGRATE, prev === 'cloud' && code ? { mode: 'cloud', code } : hasLocal ? { mode: 'local' } : null);
  let fb;
  try { fb = await fbInit(cfg); } catch (e) { console.error(e); snack('Could not load Google sign-in – check the internet connection'); return; }
  const provider = new fb.Au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    if (isNativeApp()) await nativeGoogleSignIn(fb);
    else await fb.Au.signInWithPopup(fb.auth, provider);
  } catch (e) {
    const c = e && e.code, msg = String(e && e.message || '');
    console.error('sign-in', c, msg);
    if (isNativeApp()) {
      lsSet(MIGRATE, null);
      if (/cancel/i.test(msg)) snack('Sign-in cancelled');
      else if (/network|internet/i.test(msg)) snack('No internet – try again when online');
      else if (/developer|10:|12500|not configured|google-services|default firebaseapp/i.test(msg)) snack('Google sign-in is not set up for this app yet (Firebase Android app / SHA-1)');
      else snack('Sign-in failed: ' + (c || msg));
      return;
    }
    if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment') {
      lsSet(LS.mode, 'account');                     // the app comes back after Google's page and finishes in connect()
      await fb.Au.signInWithRedirect(fb.auth, provider);
      return;
    }
    lsSet(MIGRATE, null);
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') snack('Sign-in cancelled');
    else if (c === 'auth/unauthorized-domain') snack('Add this website in Firebase → Authentication → Settings → Authorized domains');
    else if (c === 'auth/operation-not-allowed') snack('Turn on Google in Firebase → Authentication → Sign-in method');
    else if (c === 'auth/network-request-failed') snack('No internet – try again when online');
    else snack('Sign-in failed: ' + (c || e.message));
    return;
  }
  lsSet(LS.mode, 'account');
  await connect('account');
  closeSheet();
  if (location.hash !== '#/home') go('#/home'); else render();
  snack(`Signed in as ${authUser?.email || 'your Google account'}`);
}

function googleSignOut() {
  confirmSheet({
    title: 'Sign out on this device?', ok: 'Sign out',
    text: `Your money book stays safe in ${esc(authUser?.email || 'your Google account')}. Sign in again with the same account to open it on any device.`,
    onOk: async () => {
      try { if (fbMods) await fbMods.Au.signOut(fbMods.auth); } catch (e) { console.error(e); }
      if (isNativeApp()) try { await nativeAuth().signOut(); } catch (e) { console.error(e); }   // forget the phone's chosen account too
      authUser = null; lsSet(LS.mode, ''); await forgetCloudCopy();
    }
  });
}

/* Delete my account and data (Google Play requires this for apps with sign-in).
   1. type DELETE  2. confirm with Google again (Firebase only deletes accounts after a fresh sign-in)
   3. delete every record under users/{uid}  4. delete the sign-in account  5. clear this device */
function deleteAccountStart() {
  const s = openSheet(`${sheetHead('Delete account and data')}
    <div class="banner">${ic('warning')}<div>This deletes <b>everything</b> in this money book – accounts, entries, people, chits, EMIs, budgets – on all your devices, and your Exsy sign-in. It cannot be undone.</div></div>
    <p class="lead" style="margin-top:12px">Want to keep a copy? <button type="button" class="btn text sm" data-act="backup">${ic('download')}Download backup first</button></p>
    <form id="da-form" autocomplete="off">${field('Type DELETE to confirm', '<input name="confirm" autocapitalize="characters" placeholder="DELETE">')}
      <div class="sheet-actions"><button type="button" class="btn text" data-act="closeSheet">Cancel</button>
        <button class="btn filled danger" type="submit">${ic('delete_forever')}Delete everything</button></div></form>`);
  s.querySelector('#da-form').onsubmit = e => {
    e.preventDefault();
    if (String(readForm(e.target).confirm || '').trim().toUpperCase() !== 'DELETE') { snack('Type DELETE to confirm'); return; }
    closeSheet(); deleteAccountNow();
  };
}
async function deleteAccountNow() {
  const fb = fbMods, user = fb && fb.auth.currentUser;
  if (!user || user.isAnonymous) { snack('Sign in with Google first'); return; }
  try {   // fresh sign-in with the same account
    if (isNativeApp()) {
      const r = await nativeAuth().signInWithGoogle();
      const idToken = r && r.credential && r.credential.idToken;
      if (!idToken) throw Object.assign(new Error('No Google token'), { code: 'native/no-token' });
      await fb.Au.reauthenticateWithCredential(user, fb.Au.GoogleAuthProvider.credential(idToken));
    } else {
      const provider = new fb.Au.GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account', login_hint: user.email || '' });
      await fb.Au.reauthenticateWithPopup(user, provider);
    }
  } catch (e) {
    const c = e && e.code, msg = String(e && e.message || '');
    console.error('re-auth', c, msg);
    snack(c === 'auth/user-mismatch' ? 'Choose the same Google account you are signed in with' : /cancel|closed/i.test(c + msg) ? 'Not deleted – sign-in was cancelled' : 'Not deleted – could not confirm your Google account');
    return;
  }
  snack('Deleting your money book…');
  try {
    if (store) store.stop();
    const { F, db } = fb;
    for (const c of COLLS) {
      const snap = await F.getDocs(F.collection(db, 'users', user.uid, c));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = F.writeBatch(db);
        snap.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
        await b.commit();
      }
    }
    await user.delete();
  } catch (e) {
    console.error('delete account', e);
    snack('Could not finish deleting – check the internet and try again. Nothing else was changed.');
    return;
  }
  if (isNativeApp()) try { await nativeAuth().signOut(); } catch (e) { console.error(e); }
  for (const k of [LS.mode, LS.code, LS.local, MIGRATE, 'exsy.homeLayout', 'exsy.nav']) try { localStorage.removeItem(k); } catch { /* storage blocked */ }
  authUser = null;
  lsSet('exsy.deleted', Date.now());     // the welcome screen confirms it after the reload
  await forgetCloudCopy();
}

// Copy the old data into the signed-in account – only into an empty account, in batches of 400
async function migrateIntoAccount(src) {
  if (!src || !authUser || !fbMods) return;
  const t0 = Date.now();
  while (!ready() && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 250));
  if (D.books.length) { lsSet(MIGRATE, null); snack('Opened the money book already in your Google account'); return; }
  const { F, db } = fbMods;
  let data = {};
  try {
    if (src.mode === 'local') data = lsGet(LS.local, {}) || {};
    else if (src.mode === 'cloud' && src.code) {
      for (const c of COLLS) {
        const s = await F.getDocs(F.collection(db, FIRESTORE_ROOT, src.code, c));
        data[c] = Object.fromEntries(s.docs.map(d => [d.id, d.data()]));
      }
    }
    const items = [];
    for (const [c, docs] of Object.entries(data)) if (COLLS.includes(c)) for (const [id, d] of Object.entries(docs || {})) items.push([c, id, d]);
    if (!items.length) { lsSet(MIGRATE, null); return; }
    snack(`Moving ${items.length} records to your Google account…`);
    for (let i = 0; i < items.length; i += 400) {
      const b = F.writeBatch(db);
      for (const [c, id, d] of items.slice(i, i + 400)) b.set(F.doc(db, 'users', authUser.uid, c, id), clean(d));
      await b.commit();
    }
    lsSet(MIGRATE, null);
    snack(`Done – ${items.length} records are now in your Google account`);
  } catch (e) {
    console.error(e);
    snack(e && e.code === 'permission-denied' ? 'Firestore refused – publish the new firestore.rules first, then sign in again' : 'Could not move the data – it is still safe where it was');
  }
}

/* ---------- screens ---------- */
const googleBtn = (label = 'Continue with Google') => `<button class="btn google-btn" data-act="googleSignIn"><span class="g-logo" aria-hidden="true">G</span>${label}</button>`;
function accountCard() {
  const u = authUser || {};
  return `<div class="card primary"><div style="display:flex;gap:14px;align-items:center">
      ${u.photoURL ? `<img src="${esc(u.photoURL)}" alt="" class="acc-photo" referrerpolicy="no-referrer">` : `<span class="avatar">${ic('account_circle')}</span>`}
      <div style="flex:1;min-width:0"><b style="font-size:17px;font-weight:500">${esc(u.displayName || 'Google account')}</b><div class="hero-label">${esc(u.email || '')}</div></div></div>
      <p style="margin-top:12px">${ic('verified_user', 'sm')} Your money book is private to this Google account. Sign in with the same account on your phone, laptop or tablet to see it everywhere – live, and offline too.</p></div>
    <div class="card" style="margin-top:12px"><div class="card-title">${ic('logout')}Sign out on this device</div>
      <p class="muted" style="margin-bottom:12px">Your data stays in your account. This device goes back to the start screen.</p>
      <button class="btn outlined" data-act="googleSignOut">${ic('logout')}Sign out</button></div>
    <div class="card" style="margin-top:12px"><div class="card-title">${ic('delete_forever')}Delete my account and data</div>
      <p class="muted" style="margin-bottom:12px">Removes this money book from all your devices and deletes your Exsy sign-in. Your Google account itself is not touched.</p>
      <button class="btn outlined danger" data-act="deleteAccount">${ic('delete_forever')}Delete my account and data</button></div>`;
}
