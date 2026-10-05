// A printable guest registration card for one booking: what the front desk
// keeps on paper with the guest's signature. Built as a small standalone page
// and opened in a new window, so it prints without the admin screen around it.

import { inr as rupees } from './bookingUi';
import { SITE_NAME } from './site';

// Booking data is typed by guests and staff, so nothing goes into the page unescaped.
const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const date = (iso) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const ID_LABEL = { Aadhaar: 'Aadhaar', Passport: 'Passport', DrivingLicense: 'Driving licence' };

function cardHtml(b, address) {
  const ids = b.documents.filter((d) => !d.purged_at);
  const row = (label, value) => `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Registration card — ${esc(b.reference || `Booking ${b.id}`)}</title>
<style>
  body { font: 14px/1.5 Georgia, 'Times New Roman', serif; color: #111; margin: 32px; }
  h1 { font-size: 22px; margin: 0; }
  .sub { color: #555; margin: 2px 0 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ccc; vertical-align: top; }
  th { width: 34%; font-weight: normal; color: #555; }
  h2 { font-size: 15px; margin: 18px 0 6px; }
  .sign { display: flex; gap: 40px; margin-top: 56px; }
  .sign div { flex: 1; border-top: 1px solid #111; padding-top: 6px; color: #555; }
  @media print { body { margin: 12mm; } button { display: none; } }
</style>
</head>
<body>
<h1>${esc(SITE_NAME)} — Guest registration</h1>
<p class="sub">${esc(address || '')}</p>
<table>
${row('Booking', `${b.reference || ''} (#${b.id})`)}
${row('Guest', b.guest_name)}
${row('Phone', b.guest_phone)}
${b.guest_email ? row('Email', b.guest_email) : ''}
${row('Room', `${b.unit_number} · ${b.room_type}`)}
${row('Check-in', date(b.check_in))}
${row('Check-out', date(b.check_out))}
${row('Guests', `${b.adults} adult${b.adults > 1 ? 's' : ''}${b.children ? `, ${b.children} child${b.children > 1 ? 'ren' : ''}` : ''}`)}
${row('Total, including GST', rupees(b.total_amount))}
${row('Paid', rupees(b.amount_paid))}
${Number(b.balance_due) > 0 ? row('Balance due', rupees(b.balance_due)) : ''}
</table>
<h2>Identity documents seen</h2>
<table>
${ids.length ? ids.map((d) => row(`${d.guest_name}${d.is_primary ? ' (primary)' : ''}`, `${ID_LABEL[d.id_type] || d.id_type} ending ${d.id_last4} · ${d.nationality}`)).join('\n') : row('None recorded yet', '')}
</table>
<div class="sign"><div>Guest signature</div><div>Front desk</div><div>Date</div></div>
<p style="margin-top:28px"><button onclick="window.print()">Print</button></p>
</body>
</html>`;
}

/** Opens the card in a new window and brings up the print dialog. `b`: the full booking. */
export function printRegistrationCard(b, address) {
  const win = window.open('', '_blank', 'width=820,height=900');
  if (!win) return false; // pop-ups blocked
  win.document.open();
  win.document.write(cardHtml(b, address));
  win.document.close();
  win.focus();
  win.print();
  return true;
}
