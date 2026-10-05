// Questions and answers for the FAQ page. Plain text, so the same wording goes
// to the page and to search engines. `slug` is the address of one answer
// (/faq#cancellation) — keep slugs stable once shared. `link` turns the first
// occurrence of its `text` inside the answer into a link.
//
// Only answers the owner has confirmed. TODO(owner): add pets, children and
// any other policies — they are left out, not guessed. Check-in and check-out
// times are added from Admin → Settings once they are set there (faqsWith).
const BASE_FAQS = [
  {
    group: 'Booking',
    items: [
      {
        slug: 'confirmation',
        q: 'Is my booking confirmed as soon as I pay?',
        a: 'You pay the full amount online when you book. The resort then confirms your booking within 24 hours and you get an SMS / WhatsApp. If it can’t be confirmed in that time, your payment is refunded in full automatically.',
      },
      {
        slug: 'choose-room',
        q: 'Can I choose my room?',
        a: 'Yes. After picking your dates you choose the exact room by number, for example 101 or 102, from the rooms that are free.',
      },
      {
        slug: 'gst',
        q: 'How are taxes charged?',
        a: 'GST is charged per night on the room price after any offer: 5% on nights up to ₹7,500, and 18% on nights above ₹7,500. For example, a ₹6,500 night pays 5% (₹325) and an ₹11,000 night pays 18% (₹1,980). Room cards show the price before tax; checkout shows the full amount including tax.',
      },
      {
        slug: 'my-booking',
        q: 'How do I check my booking?',
        a: 'Use My Booking with your booking reference (for example GKL-7F3K2) and the mobile number you booked with.',
        link: { text: 'My Booking', href: '/booking/status' },
      },
      {
        slug: 'walk-in',
        q: 'Can I book at the resort?',
        a: 'Yes. Walk-in bookings at the front desk are confirmed straight away, paid in full by cash, UPI or card.',
      },
    ],
  },
  {
    group: 'Check-in and your stay',
    items: [
      {
        slug: 'what-to-bring',
        q: 'What do I need to bring?',
        a: 'A photo ID for every adult guest — Aadhaar, passport or driving licence. The front desk checks it at check-in. Aadhaar copies are kept masked, showing only the last 4 digits.',
      },
      {
        slug: 'early-check-in',
        q: 'Can I check in early, before my booking date?',
        a: 'Check-in is from your booking’s start date.',
      },
      {
        slug: 'extend',
        q: 'Can I extend my stay?',
        a: 'Yes, at the front desk, as long as your room is free for the extra nights. Extra nights are charged at the current rate.',
      },
    ],
  },
  {
    group: 'Cancellations and refunds',
    items: [
      {
        slug: 'cancellation',
        q: 'What if I need to cancel?',
        a: 'Bookings cancelled before check-in are refunded. Online payments go back to your original payment method; payments made at the resort are refunded at the counter. Contact the resort to cancel.',
        link: { text: 'Contact the resort', href: '/contact' },
      },
      {
        slug: 'no-show',
        q: 'What if I don’t arrive?',
        a: 'If a guest doesn’t arrive, the booking is marked as a no-show and the payment is not refunded.',
      },
    ],
  },
];

/** The questions to show: the fixed ones, plus the times saved in Admin → Settings. */
export function faqsWith(contact) {
  const times = [
    contact.checkInTime && `Check-in is from ${contact.checkInTime}`,
    contact.checkOutTime && `check-out is by ${contact.checkOutTime}`,
  ].filter(Boolean);
  if (times.length === 0) return BASE_FAQS;

  const timesItem = { slug: 'check-in-times', q: 'What time is check-in and check-out?', a: `${times.join(' and ')}.` };
  return BASE_FAQS.map((section) =>
    section.group === 'Check-in and your stay' ? { ...section, items: [timesItem, ...section.items] } : section
  );
}

/** The same questions and answers in the format search engines read. */
export const faqJsonLd = (faqs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.flatMap((section) =>
    section.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
  ),
});
