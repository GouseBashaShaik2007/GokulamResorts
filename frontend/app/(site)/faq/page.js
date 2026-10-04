import Link from 'next/link';
import { jsonLd } from '@/lib/jsonLd';

export const metadata = {
  title: 'FAQ & Policies',
  description:
    'Answers about booking, payment, GST, check-in ID, extending a stay, cancellations and refunds at Gokulam Resorts, Chirala Beach.',
};

// Only answers the owner has confirmed. TODO(owner): add check-in / check-out
// times, pets, children and any other policies — they are left out, not guessed.
const FAQS = [
  {
    group: 'Booking',
    items: [
      {
        q: 'Is my booking confirmed as soon as I pay?',
        a: 'You pay the full amount online when you book. The resort then confirms your booking within 24 hours and you get an SMS / WhatsApp. If it can’t be confirmed in that time, your payment is refunded in full automatically.',
      },
      {
        q: 'Can I choose my room?',
        a: 'Yes. After picking your dates you choose the exact room by number, for example 101 or 102, from the rooms that are free.',
      },
      {
        q: 'How are taxes charged?',
        a: 'GST is charged per night on the room price after any offer: 5% on nights up to ₹7,500, and 18% on nights above ₹7,500. Room cards show the price before tax; checkout shows the full amount including tax.',
      },
      {
        q: 'How do I check my booking?',
        a: <>Use <Link href="/booking/status" className="text-ocean-600 underline">My Booking</Link> with your booking reference (for example GKL-7F3K2) and the mobile number you booked with.</>,
        // Plain-text version of an answer that contains a link, for search engines.
        text: 'Use My Booking with your booking reference (for example GKL-7F3K2) and the mobile number you booked with.',
      },
      {
        q: 'Can I book at the resort?',
        a: 'Yes. Walk-in bookings at the front desk are confirmed straight away, paid in full by cash, UPI or card.',
      },
    ],
  },
  {
    group: 'Check-in and your stay',
    items: [
      {
        q: 'What do I need to bring?',
        a: 'A photo ID for every adult guest — Aadhaar, passport or driving licence. The front desk checks it at check-in. Aadhaar copies are kept masked, showing only the last 4 digits.',
      },
      {
        q: 'Can I check in early, before my booking date?',
        a: 'Check-in is from your booking’s start date.',
      },
      {
        q: 'Can I extend my stay?',
        a: 'Yes, at the front desk, as long as your room is free for the extra nights. Extra nights are charged at the current rate.',
      },
    ],
  },
  {
    group: 'Cancellations and refunds',
    items: [
      {
        q: 'What if I need to cancel?',
        a: 'Bookings cancelled before check-in are refunded. Online payments go back to your original payment method; payments made at the resort are refunded at the counter. Contact the resort to cancel.',
      },
      {
        q: 'What if I don’t arrive?',
        a: 'If a guest doesn’t arrive, the booking is marked as a no-show and the payment is not refunded.',
      },
    ],
  },
];

// "What if I need to cancel?" -> "what-if-i-need-to-cancel"
const anchor = (question) => question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.flatMap((section) =>
    section.items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.text || f.a },
    }))
  ),
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="eyebrow">FAQ &amp; policies</p>
      <h1 className="display-heading mt-2 text-4xl md:text-5xl">Good to know</h1>

      {FAQS.map((section) => (
        <section key={section.group} className="mt-12">
          <h2 className="font-serif text-2xl font-semibold text-navy-50">{section.group}</h2>
          <div className="mt-4 divide-y divide-navy-700 border-y border-navy-700">
            {section.items.map((f) => (
              <details key={f.q} id={anchor(f.q)} className="group scroll-mt-24 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded font-medium text-navy-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950">
                  {f.q}
                  <span className="text-xl text-ocean-500 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 leading-relaxed text-navy-300">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className="mt-12 text-navy-300">
        Something else? <Link href="/contact" className="text-ocean-600 underline">Contact us</Link>.
      </p>

      {/* The same questions and answers, in the format search engines read. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(FAQ_JSON_LD) }} />
    </div>
  );
}
