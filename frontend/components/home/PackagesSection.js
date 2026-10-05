import OpenBookingButton from '@/components/booking/OpenBookingButton';
import { Price } from '@/components/site/Currency';
import { PACKAGES } from '@/lib/site';
import SectionHead from './SectionHead';

/** Fixed-price stay packages — shown once they are defined in lib/site.js. */
export default function PackagesSection() {
  if (PACKAGES.length === 0) return null;
  return (
    <section className="bg-sand-100 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="Packages" title="Stay packages" />
        <div className="grid gap-6 md:grid-cols-3">
          {PACKAGES.map((p) => (
            <div key={p.slug} className="card flex flex-col p-6">
              <h3 className="font-serif text-2xl font-semibold text-ink-900">{p.name}</h3>
              <p className="mt-1 text-sm text-ink-400">{p.nights} night{p.nights > 1 ? 's' : ''}</p>
              <ul className="mt-4 flex-1 space-y-1 text-sm text-ink-700">
                {p.inclusions.map((i) => <li key={i}>✓ {i}</li>)}
              </ul>
              <Price inr={p.price} className="mt-6 text-2xl" />
              <OpenBookingButton roomTypeId={p.roomTypeId} className="btn-primary mt-4">Book this package</OpenBookingButton>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
