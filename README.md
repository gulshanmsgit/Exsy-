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

## Turn on sync (Firebase project `exsy-591a1`)

The app already contains the config of the Exsy Firebase project. One-time setup in <https://console.firebase.google.com>:

1. **Build → Firestore Database → Create database** → production mode → location `asia-south1 (Mumbai)`.
2. **Firestore → Rules** → replace everything with [`firestore.rules`](firestore.rules) → **Publish**.
3. In Exsy: **More → Sync & devices → Create my sync code** (entries already on the device are copied up).
4. **Copy device link** and open it once on your other phone/laptop – it opens straight into the same money book.

Keep the sync code / device link private: whoever has it can open the book.

## Faster entries

- **Paste bank SMS / UPI message** (Home, or *Paste SMS* in the entry form): Exsy reads amount, paid/received,
  account (bank name or the last 4 digits you set on the account), date, UPI ref and the person or shop.
  A name in People becomes *Lent* / *Got back*; a chit member who still owes becomes their chit payment;
  a shop gets its usual category.
- **Share into Exsy:** in the installed app, Share a GPay / PhonePe / SMS text → Exsy (needs the app rebuilt in
  PWABuilder after this update so Android knows Exsy accepts shared text).
- **Where the money is** (Home): every cash and bank balance; the button on the right counts cash / updates a bank
  balance and records the difference as a "Balance correction".

## Mother's money (home costs + her monthly money)

One number on **More → Mother's money** (also shown on Home): how much of Mother's money you are keeping.

- **+ her monthly money:** set the amount and the first month once (e.g. ₹5,000 from Sep 2026, given on the 1st of
  the next month – paid in October = September's money). Saving again replaces the setting. Added automatically each
  month – the money can stay in your account, no entry needed.
- **− home costs you pay:** add an Expense with **For whom: Home** from your own account; the switch
  **“Take it from Mother's money”** (right under *For whom*) is on. Switch it off for the few that are yours.
- **− money you give her / + money she gives you:** the two buttons on the page (or any transfer between your
  accounts and hers).
- Positive = *Mother's money with you*; negative = *Mother owes you*. Month-by-month statement on the same page.

## Everyday shortcuts

- **Quick buttons:** tick *Also add as a quick button* when saving an entry; it appears on Home and one tap saves it
  for today (Undo in the message). Rename / reorder / remove: More → Quick buttons.
- **Swipe an entry:** left = delete (Undo), right = copy it to today.
- **Pull down** on any screen to refresh; Home shows "Synced 2 min ago" / "Uploading…" / "Offline".
- **Calendar** (Entries → calendar icon): spending per day, no-spend days, add an entry on a chosen day.
- **Search** (magnifier at the top): people, chit members, chits, accounts, entries and amounts.
- **Hide amounts** (eye at the top): blurs every money figure when someone is looking.
- **Vibration** on save, swipe and chit draw (More → Vibration to turn off).
- **Chit collection day** (Chits → Collection day): everyone who still has to pay, most overdue first,
  with WhatsApp reminder and Paid buttons.

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
| `home.js` | Mother's money: monthly money, home costs, given / received, one running balance |
| `extras.js` | Quick buttons, swipe, pull to refresh, calendar, search, hide amounts, collection day |
| `quick.js` | Paste/share payment messages, balances card, cash count |
| `more.js` | Reports, settings, sync, categories, reminders, setup, lock, start-up |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installable app + offline |
| `firestore.rules` | Firestore security rules |

Run locally: `python -m http.server 8642` in this folder, then open <http://127.0.0.1:8642>.
