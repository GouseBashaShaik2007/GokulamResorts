/**
 * One-off: uploads the local placeholder room/food images into Supabase
 * Storage public buckets and repoints the matching DB rows at the new URLs.
 * Safe to re-run (uses x-upsert on the storage side, plain UPDATE on the DB side).
 */
require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../src/db/pool');

const IMAGES_DIR = path.join(__dirname, '..', '..', 'frontend', 'public', 'images');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function uploadPublic(bucket, filename) {
  const filePath = path.join(IMAGES_DIR, filename);
  const buffer = await fs.readFile(filePath);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Upload failed for ${filename}: ${res.status} ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`;
}

async function main() {
  const roomBucket = process.env.SUPABASE_ROOM_IMAGES_BUCKET;
  const foodBucket = process.env.SUPABASE_FOOD_IMAGES_BUCKET;

  const { rows: rooms } = await pool.query('SELECT id, slug, images FROM rooms');
  for (const room of rooms) {
    const newImages = [];
    for (const localPath of room.images) {
      const filename = path.basename(localPath);
      try {
        newImages.push(await uploadPublic(roomBucket, filename));
        console.log(`Room "${room.slug}": uploaded ${filename}`);
      } catch (err) {
        console.warn(`Room "${room.slug}": skipped ${filename} (${err.message})`);
        newImages.push(localPath);
      }
    }
    await pool.query('UPDATE rooms SET images = $1 WHERE id = $2', [newImages, room.id]);
  }

  const { rows: items } = await pool.query('SELECT id, name, image FROM menu_items WHERE image IS NOT NULL');
  for (const item of items) {
    const filename = path.basename(item.image);
    try {
      const newUrl = await uploadPublic(foodBucket, filename);
      await pool.query('UPDATE menu_items SET image = $1 WHERE id = $2', [newUrl, item.id]);
      console.log(`Menu item "${item.name}": uploaded ${filename}`);
    } catch (err) {
      console.warn(`Menu item "${item.name}": skipped ${filename} (${err.message})`);
    }
  }

  await pool.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
