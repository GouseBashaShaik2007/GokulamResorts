import { SITE_NAME, SITE_URL } from './site';

// Search-engine data (JSON-LD) is written into a <script> tag as raw text.
// Some of it comes from the database — room names, descriptions, amenities —
// so a "<" in that text (for example "</script>") must not be able to close
// the tag and start markup of its own. Escaped, it is still the same JSON.
export const jsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

// How to reach the resort, from the details saved in Admin → Settings.
// Only what is actually set is included — a search engine is told nothing made up.
const reachable = (contact) => ({
  address: contact.address,
  ...(contact.phone ? { telephone: contact.phone } : {}),
  ...(contact.email ? { email: contact.email } : {}),
  ...(contact.mapsUrl ? { hasMap: contact.mapsUrl } : {}),
});

/** The resort itself, for the home and contact pages. */
export function hotelJsonLd(contact) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: SITE_NAME,
    ...(SITE_URL ? { url: SITE_URL } : {}),
    ...reachable(contact),
  };
}

/** The restaurant and its menu (`menu` = categories, each with `items`), for the dining page. */
export function restaurantJsonLd(contact, menu) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: `${SITE_NAME} — Restaurant`,
    ...(SITE_URL ? { url: `${SITE_URL}/dining` } : {}),
    ...reachable(contact),
    ...(menu.length
      ? {
          hasMenu: {
            '@type': 'Menu',
            hasMenuSection: menu.map((category) => ({
              '@type': 'MenuSection',
              name: category.name,
              hasMenuItem: category.items.map((item) => ({
                '@type': 'MenuItem',
                name: item.name,
                ...(item.description ? { description: item.description } : {}),
                offers: { '@type': 'Offer', price: Number(item.price), priceCurrency: 'INR' },
                ...(item.is_veg ? { suitableForDiet: 'https://schema.org/VegetarianDiet' } : {}),
              })),
            })),
          },
        }
      : {}),
  };
}
