'use client';

import { useBooking } from './BookingContext';
import { inr } from '../../lib/bookingUi';
import { formatRange } from '../../lib/dateRange';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Line({ label, value, className = 'text-navy-300' }) {
  return (
    <div className={`flex justify-between gap-4 ${className}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * What the guest is about to pay for, shown on the details and payment steps:
 * the room, dates and guests, then every line of the price. `total` overrides
 * the quoted total once an order exists (it is then the amount actually charged).
 */
export default function StaySummary({ total }) {
  const { pick, stay, adults, children: kids } = useBooking();
  if (!pick) return null;

  const q = pick.quote;
  const hasDates = stay.checkIn && stay.checkOut;

  return (
    <section aria-label="Your stay" className="rounded-xl border border-navy-700 bg-navy-900 p-5 text-sm">
      <p className="font-medium text-navy-50">
        {pick.roomType?.name ? `${pick.roomType.name} · ` : ''}Room {pick.unit.unitNumber}
      </p>
      <p className="mt-1 text-navy-300">
        {hasDates ? `${formatRange(stay.checkIn, stay.checkOut)} · ` : ''}
        {plural(q.nights, 'night')} · {plural(adults, 'adult')}
        {kids > 0 ? `, ${kids} ${kids === 1 ? 'child' : 'children'}` : ''}
      </p>

      <dl className="mt-4 space-y-1.5 border-t border-navy-700 pt-3">
        <Line label={`${inr(q.nightlyRate)} × ${plural(q.nights, 'night')}`} value={inr(q.base)} />
        {q.promo > 0 && <Line label={q.promoDetails?.[0]?.name || 'Offer'} value={`−${inr(q.promo)}`} className="text-green-700" />}
        {(q.taxDetails || []).map((t) => (
          <Line key={t.rate} label={`GST ${t.rate}%`} value={inr(t.tax)} />
        ))}
        <div className="flex items-baseline justify-between gap-4 border-t border-navy-700 pt-2">
          <dt className="font-semibold text-navy-50">Total to pay</dt>
          <dd className="price text-xl">{inr(total ?? q.total)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-navy-400">Charged in Indian rupees.</p>
    </section>
  );
}
