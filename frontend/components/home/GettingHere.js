import Link from 'next/link';
import { GETTING_HERE, directionsUrl, mapEmbedUrl } from '@/lib/site';

/** How to reach Chirala, as a list. Shared by the home page panel and the Chirala guide. */
export function GettingHereList({ className = '' }) {
  return (
    <ul className={`space-y-4 ${className}`}>
      {GETTING_HERE.map((g) => (
        <li key={g.place} className="flex gap-4">
          <span className="w-20 flex-none text-xs font-semibold uppercase tracking-wider text-gold-600">{g.mode}</span>
          <span>
            <span className="block font-medium text-navy-50">{g.place}</span>
            <span className="text-sm text-navy-300">{g.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Home page panel: how to get here beside a map. `contact`: the resort's details from Settings. */
export default function GettingHere({ contact }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid overflow-hidden rounded-2xl border border-navy-700 lg:grid-cols-[2fr_3fr]">
        <div className="bg-navy-900 p-8 sm:p-10">
          <p className="eyebrow">Getting here</p>
          <h2 className="section-heading mt-1">Easy to reach, easy to forget the world</h2>
          <GettingHereList className="mt-6" />
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={directionsUrl(contact)} target="_blank" rel="noopener noreferrer" className="btn-gold">Get directions</a>
            <Link href="/chirala-guide" className="btn-outline">Chirala guide</Link>
          </div>
        </div>
        <iframe
          title="Map of Chirala"
          src={mapEmbedUrl(contact)}
          className="h-80 w-full border-0 lg:h-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </section>
  );
}
