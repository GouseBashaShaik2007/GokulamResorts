'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { errMsg } from '../lib/bookingUi';
import BookingSummary from './booking-status/BookingSummary';
import LookupForm from './booking-status/LookupForm';

/**
 * Looks up a booking by reference + phone. If both are known up front (right
 * after paying, same tab) it loads straight away; otherwise it asks for them.
 * `justBooked`: this is the page a guest lands on after paying, so a booking
 * that is still awaiting the resort's confirmation gets the "payment received,
 * here is what happens next" card on top.
 */
export default function GuestBookingStatus({ initialRef = '', initialPhone = '', intro = '', justBooked = false }) {
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const lastLookup = useRef(null); // { reference, phone } of the booking on screen

  const lookup = useCallback(async (reference, phone) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/bookings/lookup', { params: { reference, phone } });
      lastLookup.current = { reference, phone };
      setBooking(res.data.booking);
    } catch (err) {
      setBooking(null);
      setError(errMsg(err, 'We could not find that booking.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRef && initialPhone) lookup(initialRef, initialPhone);
  }, [initialRef, initialPhone, lookup]);

  // While the booking is waiting on payment or the resort's approval, check
  // again quietly so "Booking confirmed" appears without a reload. Once a
  // minute: the lookup API allows 30 requests per 15 minutes.
  const waiting = !!booking && ['pending_payment', 'paid'].includes(booking.status);
  useEffect(() => {
    if (!waiting) return undefined;
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible' || !lastLookup.current) return;
      try {
        const res = await api.get('/bookings/lookup', { params: lastLookup.current });
        setBooking(res.data.booking);
      } catch {
        // keep what's on screen; the next check may succeed
      }
    }, 60000);
    return () => clearInterval(id);
  }, [waiting]);

  if (booking) {
    return (
      <div className="space-y-4">
        <BookingSummary b={booking} justBooked={justBooked} />
        <button type="button" onClick={() => setBooking(null)} className="no-print text-sm text-navy-400 underline">Look up another booking</button>
      </div>
    );
  }

  return <LookupForm initialRef={initialRef} initialPhone={initialPhone} intro={intro} loading={loading} error={error} onLookup={lookup} />;
}
