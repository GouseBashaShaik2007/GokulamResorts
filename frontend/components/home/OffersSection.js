import OpenBookingButton from '@/components/booking/OpenBookingButton';
import { offerDates, offerSaving } from '@/lib/offers';
import SectionHead from './SectionHead';

/** Offers running now or coming up — the ones switched on in Admin → Offers. Hidden when there are none. */
export default function OffersSection({ offers }) {
  if (offers.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <SectionHead eyebrow="Offers" title="Book direct and save" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer) => (
          <div key={offer.id} className="card flex flex-col p-6">
            <p className="text-sm font-semibold text-green-800">{offerSaving(offer)} per night</p>
            <h3 className="mt-1 font-serif text-2xl font-semibold text-ink-900">{offer.name}</h3>
            <p className="mt-2 flex-1 text-sm text-ink-500">
              {offer.room_type || 'Every room type'} · stays {offerDates(offer)}. Taken off the price automatically
              when you book those nights.
            </p>
            <OpenBookingButton roomTypeId={offer.room_type_id} className="btn-primary mt-5">Check availability</OpenBookingButton>
          </div>
        ))}
      </div>
    </section>
  );
}
