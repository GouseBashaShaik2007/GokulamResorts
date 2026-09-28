/**
 * Private file storage for guest ID documents.
 *
 * STORAGE_DRIVER=supabase: Supabase Storage, talked to over its REST API with
 *   the service_role key (server-only — bypasses RLS, never expose to the
 *   frontend). SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DOCS_BUCKET
 *   (must be a PRIVATE bucket — files are only ever shared via short-lived
 *   signed URLs issued to managers).
 * STORAGE_DRIVER=s3 (any other S3-compatible bucket): S3_BUCKET, S3_REGION,
 *   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, optional S3_ENDPOINT (Cloudflare
 *   R2, DigitalOcean Spaces, MinIO ...), optional S3_SSE=AES256.
 * STORAGE_DRIVER=local: development only — files go to backend/private_uploads
 *   (git-ignored) and are served through a 60-second signed link.
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const DRIVER = process.env.STORAGE_DRIVER || 'local';
const LOCAL_DIR = path.join(__dirname, '..', '..', 'private_uploads');
const URL_TTL_SECONDS = 60;

if (DRIVER === 'local' && process.env.NODE_ENV === 'production') {
  throw new Error('STORAGE_DRIVER=local is not allowed in production. Configure Supabase or S3 for guest ID documents.');
}
if (DRIVER === 'local') {
  console.warn('[storage] LOCAL disk storage for ID documents (development only). Use STORAGE_DRIVER=supabase or s3 in production.');
}

function supabaseHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ...extra,
  };
}

let s3 = null;
function s3Client() {
  if (!s3) {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3 = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: !!process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3;
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

// Random, non-guessable key; no guest name or ID number in it.
function newKey(bookingId, contentType) {
  return `guest-documents/${bookingId}/${crypto.randomUUID()}.${EXT[contentType] || 'bin'}`;
}

async function put(key, buffer, contentType) {
  if (DRIVER === 'supabase') {
    const url = `${process.env.SUPABASE_URL}/storage/v1/object/${process.env.SUPABASE_DOCS_BUCKET}/${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: supabaseHeaders({ 'Content-Type': contentType, 'x-upsert': 'true' }),
      body: buffer,
    });
    if (!res.ok) throw new Error(`Supabase storage upload failed (${res.status}): ${await res.text()}`);
    return;
  }
  if (DRIVER === 's3') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ...(process.env.S3_SSE ? { ServerSideEncryption: process.env.S3_SSE } : {}),
      })
    );
    return;
  }
  const file = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buffer);
}

async function remove(key) {
  if (DRIVER === 'supabase') {
    const url = `${process.env.SUPABASE_URL}/storage/v1/object/${process.env.SUPABASE_DOCS_BUCKET}/${key}`;
    const res = await fetch(url, { method: 'DELETE', headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`Supabase storage delete failed (${res.status}): ${await res.text()}`);
    return;
  }
  if (DRIVER === 's3') {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    return;
  }
  await fs.rm(path.join(LOCAL_DIR, key), { force: true });
}

// Short-lived URL a manager's browser can open.
async function viewUrl(key, contentType, apiBaseUrl) {
  if (DRIVER === 'supabase') {
    const url = `${process.env.SUPABASE_URL}/storage/v1/object/sign/${process.env.SUPABASE_DOCS_BUCKET}/${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: URL_TTL_SECONDS }),
    });
    if (!res.ok) throw new Error(`Supabase storage sign failed (${res.status}): ${await res.text()}`);
    const { signedURL } = await res.json();
    return `${process.env.SUPABASE_URL}/storage/v1${signedURL}`;
  }
  if (DRIVER === 's3') {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    return getSignedUrl(
      s3Client(),
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ResponseContentType: contentType }),
      { expiresIn: URL_TTL_SECONDS }
    );
  }
  const token = jwt.sign({ purpose: 'doc', key, contentType }, process.env.JWT_SECRET, { expiresIn: URL_TTL_SECONDS });
  return `${apiBaseUrl}/documents/file?token=${encodeURIComponent(token)}`;
}

// Local driver only: resolve a signed link back to the file.
async function readLocal(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.purpose !== 'doc') throw new Error('Wrong token purpose');
  const file = path.join(LOCAL_DIR, payload.key);
  if (!file.startsWith(LOCAL_DIR)) throw new Error('Bad key');
  return { buffer: await fs.readFile(file), contentType: payload.contentType };
}

module.exports = { DRIVER, newKey, put, remove, viewUrl, readLocal, ALLOWED_TYPES: Object.keys(EXT) };
