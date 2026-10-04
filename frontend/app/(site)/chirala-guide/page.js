import Link from 'next/link';
import OpenBookingButton from '@/components/booking/OpenBookingButton';
import { getContact } from '@/lib/server-api';
import { GettingHereList } from '@/components/home/GettingHere';
import { jsonLd } from '@/lib/jsonLd';
import { SITE_URL, directionsUrl, whatsappUrl } from '@/lib/site';

export const metadata = {
  title: 'Chirala Guide — handloom villages, beaches and getting here',
  description:
    'A short guide to Chirala, Andhra Pradesh: the handloom weaving tradition, Vetapalem, Vodarevu and Suryalanka beaches near Bapatla, and how to reach Chirala by air and train.',
};

// TODO(owner): review before publishing — general local knowledge, kept free
// of exact distances, timings and prices on purpose. Add your own tips.
const PLACES = [
  {
    name: 'Chirala’s handloom weavers',
    text: 'Chirala has long been known for handloom weaving, especially cotton sarees. Weaving families still work looms in the older neighbourhoods — ask the front desk about a visit and where to buy directly from weavers.',
  },
  {
    name: 'Vetapalem',
    text: 'A neighbouring town known for cashew processing — a good stop for fresh cashews to take home — and for the historic Saraswatha Niketanam library.',
  },
  {
    name: 'Vodarevu beach',
    text: 'Chirala’s own stretch of coast, with a working fishing village. Early morning is the time to watch the boats come in.',
  },
  {
    name: 'Suryalanka beach, near Bapatla',
    text: 'A wide, popular beach north of Chirala — busy at weekends and festivals, quieter on weekday mornings.',
  },
];

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

export default async function ChiralaGuidePage() {
  const contact = await getContact(); // directions, and WhatsApp once a number is set
  // Asking about a place: WhatsApp with the place named, or the contact page until a number is set.
  const askHref = (place) => whatsappUrl(`Hello Gokulam Resorts, I'd like to ask about visiting ${place.name}.`, contact) || '/contact';
  const askIsWhatsApp = !!contact.whatsapp;
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="eyebrow">Chirala guide</p>
      <h1 className="display-heading mt-2 text-4xl md:text-5xl">Around Chirala</h1>
      <p className="mt-4 text-lg text-navy-300">
        A coastal town in Andhra Pradesh’s Bapatla district, Chirala is known for its weavers and its long, quiet
        beaches. Here is what to see beyond the resort.
      </p>

      <div className="mt-12 space-y-10">
        {PLACES.map((p) => (
          <section key={p.name}>
            <h2 className="font-serif text-2xl font-semibold text-navy-50">{p.name}</h2>
            <p className="mt-2 leading-relaxed text-navy-300">{p.text}</p>
            <a
              href={askHref(p)}
              {...(askIsWhatsApp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="mt-2 inline-block text-sm font-semibold text-ocean-600 underline underline-offset-2"
            >
              {askIsWhatsApp ? 'Ask us on WhatsApp' : 'Ask the front desk'}<span className="sr-only"> about {p.name}</span>
            </a>
          </section>
        ))}
      </div>

      <section className="mt-14 rounded-2xl border border-navy-700 bg-navy-900 p-8">
        <h2 className="font-serif text-2xl font-semibold text-navy-50">How to get here</h2>
        <GettingHereList className="mt-4" />
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={directionsUrl(contact)} target="_blank" rel="noopener noreferrer" className="btn-gold">Get directions</a>
          <Link href="/contact" className="btn-outline">Ask us about transfers</Link>
        </div>
      </section>

      <section className="mt-14 text-center">
        <h2 className="font-serif text-2xl font-semibold text-navy-50">Planning a visit?</h2>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <OpenBookingButton className="btn-gold">Check availability</OpenBookingButton>
          <Link href="/rooms" className="btn-outline">See the rooms</Link>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(GUIDE_JSON_LD) }} />
    </div>
  );
}
