'use client';

import { useEffect, useState } from 'react';
import GuestBookingStatus from '@/components/GuestBookingStatus';

export default function ConfirmationContent({ reference }) {
  // null until sessionStorage has been read (it doesn't exist on the server).
  const [phone, setPhone] = useState(null);

  // Phone saved by the booking flow in this tab; never put in the URL.
  useEffect(() => {
    try {
      setPhone(window.sessionStorage.getItem(`gokulam_booking_${reference}`) || '');
    } catch {
      setPhone('');
    }
  }, [reference]);

  if (phone === null) return <div className="card h-96 animate-pulse" role="status" aria-label="Loading your booking" />;
  return (
    <GuestBookingStatus
      initialRef={reference}
      initialPhone={phone}
      // No phone saved in this tab (new tab, private window): say why we're asking.
      intro={reference && !phone ? 'Enter the mobile number you booked with to see your confirmation.' : ''}
    />
  );
}
