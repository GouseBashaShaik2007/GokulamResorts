/**
 * Resort facts shown on the guest site. Anything set to null is HIDDEN on the
 * site until it's filled in — nothing here is guessed.
 *
 * TODO(owner): fill in every null below; see the Phase 1 notes.
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
};

export const directionsUrl = () =>
  CONTACT.mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(CONTACT.mapQuery)}`;

export const mapEmbedUrl = () => `https://maps.google.com/maps?q=${encodeURIComponent(CONTACT.mapQuery)}&z=12&output=embed`;

// tel: link for the resort phone; null while no number is set.
export const telHref = () => (CONTACT.phone ? `tel:${CONTACT.phone.replace(/\s/g, '')}` : null);

export const whatsappUrl = (text = '') =>
  CONTACT.whatsapp ? `https://wa.me/${CONTACT.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null;

// Guest reviews. The reviews section and rating badges stay hidden while null.
// Shape: { google: { rating: 4.7, count: 312, url }, tripadvisor: { rating: 4.5, url },
//          quotes: [{ text, author, source: 'Google' | 'TripAdvisor' }] }
export const REVIEWS = null;

// "Getting here" — facts given by the owner.
export const GETTING_HERE = [
  { mode: 'By air', place: 'Vijayawada International Airport', detail: 'About 2 hours by road' },
  { mode: 'By train', place: 'Chirala railway station', detail: 'On the Chennai–Howrah main line' },
];

// Airport / station transfer add-on. Hidden until a price is set.
// Shape: { price: 2500, from: 'Vijayawada airport' }
export const TRANSFER = null;

// Offers & packages (fixed price with listed inclusions). The Offers section
// is hidden while this is empty. Shape:
// { slug, name, nights, price, inclusions: ['...'], roomTypeId?, validUntil? }
export const PACKAGES = [];
