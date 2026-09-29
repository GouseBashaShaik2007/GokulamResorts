import Link from 'next/link';
import Hero from '@/components/Hero';
import Reveal from '@/components/motion/Reveal';
import { RevealStagger, RevealStaggerItem } from '@/components/motion/RevealStagger';
import RoomSlider from '@/components/site/RoomSlider';
import RecentlyViewed from '@/components/site/RecentlyViewed';
import { Price } from '@/components/site/Currency';
import OpenBookingButton from '@/components/booking/OpenBookingButton';
import { REVIEWS, GETTING_HERE, PACKAGES, mapEmbedUrl, directionsUrl } from '@/lib/site';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function getRooms() {
  try {
    const res = await fetch(`${API_URL}/rooms`, { cache: 'no-store' });
    if (!res.ok) return [];
    return (await res.json()).rooms || [];
  } catch (err) {
    return []; // backend down — the rooms section says so instead of breaking the page
  }
}

// Stock photos until the resort's own arrive (data-placeholder="true").
const EXPERIENCES = [
  { title: 'Beach', text: 'Long, quiet stretches of sand on the Bay of Bengal.', href: '/gallery?c=beach', image: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=900&q=75' },
  { title: 'Dining', text: 'Coastal Andhra cooking and the day’s catch.', href: '/dining', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=75' },
  { title: 'Spa', text: 'Slow afternoons and traditional therapies.', href: null, image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=75' },
  { title: 'Sunset', text: 'Evenings made for doing very little.', href: '/gallery?c=beach', image: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=900&q=75' },
];

function ExperienceTile({ href, children }) {
  const cls = 'media-zoom group relative block aspect-[3/4] overflow-hidden rounded-2xl';
  return href ? <Link href={href} className={cls}>{children}</Link> : <div className={cls}>{children}</div>;
}

function SectionHead({ eyebrow, title, action }) {
  return (
    <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="section-heading mt-1">{title}</h2>
      </div>
      {action}
    </Reveal>
  );
}

export default async function HomePage() {
  const rooms = await getRooms();

  return (
    <div>
      <Hero />

      {/* About, in one line */}
      <section className="mx-auto max-w-3xl px-4 pb-10 pt-16 text-center sm:px-6">
        <Reveal>
          <p className="font-serif text-2xl leading-snug text-navy-100 sm:text-3xl">
            A small beachfront resort on the Chirala coast — sea-facing rooms, unhurried days and warm Andhra
            hospitality.
          </p>
        </Reveal>
        <RecentlyViewed className="mt-8 justify-center" />
      </section>

      {/* Rooms */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow="Stay"
          title="Rooms & Suites"
          action={<Link href="/rooms" className="btn-outline">All rooms</Link>}
        />
        {rooms.length > 0 ? (
          <RoomSlider rooms={rooms} />
        ) : (
          <p className="card p-8 text-center text-navy-300">Rooms are not available to view right now. Please try again shortly.</p>
        )}
      </section>

      {/* Experiences */}
      <section className="bg-navy-900 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Experiences" title="Days by the sea" />
          <RevealStagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {EXPERIENCES.map((x) => (
              <RevealStaggerItem key={x.title}>
                <ExperienceTile href={x.href}>
                  <img src={x.image} alt={x.title} data-placeholder="true" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden="true" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <h3 className="font-serif text-2xl font-semibold text-white">{x.title}</h3>
                    <p className="mt-1 text-sm text-white/80">{x.text}</p>
                  </div>
                </ExperienceTile>
              </RevealStaggerItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Guest reviews — only once real ratings and quotes are in lib/site.js */}
      {REVIEWS?.quotes?.length > 0 && (
        <section id="reviews" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Guest reviews" title="What guests say" />
          <div className="mb-8 flex flex-wrap gap-6 text-navy-100">
            {REVIEWS.google && (
              <p><span className="text-3xl font-semibold">{REVIEWS.google.rating.toFixed(1)}</span> <span className="text-amber-500">★</span> Google{REVIEWS.google.count ? ` · ${REVIEWS.google.count} reviews` : ''}</p>
            )}
            {REVIEWS.tripadvisor && (
              <p><span className="text-3xl font-semibold">{REVIEWS.tripadvisor.rating.toFixed(1)}</span> TripAdvisor</p>
            )}
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {REVIEWS.quotes.slice(0, 3).map((q) => (
              <figure key={q.text} className="card p-6">
                <blockquote className="font-serif text-lg leading-relaxed text-navy-100">“{q.text}”</blockquote>
                <figcaption className="mt-4 text-sm text-navy-400">— {q.author}, {q.source}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Getting here */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-2xl border border-navy-700 lg:grid-cols-[2fr_3fr]">
          <div className="bg-navy-900 p-8 sm:p-10">
            <p className="eyebrow">Getting here</p>
            <h2 className="section-heading mt-1">Easy to reach, easy to forget the world</h2>
            <ul className="mt-6 space-y-4">
              {GETTING_HERE.map((g) => (
                <li key={g.place} className="flex gap-4">
                  <span className="w-20 flex-none text-xs font-semibold uppercase tracking-wider text-gold-500">{g.mode}</span>
                  <span>
                    <span className="block font-medium text-navy-50">{g.place}</span>
                    <span className="text-sm text-navy-300">{g.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={directionsUrl()} target="_blank" rel="noopener noreferrer" className="btn-gold">Get directions</a>
              <Link href="/chirala-guide" className="btn-outline">Chirala guide</Link>
            </div>
          </div>
          <iframe
            title="Map of Chirala"
            src={mapEmbedUrl()}
            className="h-80 w-full border-0 lg:h-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>

      {/* Offers — shown once packages are defined */}
      {PACKAGES.length > 0 && (
        <section className="bg-navy-900 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHead eyebrow="Offers" title="Packages" />
            <div className="grid gap-6 md:grid-cols-3">
              {PACKAGES.map((p) => (
                <div key={p.slug} className="card flex flex-col p-6">
                  <h3 className="font-serif text-2xl font-semibold text-navy-50">{p.name}</h3>
                  <p className="mt-1 text-sm text-navy-400">{p.nights} night{p.nights > 1 ? 's' : ''}</p>
                  <ul className="mt-4 flex-1 space-y-1 text-sm text-navy-200">
                    {p.inclusions.map((i) => <li key={i}>✓ {i}</li>)}
                  </ul>
                  <Price inr={p.price} className="mt-6 text-2xl" />
                  <OpenBookingButton roomTypeId={p.roomTypeId} className="btn-gold mt-4">Book this package</OpenBookingButton>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
