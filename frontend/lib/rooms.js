// Room-type helpers shared by the room cards, rooms list and room detail page.

// The seeded room-*.jpg files are generated title cards, not photos of the
// resort. Room pages must never show stock or fake bedrooms, so these are
// treated as "no photo yet" and render the neutral coming-soon frame instead.
// Matched by file name, not folder: the seeds started in /images/ and were
// later copied to image storage under the same names.
const PLACEHOLDER_ROOM_IMAGE = /(^|\/)room-(deluxe|suite|villa|presidential)\.jpg$/;

export const realPhotos = (room) => (room?.images || []).filter((url) => url && !PLACEHOLDER_ROOM_IMAGE.test(url));

export const sqftToM2 = (sqft) => (sqft ? Math.round(Number(sqft) * 0.092903) : null);

// The amenities guests ask about first, in that order; anything else follows
// in the order it was entered in admin.
const AMENITY_PRIORITY = [/breakfast/i, /wi-?fi/i, /air.?con|\bac\b/i, /balcon/i, /pool/i, /sea|ocean|beach/i];

/** Up to `count` amenities worth showing on a room card. */
export function topAmenities(room, count = 3) {
  const all = room?.amenities || [];
  const rank = (name) => {
    const i = AMENITY_PRIORITY.findIndex((pattern) => pattern.test(name));
    return i === -1 ? AMENITY_PRIORITY.length : i;
  };
  return [...all].sort((a, b) => rank(a) - rank(b)).slice(0, count);
}

// Amenities are typed as one list in admin; guests read them in groups. An
// amenity goes in the first group whose pattern it matches, else "In the room".
const AMENITY_GROUPS = [
  { title: 'Food & drink', match: /breakfast|tea|coffee|kettle|mini.?bar|fridge|kitchen|meal|dining/i },
  { title: 'Bathroom', match: /bath|shower|\btub\b|hot water|toilet|towel|geyser/i },
  { title: 'Services', match: /service|housekeeping|laundry|butler|concierge|transfer|pickup|wake|power backup|parking/i },
];
const AMENITY_GROUP_ORDER = ['In the room', 'Bathroom', 'Food & drink', 'Services'];

/** [{ title, items }] in the order guests read them; empty groups left out. */
export function groupAmenities(room) {
  const groups = Object.fromEntries(AMENITY_GROUP_ORDER.map((title) => [title, []]));
  (room?.amenities || []).forEach((name) => {
    const group = AMENITY_GROUPS.find((g) => g.match.test(name));
    groups[group ? group.title : 'In the room'].push(name);
  });
  return AMENITY_GROUP_ORDER.map((title) => ({ title, items: groups[title] })).filter((g) => g.items.length > 0);
}

/** Whether the room's amenities say breakfast comes with the price. */
export const includesBreakfast = (room) => (room?.amenities || []).some((name) => /breakfast/i.test(name));

// "Sea View", "Corner Sea View", "Panoramic Sea View" -> "Sea"; "Garden View" -> "Garden".
export const viewGroup = (label) => {
  const l = String(label || '').toLowerCase();
  if (l.includes('sea')) return 'Sea';
  if (l.includes('garden')) return 'Garden';
  if (l.includes('pool')) return 'Pool';
  return null;
};

export const viewGroupsOf = (room) => [...new Set((room.views || []).map(viewGroup).filter(Boolean))];

// Where a room type's page lives: /rooms/<slug>. Falls back to the old numeric
// address (which redirects) for data saved before slugs were used in links.
export const roomPath = (room) => (room?.slug ? `/rooms/${room.slug}` : `/booking/${room.id}`);
