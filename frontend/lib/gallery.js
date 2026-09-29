// Gallery photos. Everything here is a STOCK stand-in (placeholder: true)
// until the resort's own photos arrive — replace src/alt and drop the flag.
// Rooms deliberately has no stock photos: room pages must show the real rooms.
const u = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;

export const GALLERY_CATEGORIES = [
  { key: 'rooms', label: 'Rooms' },
  { key: 'beach', label: 'Beach' },
  { key: 'dining', label: 'Dining' },
  { key: 'events', label: 'Events' },
];

export const GALLERY = [
  { category: 'beach', src: u('1507525428034-b723cf961d3e'), alt: 'Waves rolling onto the sand at sunrise', placeholder: true },
  { category: 'beach', src: u('1473116763249-2faaef81ccda'), alt: 'Sea and sky at dusk', placeholder: true },
  { category: 'beach', src: u('1519046904884-53103b34b206'), alt: 'Palms and a beach umbrella', placeholder: true },
  { category: 'beach', src: u('1495616811223-4d98c6e9c869'), alt: 'Sunset over calm water', placeholder: true },
  { category: 'dining', src: u('1414235077428-338989a2e8c0'), alt: 'A plated main course', placeholder: true },
  { category: 'dining', src: u('1559339352-11d035aa65de'), alt: 'Open-air terrace tables by the water', placeholder: true },
  { category: 'dining', src: u('1504674900247-0877df9cc836'), alt: 'Dishes on a shared table', placeholder: true },
  { category: 'dining', src: u('1517248135467-4c7edcad34c4'), alt: 'Restaurant dining room', placeholder: true },
  { category: 'events', src: u('1519741497674-611481863552'), alt: 'Bride holding a bouquet', placeholder: true },
  { category: 'events', src: u('1519225421980-715cb0215aed'), alt: 'Long wedding table with flowers', placeholder: true },
  { category: 'events', src: u('1511795409834-ef04bbd61622'), alt: 'Banquet table set for a celebration', placeholder: true },
  { category: 'events', src: u('1464366400600-7168b8af9bc3'), alt: 'Event hall set for dinner', placeholder: true },
];
