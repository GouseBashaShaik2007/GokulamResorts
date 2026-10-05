import Link from 'next/link';
import OpenBookingButton from '@/components/booking/OpenBookingButton';
import PageHeader from '@/components/ui/PageHeader';
import { getContact } from '@/lib/server-api';
import { GettingHereList } from '@/components/home/GettingHere';
import { PLACES } from '@/lib/guide';
import { jsonLd } from '@/lib/jsonLd';
import { SITE_URL, directionsUrl, whatsappUrl } from '@/lib/site';

export const metadata = {
  title: 'Chirala Guide — handloom villages, beaches and getting here',
  description:
    'A short guide to Chirala, Andhra Pradesh: the handloom weaving tradition, Vetapalem, Vodarevu and Suryalanka beaches near Bapatla, and how to reach Chirala by air and train.',
};

// The places in the format search engines read.
const GUIDE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Places to see around Chirala',
  ...(SITE_URL ? { url: `${SITE_URL}/chirala-guide` } : {}),
  itemListElement: PLACES.map((place, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: { '@type': 'TouristAttraction', name: place.name, description: place.text },
  })),
};

const inlineLink = 'font-medium text-ocean-600 underline underline-offset-2';

export default async function ChiralaGuidePage() {
  const contact = await getContact(); // directions, and WhatsApp once a number is set
  // Asking about a place: WhatsApp with the place named, or the contact page until a number is set.
  const askHref = (place) => whatsappUrl(`Hello Gokulam Resorts, I'd like to ask about visiting ${place.name}.`, contact) || '/contact';
  const askIsWhatsApp = !!contact.whatsapp;
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Chirala guide" title="Around Chirala">
        <p className="mt-4 max-w-3xl text-lg text-ink-500">
          A coastal town in Andhra Pradesh’s Bapatla district, Chirala is known for its weavers and its{' '}
          <Link href="/gallery?c=beach" className={inlineLink}>long, quiet beaches</Link>. Here is what to see beyond the
          resort, once you have settled into <Link href="/rooms" className={inlineLink}>your room</Link>.
        </p>
      </PageHeader>

      {/* Side by side from tablet width, so the places can be compared at a glance. */}
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {PLACES.map((p) => (
          <section key={p.name} className="card flex flex-col p-6">
            <p className="eyebrow">{p.kind}</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-ink-900">{p.name}</h2>
            <p className="mt-2 flex-1 leading-relaxed text-ink-500">{p.text}</p>
            <a
              href={askHref(p)}
              {...(askIsWhatsApp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="mt-4 inline-block text-sm font-semibold text-ocean-600 underline underline-offset-2"
            >
              {askIsWhatsApp ? 'Ask us on WhatsApp' : 'Ask the front desk'}<span className="sr-only"> about {p.name}</span>
            </a>
          </section>
        ))}
      </div>

      <section className="mt-14 rounded-2xl border border-sand-300 bg-sand-100 p-8">
        <h2 className="font-serif text-2xl font-semibold text-ink-900">How to get here</h2>
        <GettingHereList className="mt-4" />
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={directionsUrl(contact)} target="_blank" rel="noopener noreferrer" className="btn-primary">Get directions</a>
          <Link href="/contact" className="btn-outline">Ask us about transfers</Link>
        </div>
      </section>

      <section className="mt-14 text-center">
        <h2 className="font-serif text-2xl font-semibold text-ink-900">Planning a visit?</h2>
        <p className="mx-auto mt-2 max-w-xl text-ink-500">
          After a day out, dinner is at <Link href="/dining" className={inlineLink}>our restaurant</Link> — coastal Andhra
          cooking and the day’s catch.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <OpenBookingButton className="btn-primary">Check availability</OpenBookingButton>
          <Link href="/rooms" className="btn-outline">See the rooms</Link>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(GUIDE_JSON_LD) }} />
    </div>
  );
}
