/**
 * Seeds an initial admin account (from env vars) and a few sample rooms.
 * Safe to re-run: uses ON CONFLICT to avoid duplicates.
 * Usage: npm run db:seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

const SAMPLE_ROOMS = [
  {
    name: 'Deluxe Beachfront Room',
    slug: 'deluxe-beachfront-room',
    description:
      'Wake up to uninterrupted views of Chirala Beach from your private balcony. Spacious, breezy, and steps from the sand.',
    price_per_night: 6500,
    capacity: 2,
    total_rooms: 8,
    size_sqft: 380,
    bed_type: 'King Bed',
    amenities: ['Sea View', 'Free WiFi', 'Air Conditioning', 'Private Balcony', 'Breakfast Included'],
    images: ['/images/room-deluxe.jpg'],
  },
  {
    name: 'Premium Sea View Suite',
    slug: 'premium-sea-view-suite',
    description:
      'A generous suite with a separate living area, floor-to-ceiling windows, and a soaking tub facing the Bay of Bengal.',
    price_per_night: 11000,
    capacity: 3,
    total_rooms: 5,
    size_sqft: 620,
    bed_type: 'King Bed + Sofa',
    amenities: ['Sea View', 'Free WiFi', 'Mini Bar', 'Soaking Tub', 'Butler Service'],
    images: ['/images/room-suite.jpg'],
  },
  {
    name: 'Family Garden Villa',
    slug: 'family-garden-villa',
    description:
      'A standalone villa tucked in the resort gardens with two bedrooms, ideal for families and small groups.',
    price_per_night: 15500,
    capacity: 5,
    total_rooms: 3,
    size_sqft: 950,
    bed_type: '2 Bedrooms',
    amenities: ['Garden View', 'Free WiFi', 'Kitchenette', 'Private Pool Access', 'Breakfast Included'],
    images: ['/images/room-villa.jpg'],
  },
  {
    name: 'Royal Gokulam Presidential Suite',
    slug: 'royal-presidential-suite',
    description:
      'The pinnacle of Gokulam Resorts: a private terrace, plunge pool, and dedicated concierge for the ultimate beach escape.',
    price_per_night: 24000,
    capacity: 4,
    total_rooms: 1,
    size_sqft: 1400,
    bed_type: 'King Bed + Guest Room',
    amenities: ['Panoramic Sea View', 'Private Plunge Pool', 'Dedicated Concierge', 'Free WiFi', 'Airport Transfer'],
    images: ['/images/room-presidential.jpg'],
  },
];

// Physical rooms guests book directly, keyed by room-type slug: [number, floor, view].
const SAMPLE_ROOM_UNITS = {
  'deluxe-beachfront-room': [
    ['101', '1', 'Sea View'], ['102', '1', 'Sea View'], ['103', '1', 'Sea View'], ['104', '1', 'Sea View'],
    ['105', '1', 'Pool View'], ['106', '1', 'Pool View'], ['107', '1', 'Garden View'], ['108', '1', 'Garden View'],
  ],
  'premium-sea-view-suite': [
    ['201', '2', 'Sea View'], ['202', '2', 'Sea View'], ['203', '2', 'Sea View'],
    ['204', '2', 'Corner Sea View'], ['205', '2', 'Corner Sea View'],
  ],
  'family-garden-villa': [['V1', 'Garden', 'Garden View'], ['V2', 'Garden', 'Garden View'], ['V3', 'Garden', 'Pool View']],
  'royal-presidential-suite': [['P1', '3', 'Panoramic Sea View']],
};

const SAMPLE_CATEGORIES = [
  { name: 'Starters', slug: 'starters', sort_order: 1 },
  { name: 'Main Course', slug: 'main-course', sort_order: 2 },
  { name: 'Beverages', slug: 'beverages', sort_order: 3 },
  { name: 'Desserts', slug: 'desserts', sort_order: 4 },
];

const SAMPLE_MENU_ITEMS = [
  {
    category_slug: 'starters',
    name: 'Peri Peri Prawns',
    description: 'Chirala coast prawns tossed in a smoky peri peri glaze.',
    price: 380,
    is_veg: false,
    image: '/images/food-peri-peri-prawns.jpg',
  },
  {
    category_slug: 'starters',
    name: 'Paneer Tikka',
    description: 'Char-grilled cottage cheese skewers with mint chutney.',
    price: 260,
    is_veg: true,
    image: '/images/food-paneer-tikka.jpg',
  },
  {
    category_slug: 'main-course',
    name: 'Andhra Fish Curry',
    description: 'Fresh catch simmered in a tangy, home-style Andhra curry.',
    price: 420,
    is_veg: false,
    image: '/images/food-fish-curry.jpg',
  },
  {
    category_slug: 'main-course',
    name: 'Vegetable Biryani',
    description: 'Fragrant basmati rice layered with garden vegetables and spices.',
    price: 300,
    is_veg: true,
    image: '/images/food-veg-biryani.jpg',
  },
  {
    category_slug: 'beverages',
    name: 'Fresh Tender Coconut',
    description: 'Straight off the tree, served chilled.',
    price: 90,
    is_veg: true,
    image: '/images/food-tender-coconut.jpg',
  },
  {
    category_slug: 'beverages',
    name: 'Masala Chai',
    description: 'Spiced Indian tea, brewed strong.',
    price: 60,
    is_veg: true,
    image: '/images/food-masala-chai.jpg',
  },
  {
    category_slug: 'desserts',
    name: 'Gulab Jamun',
    description: 'Warm milk dumplings soaked in cardamom syrup.',
    price: 150,
    is_veg: true,
    image: '/images/food-gulab-jamun.jpg',
  },
];

async function seed() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed.');
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      `INSERT INTO admins (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      ['Gokulam Admin', adminEmail, passwordHash]
    );
    console.log(`Admin account ready: ${adminEmail}`);
  }

  for (const room of SAMPLE_ROOMS) {
    await pool.query(
      `INSERT INTO rooms
        (name, slug, description, price_per_night, capacity, total_rooms, size_sqft, bed_type, amenities, images)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (slug) DO NOTHING`,
      [
        room.name,
        room.slug,
        room.description,
        room.price_per_night,
        room.capacity,
        room.total_rooms,
        room.size_sqft,
        room.bed_type,
        room.amenities,
        room.images,
      ]
    );
  }
  console.log(`Seeded ${SAMPLE_ROOMS.length} sample rooms (skipped any that already exist).`);

  const categoryIds = {};
  for (const category of SAMPLE_CATEGORIES) {
    const { rows } = await pool.query(
      `INSERT INTO menu_categories (name, slug, sort_order)
       VALUES ($1,$2,$3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [category.name, category.slug, category.sort_order]
    );
    categoryIds[category.slug] = rows[0].id;
  }
  console.log(`Seeded ${SAMPLE_CATEGORIES.length} menu categories.`);

  for (const item of SAMPLE_MENU_ITEMS) {
    const categoryId = categoryIds[item.category_slug];
    const existing = await pool.query(
      `SELECT id FROM menu_items WHERE category_id = $1 AND name = $2`,
      [categoryId, item.name]
    );
    if (existing.rows.length > 0) continue;

    await pool.query(
      `INSERT INTO menu_items (category_id, name, description, price, image, is_veg)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [categoryId, item.name, item.description, item.price, item.image, item.is_veg]
    );
  }
  console.log(`Seeded ${SAMPLE_MENU_ITEMS.length} menu items (skipped any that already exist).`);

  let unitCount = 0;
  for (const [slug, units] of Object.entries(SAMPLE_ROOM_UNITS)) {
    const { rows } = await pool.query(`SELECT id FROM rooms WHERE slug = $1`, [slug]);
    if (rows.length === 0) continue;
    for (const [unitNumber, floor, view] of units) {
      await pool.query(
        `INSERT INTO room_units (room_type_id, unit_number, floor, view_label) VALUES ($1, $2, $3, $4)
         ON CONFLICT (unit_number) DO UPDATE SET view_label = COALESCE(room_units.view_label, EXCLUDED.view_label)`,
        [rows[0].id, unitNumber, floor, view]
      );
      unitCount += 1;
    }
  }
  console.log(`Seeded ${unitCount} physical room units (skipped any that already exist).`);

  await pool.end();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
