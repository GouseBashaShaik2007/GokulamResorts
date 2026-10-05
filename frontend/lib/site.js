/**
 * Resort facts shown on the guest site. Anything set to null is HIDDEN on the
 * site until it's filled in — nothing here is guessed.
 *
 * The contact details and check-in times are set in Admin → Settings; the
 * values in CONTACT below are only what the site shows until that is done.
 *
 * TODO(owner): the rest (reviews, transfer, packages) is still filled in here.
 */

// Public web address, used for QR codes and links in messages.
// Set NEXT_PUBLIC_SITE_URL in the deployment (e.g. https://gokulamresorts.in).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

// The one place the brand name is spelled, for titles and metadata.
export const SITE_NAME = 'Gokulam Resorts';

export const CONTACT = {
  phone: null, // e.g. '+91 98xxx xxxxx' — Call buttons and tel: links appear once set
  whatsapp: null, // digits only incl. country code, e.g. '9198xxxxxxxx' — WhatsApp button appears once set
  email: 'reservations@gokulamresorts.in',
  address: 'Chirala Beach Road, Chirala, Andhra Pradesh 523155, India', // TODO(owner): confirm exact address
  mapsUrl: null, // Google Maps share link for the resort pin — used by "Directions"
  // Until the exact pin is set, maps show the area, not a specific building.
  mapQuery: 'Chirala Beach, Andhra Pradesh, India',
  // The resort's times, as shown to guests. Admin → Settings can change them.
  checkInTime: '2:00 PM',
  checkOutTime: '11:00 AM',
};

/**
 * The contact details to show: what was saved in Admin → Settings (`info`,
 * from GET /site-info), with CONTACT above filling any gap. Server pages get
 * this from getContact() in lib/server-api.js; client components from
 * useContact() in components/site/ContactContext.js.
 */
export function resolveContact(info) {
  const saved = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  return {
    phone: saved(info?.phone) || CONTACT.phone,
    whatsapp: saved(info?.whatsapp) || CONTACT.whatsapp,
    email: saved(info?.email) || CONTACT.email,
    address: saved(info?.address) || CONTACT.address,
    mapsUrl: saved(info?.maps_url) || CONTACT.mapsUrl,
    mapQuery: CONTACT.mapQuery,
    checkInTime: saved(info?.check_in_time) || CONTACT.checkInTime,
    checkOutTime: saved(info?.check_out_time) || CONTACT.checkOutTime,
  };
}

// Each helper takes the contact details to use (defaults to CONTACT).

export const directionsUrl = (contact = CONTACT) =>
  contact.mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(contact.mapQuery)}`;

export const mapEmbedUrl = (contact = CONTACT) => `https://maps.google.com/maps?q=${encodeURIComponent(contact.mapQuery)}&z=12&output=embed`;

// tel: link for the resort phone; null while no number is set.
export const telHref = (contact = CONTACT) => (contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, '')}` : null);

export const whatsappUrl = (text = '', contact = CONTACT) =>
  contact.whatsapp ? `https://wa.me/${contact.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null;

// Guest reviews. The reviews section and rating badges stay hidden while null.
// Shape: { google: { rating: 4.7, count: 312, url }, tripadvisor: { rating: 4.5, url },
//          quotes: [{ text, author, source: 'Google' | 'TripAdvisor' }] }
export const REVIEWS = null;

// "Getting here" — facts given by the owner.
export const GETTING_HERE = [
  { mode: 'By air', place: 'Vijayawada International Airport', detail: 'About 2 hours by road' },
  { mode: 'By train', place: 'Chirala railway station', detail: 'On the Chennai–Howrah main line' },
];

// Home page "Experiences" tiles. Stock photos until the resort's own arrive.
// A tile with href: null is shown without a link (and without the hover zoom).
export const EXPERIENCES = [
  { title: 'Beach', text: 'Long, quiet stretches of sand on the Bay of Bengal.', href: '/gallery?c=beach', image: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=900&q=75' },
  { title: 'Dining', text: 'Coastal Andhra cooking and the day’s catch.', href: '/dining', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=75' },
  { title: 'Spa', text: 'Slow afternoons and traditional therapies.', href: null, image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=75' },
  { title: 'Sunset', text: 'Evenings made for doing very little.', href: '/gallery?c=beach', image: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=900&q=75' },
];

// Airport / station transfer add-on. Hidden until a price is set.
// Shape: { price: 2500, from: 'Vijayawada airport' }
export const TRANSFER = null;

// Offers & packages (fixed price with listed inclusions). The Offers section
// is hidden while this is empty. Shape:
// { slug, name, nights, price, inclusions: ['...'], roomTypeId?, validUntil? }
export const PACKAGES = [];
