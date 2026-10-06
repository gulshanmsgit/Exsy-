# Exsy – notes for Claude

Personal money book for the owner (manages own, mother's and father's money; runs a chit business as organizer only).
Repo: https://github.com/gulshanmsgit/Exsy- (push to `main` directly). Hosted on GitHub Pages. Separate from ExamSim
(Project_Y) – do not touch that project from here.

## Architecture
- No build step. `index.html` loads `app.js` → `pages.js` → `chit.js` → `more.js` (classic scripts sharing globals; boot is at
  the end of `more.js`). Material 3 tokens in `app.css` (`[data-theme=dark]` set by `applyTheme`).
- Icons: Material Symbols Rounded, downloaded as a subset – every icon name must be in `ICON_CHOICES` or `UI_ICONS`
  (`app.js`); `ic()` warns in the console otherwise.
- Data: `D[collection]` arrays; `save(c, doc)` / `removeDoc` / `removeMany` (with Undo) update memory first, then the store.
  Store is `localStore()` (localStorage key `exsy.local`) or `cloudStore()` (Firestore `moneybooks/{syncCode}/{coll}/{id}`,
  live `onSnapshot`, offline cache). Adding a collection = add to `COLLS` **and** `firestore.rules`.
- Balances are never stored: `X()` derives them (opening + txns + chit payments − chit payouts), memoised on `VER`.
- Txn types: expense, income, transfer, lend, collect (got back), borrow, repay. Person balance > 0 = they owe the owner.
- Chit: `chitInfo(ch)` computes everything (status per member/month, overdue, winners, cash held). Draw picks with
  `crypto.getRandomValues` from members without a win; payout default = monthly × members − commission (₹2,500).
- Sheets push a history entry so phone Back closes them; `go()` / `openSheet` queue around the async `history.back()`.
- Firebase: own project exsy-591a1 (owner created it 6 Oct 2026; NOT shared with ExamSim any more), data under
  `moneybooks/{code}/…` (`FIRESTORE_ROOT`).
- `quick.js`: `parsePayText` (bank SMS / UPI text → amount, dir, party, ref, date, mode, account via `last4` or bank name),
  `entryFromText` routes to chit payment (`matchChitMember`) → person (lend/collect) → shop (expense + `catForStore`).
  Manifest `share_target` (GET ?text=) → `takeSharedText`/`handleShare`. Balance corrections use category "Balance correction".
- PDFs: `pdf.js` (jsPDF + autotable from cdnjs, lazy). Built-in font has no ₹ → `pt()`/`rs()` write "Rs.".
  `openShareSheet` builds the PDF on open so `navigator.share` still has the tap's user activation.
- Payments record `mode` (Cash/UPI/Bank transfer/Cheque) and `accountId` (where the money went); `accForMode` remembers
  the account last used per mode.
- `extras.js`: quick buttons live in `prefs/quick` (`items` array) – no extra Firestore collection; swipe rows are
  `.swipe[data-id]` wrappers from `txRow`; `pendingColls`/`lastSyncAt` fed by `onData` (snapshots with metadata changes);
  `scheduleRender` has a timer fallback because rAF stops in background tabs.
- `home.js` (Mother's money): `prefs/home` {payerBook, monthly:{from,amount} (one setting, Save replaces; legacy `salary` list read as its latest entry), salaryDay, arrears (default true: month M's money is added on the pay day of M+1), since}. `motherLedger()` =
  monthly money (computed, no entries) − home claims (expense forWhom 'home' from a non-Mother account, `homeClaim !== false`)
  − transfers Me→Mother + transfers Mother→Me, counted from `since`. Route `#/mother` (`#/homecosts` kept as alias).
- NEVER add Co-Authored-By / AI attribution to commits (owner's explicit rule, 6 Oct 2026).
- Bump `CACHE` in `sw.js` when shipping changes.

## Status (6 Oct 2026)
- v1.0 built and tested locally with sample data (all pages and sheets, chit draw/payout maths, lend via card).
- v1.1: PDF statements + share with reminder (people, chit members, chit group, reports); payment method + "money went
  to" on chit payments/payouts; ExamSim's Firebase config built in.
- v1.2: own Firebase project, paste/share payment messages, "Where the money is" + cash count, shop→category suggestion.
- v1.3: phone overlap fixes, quick buttons, swipe, pull to refresh, calendar, search, hide amounts, vibration, collection day.
- v1.6: monthly money fix (Save replaced nothing → wrong start month kept counting), paid-next-month rule, redraw on resume/date change.
- v1.5: simplified to one "Mother's money" balance (monthly money + home costs + given/received); switch moved up in the entry form.
- Owner must create the Firestore database in exsy-591a1 and publish `firestore.rules` before sync works.
- Owner built an APK with PWABuilder (6 Oct 2026); rebuild it once so `share_target` is included. assetlinks.json would
  need a `gulshanmsgit.github.io` repo (app is in a sub-path) to hide the URL bar.
- Owner asked about an APK: PWABuilder (pwabuilder.com) once Pages is live – README "Android app".
- GitHub Pages must be switched on by the owner (Settings → Pages → main / root).

## Owner preferences
- Writes quickly with typos – infer intent; plain, structured replies.
- Wants Material ("Google Material") UI, mobile first but usable on laptop.
- Never delete the owner's files/data without asking.
