// Gallery photos. Everything here is a STOCK stand-in (placeholder: true)
// until the resort's own photos arrive — replace src/alt and drop the flag.
// Rooms deliberately has no stock photos: room pages must show the real rooms.
const u = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;

// The shape of a photo's tile in the grid, as width / height. Every tile gets
// one, so the page is laid out before any photo has loaded and nothing jumps.
// Photos without their own `ratio` (the room photos from admin) use this.
export const DEFAULT_RATIO = 4 / 3;

// Grid-sized version of a gallery photo, cropped to its tile's shape (the
// stock stand-ins are served at any size; other photos are shown as they are
// and cropped by the tile).
export const thumb = (src, ratio = DEFAULT_RATIO) =>
  src.startsWith('https://images.unsplash.com/') ? src.replace('w=1600', `w=800&h=${Math.round(800 / ratio)}`) : src;

export const GALLERY_CATEGORIES = [
  { key: 'rooms', label: 'Rooms' },
  { key: 'beach', label: 'Beach' },
  { key: 'dining', label: 'Dining' },
  { key: 'events', label: 'Events' },
];

export const GALLERY = [
  { category: 'beach', src: u('1507525428034-b723cf961d3e'), alt: 'Waves rolling onto the sand at sunrise', ratio: 4 / 3, placeholder: true },
  { category: 'beach', src: u('1473116763249-2faaef81ccda'), alt: 'Sea and sky at dusk', ratio: 4 / 5, placeholder: true },
  { category: 'beach', src: u('1519046904884-53103b34b206'), alt: 'Palms and a beach umbrella', ratio: 1, placeholder: true },
  { category: 'beach', src: u('1495616811223-4d98c6e9c869'), alt: 'Sunset over calm water', ratio: 4 / 3, placeholder: true },
  { category: 'dining', src: u('1414235077428-338989a2e8c0'), alt: 'A plated main course', ratio: 1, placeholder: true },
  { category: 'dining', src: u('1559339352-11d035aa65de'), alt: 'Open-air terrace tables by the water', ratio: 4 / 3, placeholder: true },
  { category: 'dining', src: u('1504674900247-0877df9cc836'), alt: 'Dishes on a shared table', ratio: 4 / 5, placeholder: true },
  { category: 'dining', src: u('1517248135467-4c7edcad34c4'), alt: 'Restaurant dining room', ratio: 4 / 3, placeholder: true },
  { category: 'events', src: u('1519741497674-611481863552'), alt: 'Bride holding a bouquet', ratio: 4 / 5, placeholder: true },
  { category: 'events', src: u('1519225421980-715cb0215aed'), alt: 'Long wedding table with flowers', ratio: 4 / 3, placeholder: true },
  { category: 'events', src: u('1511795409834-ef04bbd61622'), alt: 'Banquet table set for a celebration', ratio: 1, placeholder: true },
  { category: 'events', src: u('1464366400600-7168b8af9bc3'), alt: 'Event hall set for dinner', ratio: 4 / 3, placeholder: true },
];
