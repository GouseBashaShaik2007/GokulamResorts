'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { inr, fmtDate, fmtDateTime, nightsBetween } from '@/lib/bookingUi';
import { downloadCalendarFile, stayCalendarFile } from '@/lib/calendar';
import { realPhotos } from '@/lib/rooms';
import { SITE_NAME, directionsUrl, telHref, whatsappUrl } from '@/lib/site';
import { useContact } from '../site/ContactContext';
import RoomPhoto from '../site/RoomPhoto';
import PaymentReceived from './PaymentReceived';
import { CheckInCountdown, CopyButton, StayProgress, refundedTotal, statusFor } from './parts';

/**
 * One booking as its guest sees it: status, stay details, what was paid or
 * refunded, what to bring, and ways to keep or act on it.
 * `justBooked`: the guest has only now paid, so a booking still awaiting the
 * resort's confirmation gets the "payment received" card on top.
 */
export default function BookingSummary({ b, justBooked }) {
  const contact = useContact();
  const [photo, setPhoto] = useState(undefined);
  useEffect(() => {
    if (!b.room.typeId) return setPhoto(null);
    api.get(`/rooms/${b.room.typeId}`).then((r) => setPhoto(realPhotos(r.data.room)[0] || null)).catch(() => setPhoto(null));
    return undefined;
  }, [b.room.typeId]);

  const s = statusFor(b);
  const refunded = refundedTotal(b);
  const nights = nightsBetween(b.checkIn, b.checkOut);
  const upcoming = ['paid', 'confirmed'].includes(b.status);
  const keepable = upcoming || ['checked_in', 'checked_out'].includes(b.status); // worth saving or printing
  const wa = whatsappUrl(`Hello, this is about booking ${b.reference}.`, contact);
  const tel = telHref(contact);
  // The dedicated "payment received" card above already carries the heading and reference.
  const celebrated = justBooked && b.status === 'paid';
  const Title = celebrated ? 'h2' : 'h1';

  const addToCalendar = () =>
    downloadCalendarFile(
      `gokulam-${b.reference}.ics`,
      stayCalendarFile({
        reference: b.reference,
        title: `Stay at ${SITE_NAME} — Room ${b.room.unitNumber}`,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        location: contact.address,
        notes: `Booking ${b.reference}.${contact.checkInTime ? ` Check-in from ${contact.checkInTime}.` : ''} Bring a photo ID for every adult.`,
      })
    );

  return (
    <>
      {celebrated && <PaymentReceived b={b} />}
      <div className="card overflow-hidden">
        <div className="no-print relative h-48 sm:h-56">
          {photo === undefined ? <div className="h-full w-full animate-pulse bg-navy-800" /> : <RoomPhoto src={photo} alt={b.room.type} />}
        </div>
        <div className="space-y-6 p-6 sm:p-8">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-navy-400">
              Booking
              <span className="font-mono text-sm font-semibold normal-case tracking-normal text-navy-50">{b.reference}</span>
              <CopyButton text={b.reference} />
            </p>
            <Title className="mt-1 font-serif text-3xl font-semibold text-navy-50" aria-live="polite">{celebrated ? 'Your stay' : s.title}</Title>
            {s.text && !celebrated && <p className="mt-2 text-navy-300">{s.text}</p>}
            {b.closeReason && b.status === 'cancelled' && <p className="mt-2 text-navy-300">Reason: {b.closeReason}.</p>}
          </div>

          <StayProgress status={b.status} />
          {upcoming && <CheckInCountdown checkIn={b.checkIn} />}

          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-navy-400">Guest</dt><dd className="text-navy-50">{b.guestName}</dd></div>
            <div><dt className="text-navy-400">Room</dt><dd className="text-navy-50">{b.room.unitNumber} · {b.room.type}{b.room.view ? ` · ${b.room.view}` : ''}</dd></div>
            <div><dt className="text-navy-400">Check-in</dt><dd className="text-navy-50">{fmtDate(b.checkIn)}</dd></div>
            <div><dt className="text-navy-400">Check-out</dt><dd className="text-navy-50">{fmtDate(b.checkOut)} · {nights} night{nights > 1 ? 's' : ''}</dd></div>
            <div><dt className="text-navy-400">Guests</dt><dd className="text-navy-50">{b.adults} adult{b.adults > 1 ? 's' : ''}{b.children ? `, ${b.children} child${b.children > 1 ? 'ren' : ''}` : ''}</dd></div>
            <div>
              <dt className="text-navy-400">Total</dt>
              <dd className="text-navy-50"><span className="price">{inr(b.total)}</span>{b.tax > 0 && <span className="ml-1 text-xs text-navy-400">incl. GST {inr(b.tax)}</span>}</dd>
            </div>
            {b.paid > 0 && (
              <div><dt className="text-navy-400">Paid</dt><dd className="text-navy-50">{inr(b.paid)}</dd></div>
            )}
            {b.balanceDue > 0 && b.status !== 'pending_payment' && (
              <div><dt className="text-navy-400">Due at the resort</dt><dd className="font-semibold text-red-700">{inr(b.balanceDue)}</dd></div>
            )}
            {refunded > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-navy-400">Refund</dt>
                <dd className="text-green-800">
                  {inr(refunded)} —{' '}
                  {b.refunds.some((r) => r.method !== 'razorpay' && r.status === 'pending')
                    ? 'collect at the resort counter'
                    : 'to your original payment method (5–7 working days)'}
                </dd>
              </div>
            )}
          </dl>
          {b.status === 'paid' && b.holdExpiresAt && !celebrated && (
            <p className="text-xs text-navy-400">
              Confirmation due by {fmtDateTime(b.holdExpiresAt)}. If the resort has not confirmed by then, the booking is
              cancelled and the full amount is refunded automatically.
            </p>
          )}

          {upcoming && (
            <div className="rounded-xl bg-navy-900 p-4 text-sm text-navy-200">
              <p className="font-semibold text-navy-50">Before you arrive</p>
              <ul className="mt-2 space-y-1.5">
                <li>Bring a photo ID (Aadhaar, passport or driving licence) for every adult — the front desk checks them at check-in.</li>
                {contact.checkInTime && <li>Check-in is from {contact.checkInTime} on {fmtDate(b.checkIn)}{contact.checkOutTime ? `; check-out is by ${contact.checkOutTime}` : ''}.</li>}
                <li>
                  Find us at{' '}
                  <a href={directionsUrl(contact)} target="_blank" rel="noopener noreferrer" className="text-ocean-600 underline">{contact.address}</a>.
                </li>
                {tel && <li>Front desk: <a href={tel} className="text-ocean-600 underline">{contact.phone}</a> — call if your plans or arrival time change.</li>}
              </ul>
            </div>
          )}

          {/* Keeping the booking comes first; leaving the page last. */}
          <div className="no-print flex flex-wrap items-center gap-3">
            {keepable && <button type="button" onClick={addToCalendar} className="btn-gold">Add to calendar</button>}
            {keepable && <button type="button" onClick={() => window.print()} className="btn-outline">Print or save as PDF</button>}
            <a href={directionsUrl(contact)} target="_blank" rel="noopener noreferrer" className="btn-outline">Directions</a>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline">WhatsApp the front desk</a>}
            <Link href="/" className="px-2 text-sm font-semibold text-ocean-600 underline underline-offset-2">Back to home</Link>
          </div>
        </div>
      </div>
    </>
  );
}
