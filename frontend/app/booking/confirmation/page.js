'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import GuestBookingStatus from '../../../components/GuestBookingStatus';

function ConfirmationContent() {
  const ref = useSearchParams().get('ref') || '';
  const [phone, setPhone] = useState(null);

  // Phone saved by the booking flow in this tab; never put in the URL.
  useEffect(() => {
    try {
      setPhone(window.sessionStorage.getItem(`gokulam_booking_${ref}`) || '');
    } catch {
      setPhone('');
    }
  }, [ref]);

  if (phone === null) return <p className="text-center text-navy-300">Loading...</p>;
  return <GuestBookingStatus initialRef={ref} initialPhone={phone} />;
}

export default function ConfirmationPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <Suspense fallback={<p className="text-center text-navy-300">Loading...</p>}>
        <ConfirmationContent />
      </Suspense>
    </div>
  );
}
