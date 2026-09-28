'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import GuestBookingStatus from '../../../components/GuestBookingStatus';

// Linked from guest SMS / WhatsApp messages: /booking/status?id=123
function StatusContent() {
  return <GuestBookingStatus initialId={useSearchParams().get('id') || ''} />;
}

export default function BookingStatusPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <Suspense fallback={<p className="text-center text-navy-300">Loading...</p>}>
        <StatusContent />
      </Suspense>
    </div>
  );
}
