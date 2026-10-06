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
- Firebase: SAME project as ExamSim (examsim-4db41), data under `moneybooks/{code}/…` (`FIRESTORE_ROOT`). The project has
  ONE rules file: `firestore.rules` here holds ExamSim's block + Exsy's block – keep both whenever either changes.
- PDFs: `pdf.js` (jsPDF + autotable from cdnjs, lazy). Built-in font has no ₹ → `pt()`/`rs()` write "Rs.".
  `openShareSheet` builds the PDF on open so `navigator.share` still has the tap's user activation.
- Payments record `mode` (Cash/UPI/Bank transfer/Cheque) and `accountId` (where the money went); `accForMode` remembers
  the account last used per mode.
- Bump `CACHE` in `sw.js` when shipping changes.

## Status (6 Oct 2026)
- v1.0 built and tested locally with sample data (all pages and sheets, chit draw/payout maths, lend via card).
- v1.1: PDF statements + share with reminder (people, chit members, chit group, reports); payment method + "money went
  to" on chit payments/payouts; ExamSim's Firebase config built in.
- Owner must publish the combined `firestore.rules` in examsim-4db41 before sync works.
- Owner asked about an APK: PWABuilder (pwabuilder.com) once Pages is live – README "Android app".
- GitHub Pages must be switched on by the owner (Settings → Pages → main / root).

## Owner preferences
- Writes quickly with typos – infer intent; plain, structured replies.
- Wants Material ("Google Material") UI, mobile first but usable on laptop.
- Never delete the owner's files/data without asking.
