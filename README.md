# Exsy – Money Book

A personal money tracker for phone and laptop, built with Material Design 3. Free to host on GitHub Pages, with
optional sync through your own Firebase (Firestore) project.

- **Books** – keep your money, your mother's and your father's money apart, each with its own cash and bank accounts
  (SBI, Canara, ICICI salary, Groww investments, credit card…).
- **Entries** – expenses, income, transfers between any accounts, lending and borrowing. Categories (groceries, milk,
  medical, bills…), shops (DMart, Amazon, kirana…), "for whom" (Home, Me, Mother, Father). Amounts can be sums: `250+120`.
- **People** – who owes you and how much, lending even from your credit card, part repayments, due dates,
  WhatsApp reminders.
- **Chit business** – groups of members paying monthly, collection grid, overdue list, random draw among members who
  have not won yet, payout of pot minus your commission (₹60,000 − ₹2,500 = ₹57,500 by default), statements.
- **Home** – total money per book, cash/bank/invested/card due, this month's spending, and a "Needs attention" list
  (chit overdue, draws, payouts, card bills, monthly bills, overdue loans).
- **Reports**, CSV export, JSON backup/restore, app lock PIN, light/dark theme, works offline, installable.

## Use it

Open the site, choose **Start on this device**, then **Create my money book** (or try the sample data first).
On a phone: browser menu → **Add to Home screen** to install it like an app.

## Turn on GitHub Pages (one time)

GitHub → this repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch **main**, folder **/ (root)** → Save.
After a minute the app is at `https://gulshanmsgit.github.io/Exsy-/`.

## Turn on sync (Firebase, free plan)

1. <https://console.firebase.google.com> → **Add project** (e.g. `exsy-money`; Google Analytics not needed).
2. **Build → Firestore Database → Create database** → production mode → a location near you (e.g. `asia-south1`).
3. **Firestore → Rules** → paste the contents of [`firestore.rules`](firestore.rules) → **Publish**.
4. **Project settings → Your apps → Web (`</>`)** → register the app → copy the `firebaseConfig` block.
5. In Exsy: **More → Sync & devices** → paste the config → **Create my sync code**. Your entries are copied to the cloud.
6. **Copy device link** and open it once on your other phone/laptop – it opens straight into the same money book.

Keep the sync code / device link private: whoever has it can open the book. (The config can also be pasted into
`FIREBASE_CONFIG` in `app.js` so other devices only need the code.)

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell |
| `app.css` | Material 3 styles (light + dark) |
| `app.js` | Storage (this device / Firestore), balances, rendering, helpers |
| `pages.js` | Entry form, Home, Entries, Accounts, People |
| `chit.js` | Chit groups, collections, draw, payouts |
| `more.js` | Reports, settings, sync, categories, reminders, setup, lock, start-up |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable app + offline |
| `firestore.rules` | Firestore security rules |

Run locally: `python -m http.server 8642` in this folder, then open <http://127.0.0.1:8642>.
