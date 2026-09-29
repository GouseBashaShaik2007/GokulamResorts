'use client';

import { useBooking } from '../BookingContext';
import { inr } from '../../../lib/bookingUi';

export default function GuestStep() {
  const { pick, guest, setGuest, goTo, submitAndPay, status, error } = useBooking();

  const setField = (k) => (e) => setGuest({ [k]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    submitAndPay();
  };

  if (!pick) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-navy-400">Please choose a room first.</p>
        <button type="button" onClick={() => goTo('room')} className="btn-outline">Back to rooms</button>
      </div>
    );
  }

  const isSubmitting = status === 'booking' || status === 'paying';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Step 3 of 4</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-navy-50">Your Details</h2>
          <p className="mt-1 text-sm text-navy-400">
            Room {pick.unit.unitNumber} · {inr(pick.quote.total)} for {pick.quote.nights} night{pick.quote.nights > 1 ? 's' : ''}
          </p>
        </div>
        <button type="button" onClick={() => goTo('room')} className="text-xs text-gold-400 hover:underline">
          Change room
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="guestName">Full name</label>
          <input id="guestName" required className="input-field" value={guest.name} onChange={setField('name')} placeholder="Priya Sharma" />
        </div>
        <div>
          <label className="label" htmlFor="guestPhone">Mobile (SMS / WhatsApp updates)</label>
          <input id="guestPhone" type="tel" required className="input-field" value={guest.phone} onChange={setField('phone')} placeholder="+91 98765 43210" />
        </div>
        <div>
          <label className="label" htmlFor="guestEmail">Email</label>
          <input id="guestEmail" type="email" required className="input-field" value={guest.email} onChange={setField('email')} placeholder="priya@example.com" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="guestRequests">Special requests (optional)</label>
          <textarea id="guestRequests" rows={2} className="input-field" value={guest.specialRequests} onChange={setField('specialRequests')} placeholder="Early check-in, anniversary setup, dietary needs..." />
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <button type="submit" disabled={isSubmitting} className="btn-gold w-full disabled:opacity-60">
        {status === 'booking' && 'Holding your room...'}
        {status === 'paying' && 'Waiting for payment...'}
        {(status === 'idle' || status === 'error') && `Pay ${inr(pick.quote.total)} · Room ${pick.unit.unitNumber}`}
      </button>
      <p className="text-center text-xs text-navy-400">
        Full payment now via Razorpay. The resort confirms your booking within 24 hours — if it can&apos;t, you get a
        full refund automatically. Please bring a photo ID for every adult at check-in.
      </p>
    </form>
  );
}
