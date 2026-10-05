import Image from 'next/image';
import ReviewBadge from './site/ReviewBadge';
import HeroBookingForm from './site/HeroBookingForm';
import { inr } from '@/lib/bookingUi';
import { serifItalic } from '@/app/fonts-home';

// TODO(owner): replace with the resort's own photo (or a silent 8-second wave
// loop: add <video autoPlay muted loop playsInline poster=...> in place of <Image>).
const HERO_IMAGE = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=80';

/**
 * Full-bleed photo with a soft gradient, headline at the bottom left, and the
 * booking form sitting across the photo's bottom edge. The navbar floats
 * transparently over it (see Navbar's `overHero`), hence the negative margin.
 * `fromPrice`: the lowest nightly rate, for the first of the three reasons to book.
 */
export default function Hero({ fromPrice }) {
  const reasons = [
    fromPrice ? `From ${inr(Math.round(fromPrice))} a night + GST` : null,
    'Confirmed the moment you pay',
    'Full refund if you cancel before check-in',
  ].filter(Boolean);

  return (
    <section className="relative -mt-[var(--nav-h)]">
      <div className="relative h-[88vh] min-h-[560px] supports-[height:1svh]:h-[88svh] w-full overflow-hidden">
        {/* The page's largest image: sized per device and loaded first. */}
        <Image
          src={HERO_IMAGE}
          alt="Waves on a quiet beach at sunrise"
          data-placeholder="true"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" aria-hidden="true" />

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-28 sm:px-6 sm:pb-32 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/80">Chirala Beach · Andhra Pradesh</p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl font-medium leading-[1.02] text-white sm:text-6xl lg:text-7xl">
            Where the Bay of Bengal <span className={serifItalic.className}>slows you down</span>
          </h1>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1.5 text-sm font-medium text-white">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-gold-300" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                {reason}
              </li>
            ))}
          </ul>
          <ReviewBadge tone="dark" className="mt-4" />
        </div>
      </div>

      {/* Across the bottom edge of the photo on larger screens; below it on phones. */}
      <div className="relative z-10 mx-auto -mt-16 max-w-5xl px-4 sm:px-6">
        <HeroBookingForm />
      </div>
    </section>
  );
}
