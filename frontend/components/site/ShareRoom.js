'use client';

import { useStay } from '../booking/BookingContext';
import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';

/**
 * "Share this room": the phone's own share sheet (WhatsApp, Messages…) where
 * there is one, otherwise the link is copied. If the guest has chosen dates,
 * the link carries them, so whoever opens it sees the same stay and price.
 * `path`: the room's page, e.g. /rooms/sea-view.
 */
export default function ShareRoom({ name, path, className = '' }) {
  const { stay, datesValid, adults, children: kids } = useStay();
  const toast = useToast();

  const share = async () => {
    const url = new URL(path, window.location.origin);
    if (datesValid) {
      url.searchParams.set('checkIn', stay.checkIn);
      url.searchParams.set('checkOut', stay.checkOut);
      url.searchParams.set('adults', String(adults));
      if (kids > 0) url.searchParams.set('children', String(kids));
    }
    const link = url.toString();

    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} — Gokulam Resorts`, text: `${name} at Gokulam Resorts, Chirala Beach`, url: link });
      } catch {
        // closed without sharing — nothing to do
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast(datesValid ? 'Link copied, with your dates.' : 'Link copied.');
    } catch {
      toast('Could not copy the link. Copy it from the address bar instead.', { tone: 'error' });
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className={`no-print inline-flex items-center gap-2 rounded-full border border-sand-300 px-4 py-2 text-sm font-medium text-ink-800 transition-colors hover:border-ocean-400 hover:text-ocean-600 ${className}`}
    >
      <Icon name="share" className="h-4 w-4" />
      Share this room
    </button>
  );
}
