/**
 * Public image storage (room photos, menu item photos) — Supabase Storage,
 * public buckets. Unlike storage.service.js (private guest ID documents,
 * signed URLs), these files are served directly via their public URL.
 */
const crypto = require('crypto');

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const ALLOWED_TYPES = Object.keys(EXT);

const BUCKETS = {
  food: process.env.SUPABASE_FOOD_IMAGES_BUCKET,
  room: process.env.SUPABASE_ROOM_IMAGES_BUCKET,
};

// Random, collision-proof filename so repeated uploads never clobber each other.
function newKey(contentType) {
  return `${crypto.randomUUID()}.${EXT[contentType] || 'bin'}`;
}

async function upload(kind, buffer, contentType) {
  const bucket = BUCKETS[kind];
  if (!bucket) throw new Error(`Unknown image kind "${kind}"`);

  const key = newKey(contentType);
  const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Image upload failed (${res.status}): ${await res.text()}`);

  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${key}`;
}

module.exports = { upload, ALLOWED_TYPES };
