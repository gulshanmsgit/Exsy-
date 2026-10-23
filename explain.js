'use strict';
/* "What this means": a plain-words sentence for the entry being added or edited, with the effect on balances.
   e.g. "₹3,000 cash added to Gulshan's Cash. Gulshan's Cash: ₹12,000 → ₹15,000." */

// "your" for the main book while it is still called "Me", otherwise "Gulshan's", "Mother's"…
function ownerOf(bookId) {
  const b = X().book.get(bookId);
  if (!b) return '';
  return b.primary && /^me$/i.test(b.name.trim()) ? 'your' : `${b.name}’s`;
}
const accPhrase = id => { const a = X().acc.get(id); return a ? `${ownerOf(a.bookId)} ${a.name}` : 'an account'; };
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
// What an entry does to one account
function effectOn(t, id) {
  const a = num(t.amount);
  if (t.type === 'transfer') return (t.toAccountId === id ? a : 0) - (t.accountId === id ? a : 0);
  if (t.accountId !== id) return 0;
  return OUT_T.has(t.type) ? -a : IN_T.has(t.type) ? a : 0;
}
function balLine(id, delta, orig) {
  const a = X().acc.get(id); if (!a || !delta) return '';
  const before = (X().bal.get(id) || 0) - (orig ? effectOn(orig, id) : 0), after = before + delta;
  if (a.type === 'card') return `${capFirst(accPhrase(id))} due: ${inr(Math.max(0, -before))} → ${inr(Math.max(0, -after))}`;
  return `${capFirst(accPhrase(id))}: ${inr(before)} → ${inr(after)}`;
}

function meaningOf(v, orig) {
  const x = X(), amt = evalAmount(v.amount);
  if (!(amt > 0)) return 'Type the amount to see what this entry does.';
  if (!v.accountId) return 'Choose the account.';
  const A = inr(amt), acc = accPhrase(v.accountId), aObj = x.acc.get(v.accountId), isCash = aObj?.type === 'cash';
  const person = v.personId && v.personId !== '__new' ? x.person.get(v.personId)?.name : (v.newPerson || '').trim() || 'this person';
  const owes = v.personId && x.owes.get(v.personId) || 0, oldOwe = orig && orig.personId === v.personId ? (orig.type === 'lend' || orig.type === 'repay' ? 1 : -1) * num(orig.amount) : 0;
  const cat = x.cat.get(v.categoryId)?.name, shop = x.store.get(v.storeId)?.name;
  const lines = [];
  switch (v.type) {
    case 'expense': {
      const whom = v.forWhom === 'home' ? 'the home' : v.forWhom ? (x.book.get(v.forWhom)?.primary ? (ownerOf(v.forWhom) === 'your' ? 'you' : x.book.get(v.forWhom).name) : x.book.get(v.forWhom)?.name) : '';
      lines.push(`${A} paid from ${acc}${whom ? ` for ${whom}` : ''}${cat ? ` – ${cat}` : ''}${shop ? ` at ${shop}` : ''}.`);
      lines.push(balLine(v.accountId, -amt, orig));
      if (v.forWhom === 'home' && homePayer()) {
        const mom = payerName();
        if (aObj?.bookId === homePayer()) lines.push(`${mom} paid this from her own money – nothing changes between you and ${mom}.`);
        else if (claimApplies(v.accountId, v.forWhom)) {
          const L = motherLedger(), wasClaim = orig && isHomeClaim(orig) ? num(orig.amount) : 0;
          if (v.homeClaim) { const before = L.balance + wasClaim, after = before - amt; lines.push(`Taken from ${mom}’s money: ${before >= 0 ? 'with you' : `${mom} owes you`} ${inr(Math.abs(before))} → ${after >= 0 ? 'with you' : `${mom} owes you`} ${inr(Math.abs(after))}.`); }
          else lines.push(`Not taken from ${mom}’s money – this one is yours.`);
        }
      }
      break;
    }
    case 'income':
      lines.push(`${A}${isCash ? ' cash' : ''} added to ${acc}${cat ? ` – ${cat}` : ''}.`);
      lines.push(balLine(v.accountId, amt, orig));
      break;
    case 'transfer': {
      if (!v.toAccountId) return `${A} moved out of ${acc} – choose where it went.`;
      if (v.toAccountId === v.accountId) return 'From and To are the same account – choose a different one.';
      const to = x.acc.get(v.toAccountId);
      lines.push(to?.type === 'card' ? `${A} paid from ${acc} towards the ${to.name} bill.` : `${A} moved from ${acc} to ${accPhrase(v.toAccountId)}.`);
      lines.push(balLine(v.accountId, -amt, orig), balLine(v.toAccountId, amt, orig));
      const mom = homePayer(), me = meBook()?.id;
      if (mom && aObj?.bookId === me && to?.bookId === mom) lines.push(`Counts as money given to ${payerName()} (less of her money with you).`);
      if (mom && aObj?.bookId === mom && to?.bookId === me) lines.push(`Counts as money ${payerName()} gave you (more of her money with you).`);
      break;
    }
    case 'lend': lines.push(`You gave ${A} to ${person} from ${acc}.`, balLine(v.accountId, -amt, orig), `${person} will owe you ${inr(owes - oldOwe + amt)} in total.`); break;
    case 'collect': { const left = owes - oldOwe - amt; lines.push(`${person} gave back ${A} into ${acc}.`, balLine(v.accountId, amt, orig), left > 0 ? `${person} still owes you ${inr(left)}.` : left < 0 ? `That is ${inr(-left)} more than ${person} owed – now you owe ${person}.` : `${person} is fully settled.`); break; }
    case 'borrow': lines.push(`You took ${A} from ${person} into ${acc}.`, balLine(v.accountId, amt, orig), `You will owe ${person} ${inr(-(owes - oldOwe) + amt)} in total.`); break;
    case 'repay': { const left = -(owes - oldOwe) - amt; lines.push(`You paid back ${A} to ${person} from ${acc}.`, balLine(v.accountId, -amt, orig), left > 0 ? `You still owe ${person} ${inr(left)}.` : `You are settled with ${person}.`); break; }
  }
  return lines.filter(Boolean).join('\n');
}
function meaningBox() { return `<div class="meaning" id="ef-meaning" aria-live="polite"><b>${ic('info', 'sm')}What this means</b><p></p></div>`; }
function wireMeaning(form, f) {
  const box = form.querySelector('#ef-meaning p'); if (!box) return;
  const orig = f.id ? D.txns.find(t => t.id === f.id) : null;
  const upd = () => { try { box.textContent = meaningOf({ ...f, homeClaim: false, ...readForm(form), homeClaim: !!form.querySelector('input[name=homeClaim]:checked') && !form.querySelector('#ef-claim')?.classList.contains('hide') }, orig); } catch (e) { console.error(e); box.textContent = ''; } };
  form.addEventListener('input', upd);
  form.addEventListener('change', () => setTimeout(upd, 0));
  upd();
}
