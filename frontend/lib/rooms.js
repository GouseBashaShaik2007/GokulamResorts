// Room-type helpers shared by the room cards, rooms list and room detail page.

// The seeded /images/room-*.jpg files are generated title cards, not photos of
// the resort. Room pages must never show stock or fake bedrooms, so these are
// treated as "no photo yet" and render the neutral coming-soon frame instead.
const PLACEHOLDER_ROOM_IMAGE = /^\/images\/room-(deluxe|suite|villa|presidential)\.jpg$/;

export const realPhotos = (room) => (room?.images || []).filter((url) => url && !PLACEHOLDER_ROOM_IMAGE.test(url));

export const sqftToM2 = (sqft) => (sqft ? Math.round(Number(sqft) * 0.092903) : null);

// "Sea View", "Corner Sea View", "Panoramic Sea View" -> "Sea"; "Garden View" -> "Garden".
export const viewGroup = (label) => {
  const l = String(label || '').toLowerCase();
  if (l.includes('sea')) return 'Sea';
  if (l.includes('garden')) return 'Garden';
  if (l.includes('pool')) return 'Pool';
  return null;
};

export const viewGroupsOf = (room) => [...new Set((room.views || []).map(viewGroup).filter(Boolean))];
