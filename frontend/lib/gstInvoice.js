// The GST tax invoice for one booking, as a small standalone page opened in a
// new window so it prints without the staff screen around it (the same way the
// registration card does). What goes on it comes from
// POST /desk/bookings/:id/invoice: { booking, seller, payments }.
//
// Hotel rooms are taxed where the hotel is, so the tax is always CGST + SGST
// (half each), never IGST.

import { SITE_NAME } from './site';

// Accommodation in hotels, inns and guest houses.
const SAC_ROOM = '996311';

// The first two digits of a GSTIN say which state it is registered in.
const GST_STATES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', 10: 'Bihar', 11: 'Sikkim',
  12: 'Arunachal Pradesh', 13: 'Nagaland', 14: 'Manipur', 15: 'Mizoram', 16: 'Tripura', 17: 'Meghalaya',
  18: 'Assam', 19: 'West Bengal', 20: 'Jharkhand', 21: 'Odisha', 22: 'Chhattisgarh', 23: 'Madhya Pradesh',
  24: 'Gujarat', 26: 'Dadra and Nagar Haveli and Daman and Diu', 27: 'Maharashtra', 29: 'Karnataka', 30: 'Goa',
  31: 'Lakshadweep', 32: 'Kerala', 33: 'Tamil Nadu', 34: 'Puducherry', 35: 'Andaman and Nicobar Islands',
  36: 'Telangana', 37: 'Andhra Pradesh', 38: 'Ladakh',
};

// Booking data is typed by guests and staff, so nothing goes into the page unescaped.
const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round(Number(n) * 100) / 100;

const day = (value) =>
  value ? new Date(String(value).length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const PAID_BY = { razorpay: 'Online', cash: 'Cash', upi: 'UPI', card: 'Card' };

// ----- "Rupees Four Thousand Two Hundred Only" (Indian numbering: lakh, crore) -----

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
  'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const belowHundred = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const belowThousand = (n) =>
  n < 100 ? belowHundred(n) : `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${belowHundred(n % 100)}` : ''}`;

function wholeInWords(n) {
  if (n === 0) return 'Zero';
  const parts = [];
  const take = (size, name) => {
    const count = Math.floor(n / size);
    if (count) parts.push(`${count >= 100 ? wholeInWords(count) : belowHundred(count)} ${name}`);
    n %= size;
  };
  take(10000000, 'Crore');
  take(100000, 'Lakh');
  take(1000, 'Thousand');
  if (n) parts.push(belowThousand(n));
  return parts.join(' ');
}

export function rupeesInWords(amount) {
  const paise = Math.round(Number(amount || 0) * 100);
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return `Rupees ${wholeInWords(rupees)}${rest ? ` and ${belowHundred(rest)} Paise` : ''} Only`;
}

// ----- the page -----

/** One line of the invoice per GST rate: [{ rate, nights, taxable, cgst, sgst, total }]. */
export function invoiceLines(b) {
  const groups = Array.isArray(b.tax_details) && b.tax_details.length > 0
    ? b.tax_details
    // A booking from before GST was charged: its total was quoted without tax.
    : [{ rate: 0, nights: null, taxable: Number(b.total_amount), tax: 0 }];
  return groups.map((g) => {
    const tax = round2(g.tax);
    const cgst = round2(tax / 2);
    return { rate: Number(g.rate), nights: g.nights, taxable: round2(g.taxable), cgst, sgst: round2(tax - cgst), total: round2(Number(g.taxable) + tax) };
  });
}

function invoiceHtml({ booking: b, seller, payments }) {
  const lines = invoiceLines(b);
  const sum = (key) => round2(lines.reduce((s, l) => s + l[key], 0));
  const stateCode = String(seller.gstin || '').slice(0, 2);
  const state = GST_STATES[stateCode] || GST_STATES[Number(stateCode)] || '';
  const discount = round2(Number(b.promo_discount) + Number(b.manual_discount_amount));
  const half = (rate) => (rate / 2).toLocaleString('en-IN');
  const nights = (n) => (n ? `${n} night${n === 1 ? '' : 's'}` : '');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tax invoice ${esc(b.invoice_number)}</title>
<style>
  body { font: 13px/1.5 Arial, Helvetica, sans-serif; color: #111; margin: 28px; }
  h1 { font-size: 20px; margin: 0; letter-spacing: 1px; }
  h2 { font-size: 15px; margin: 0; }
  .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111; padding-bottom: 12px; }
  .muted { color: #555; }
  .cols { display: flex; gap: 24px; margin: 14px 0; }
  .cols > div { flex: 1; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #555; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #999; padding: 6px 8px; vertical-align: top; }
  th { background: #f1f1f1; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .totals { width: 46%; margin-left: auto; }
  .totals td { border: 0; border-bottom: 1px solid #ccc; }
  .totals tr.grand td { border-bottom: 2px solid #111; font-weight: bold; font-size: 15px; }
  .sign { margin-top: 56px; text-align: right; }
  .sign span { display: inline-block; border-top: 1px solid #111; padding-top: 6px; min-width: 220px; text-align: center; }
  @media print { body { margin: 10mm; } button { display: none; } }
</style>
</head>
<body>
<div class="top">
  <div>
    <h2>${esc(seller.legal_name)}</h2>
    ${seller.legal_name && seller.legal_name.trim().toLowerCase() !== SITE_NAME.toLowerCase() ? `<div class="muted">${esc(SITE_NAME)}</div>` : ''}
    <div>${esc(seller.address || '')}</div>
    <div class="muted">${[seller.phone, seller.email].filter(Boolean).map(esc).join(' · ')}</div>
    <div><strong>GSTIN:</strong> ${esc(seller.gstin)}</div>
  </div>
  <div style="text-align:right">
    <h1>TAX INVOICE</h1>
    <div><strong>Invoice no.</strong> ${esc(b.invoice_number)}</div>
    <div><strong>Date</strong> ${esc(day(b.invoiced_at))}</div>
    <div class="muted">Booking ${esc(b.reference || `#${b.id}`)}</div>
  </div>
</div>

<div class="cols">
  <div>
    <div class="label">Billed to</div>
    ${b.billing_name ? `<div><strong>${esc(b.billing_name)}</strong></div>` : ''}
    ${b.billing_gstin ? `<div>GSTIN: ${esc(b.billing_gstin)}</div>` : ''}
    <div>${b.billing_name ? 'Guest: ' : ''}${b.billing_name ? esc(b.guest_name) : `<strong>${esc(b.guest_name)}</strong>`}</div>
    <div class="muted">${esc(b.guest_phone)}${b.guest_email ? ` · ${esc(b.guest_email)}` : ''}</div>
  </div>
  <div>
    <div class="label">Stay</div>
    <div>${esc(b.room_type)} · Room ${esc(b.unit_number)}</div>
    <div>${esc(day(b.check_in))} to ${esc(day(b.check_out))}</div>
    <div class="muted">${b.adults} adult${b.adults > 1 ? 's' : ''}${b.children ? `, ${b.children} child${b.children > 1 ? 'ren' : ''}` : ''}</div>
  </div>
  <div>
    <div class="label">Place of supply</div>
    <div>${esc(state)}${state ? ' ' : ''}(${esc(stateCode)})</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="text-align:left">Description</th><th>SAC</th><th class="num">Taxable value (₹)</th>
      <th class="num">CGST</th><th class="num">SGST</th><th class="num">Amount (₹)</th>
    </tr>
  </thead>
  <tbody>
    ${lines.map((l) => `<tr>
      <td>Room charges, ${esc(b.room_type)}${l.nights ? ` — ${nights(l.nights)}` : ''}</td>
      <td style="text-align:center">${SAC_ROOM}</td>
      <td class="num">${money(l.taxable)}</td>
      <td class="num">${l.rate ? `${half(l.rate)}% · ${money(l.cgst)}` : '—'}</td>
      <td class="num">${l.rate ? `${half(l.rate)}% · ${money(l.sgst)}` : '—'}</td>
      <td class="num">${money(l.total)}</td>
    </tr>`).join('\n')}
  </tbody>
</table>
${discount > 0 ? `<p class="muted" style="margin:6px 0 0">Room tariff ₹${money(b.base_amount)}, less discount ₹${money(discount)}. The taxable value above is after the discount.</p>` : ''}

<table class="totals">
  <tr><td>Taxable value</td><td class="num">${money(sum('taxable'))}</td></tr>
  <tr><td>CGST</td><td class="num">${money(sum('cgst'))}</td></tr>
  <tr><td>SGST</td><td class="num">${money(sum('sgst'))}</td></tr>
  <tr class="grand"><td>Total</td><td class="num">₹${money(b.total_amount)}</td></tr>
  <tr><td>Paid</td><td class="num">₹${money(b.amount_paid)}</td></tr>
</table>
<p><strong>Amount in words:</strong> ${esc(rupeesInWords(b.total_amount))}</p>

${payments.length ? `<div class="label" style="margin-top:14px">Payments received</div>
<table>
  <tbody>
    ${payments.map((p) => `<tr>
      <td>${esc(day(p.captured_at))}</td>
      <td>${esc(PAID_BY[p.method] || p.method)}${p.reference || p.razorpay_payment_id ? ` · ${esc(p.reference || p.razorpay_payment_id)}` : ''}</td>
      <td class="num">₹${money(p.amount)}</td>
    </tr>`).join('\n')}
  </tbody>
</table>` : ''}

<div class="sign"><span>For ${esc(seller.legal_name)}<br>Authorised signatory</span></div>
<p class="muted" style="margin-top:18px">This is a computer-generated invoice.</p>
<p><button onclick="window.print()">Print</button></p>
</body>
</html>`;
}

/**
 * Printing happens in two steps, because a browser only lets a page open a
 * window while it is handling a click: open the window at once, then fill it
 * when the invoice arrives.
 *
 *   const win = openInvoiceWindow();        // in the click handler; null if pop-ups are blocked
 *   const { invoice } = (await api.post(...)).data;
 *   showInvoice(win, invoice);              // or win.close() if the request failed
 */
export function openInvoiceWindow() {
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return null;
  win.document.write('<p style="font:14px Arial, sans-serif; margin:28px">Preparing the invoice…</p>');
  return win;
}

export function showInvoice(win, invoice) {
  win.document.open();
  win.document.write(invoiceHtml(invoice));
  win.document.close();
  win.focus();
  win.print();
}
