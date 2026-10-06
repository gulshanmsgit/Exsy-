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

## Turn on sync (uses the same Firebase project as ExamSim)

Exsy is already connected to the ExamSim Firebase project (`examsim-4db41`); its data lives in a separate top-level
collection, `moneybooks/…`, so it never mixes with ExamSim's `workspaces/…`.

1. **Publish the combined rules once:** <https://console.firebase.google.com> → project **examsim-4db41** →
   **Firestore Database → Rules** → replace everything with the contents of [`firestore.rules`](firestore.rules) → **Publish**.
   This file contains ExamSim's rules *and* Exsy's. A project has only one rules file, so always publish the complete
   file – publishing an older ExamSim-only file would lock Exsy out (and the other way round).
2. In Exsy: **More → Sync & devices → Create my sync code**. Entries already on the device are copied to the cloud.
3. **Copy device link** and open it once on your other phone or laptop – it opens straight into the same money book.

Keep the sync code / device link private: whoever has it can open the book.

## PDF statements and reminders

- **People → a person → Remind / Statement:** edit the reminder text, then **Share PDF + message** (pick WhatsApp),
  **Download PDF**, or **Message only**.
- **Chit → member → Statement PDF**, and the PDF icon at the top of a chit for the whole group report.
- **Reports → PDF** for the month/year shown.

## Android app (APK)

Once GitHub Pages is live, go to <https://www.pwabuilder.com>, enter `https://gulshanmsgit.github.io/Exsy-/`,
choose **Package for stores → Android** and download the package; the `.apk` inside installs on the phone
(allow "install unknown apps"). Simpler alternative: Chrome → ⋮ → **Add to Home screen / Install app**.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell |
| `app.css` | Material 3 styles (light + dark) |
| `app.js` | Storage (this device / Firestore), balances, rendering, helpers |
| `pages.js` | Entry form, Home, Entries, Accounts, People |
| `chit.js` | Chit groups, collections, draw, payouts |
| `pdf.js` | PDF statements/reports and the share sheet |
| `more.js` | Reports, settings, sync, categories, reminders, setup, lock, start-up |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable app + offline |
| `firestore.rules` | Firestore security rules |

Run locally: `python -m http.server 8642` in this folder, then open <http://127.0.0.1:8642>.
