const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const storage = require('../services/storage.service');
const { logAction } = require('../utils/auditLog');
const { emitIssueUpdate } = require('../realtime');

// Problems housekeeping finds in a room — a broken tap, a stain, something a
// guest left behind — reported from the room and handled by the manager.
const KINDS = ['repair', 'damage', 'lost_property', 'other'];

// A photo may show a guest's belongings, so it is stored privately (like ID
// documents) and deleted this many days after the problem is resolved.
const PHOTO_RETENTION_DAYS = Number(process.env.ISSUE_PHOTO_RETENTION_DAYS || 30);

// POST /api/staff/issues — multipart: roomUnitId, kind, description, photo (optional)
const report = asyncHandler(async (req, res) => {
  const { roomUnitId, kind, description } = req.body;

  const { rows: units } = await query(`SELECT id, unit_number FROM room_units WHERE id = $1 AND is_active = true`, [roomUnitId]);
  const unit = units[0];
  if (!unit) throw new ApiError(404, 'Room not found');

  let photoKey = null;
  if (req.file) {
    photoKey = storage.newIssueKey(unit.id, req.file.mimetype);
    await storage.put(photoKey, req.file.buffer, req.file.mimetype);
  }

  let issue;
  try {
    const { rows } = await query(
      `INSERT INTO room_issues (room_unit_id, kind, description, photo_key, photo_content_type, reported_by_staff_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [unit.id, kind, description, photoKey, req.file ? req.file.mimetype : null, req.staff.id]
    );
    issue = rows[0];
  } catch (err) {
    // Don't leave a photo behind for a report that was never saved.
    if (photoKey) await storage.remove(photoKey).catch(() => {});
    throw err;
  }

  logAction({ actorType: 'staff', actorId: req.staff.id, action: 'room_issue_reported', details: { issueId: issue.id, room: unit.unit_number, kind } });
  emitIssueUpdate('issue_reported', { issueId: issue.id });
  res.status(201).json({ success: true, issue: { id: issue.id, room: unit.unit_number, created_at: issue.created_at } });
});

// GET /api/admin/room-issues?status=open|resolved|all — open ones first, newest first.
const list = asyncHandler(async (req, res) => {
  const status = req.query.status || 'open';
  const { rows } = await query(
    `SELECT ri.id, ri.kind, ri.description, ri.status, ri.created_at, ri.resolved_at, ri.resolution_note,
            (ri.photo_key IS NOT NULL) AS has_photo,
            ru.unit_number, ru.floor, r.name AS room_type, s.name AS reported_by, s.role AS reported_by_role
     FROM room_issues ri
     JOIN room_units ru ON ru.id = ri.room_unit_id
     JOIN rooms r ON r.id = ru.room_type_id
     JOIN staff s ON s.id = ri.reported_by_staff_id
     WHERE $1 = 'all' OR ri.status = $1
     ORDER BY (ri.status = 'open') DESC, ri.created_at DESC
     LIMIT 200`,
    [status]
  );
  res.json({ success: true, issues: rows });
});

// GET /api/admin/room-issues/:id/photo-url — a 60-second link to the photo.
const photoUrl = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT photo_key, photo_content_type FROM room_issues WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) throw new ApiError(404, 'Report not found');
  if (!rows[0].photo_key) throw new ApiError(404, 'This report has no photo');
  const apiBase = `${req.protocol}://${req.get('host')}/api`;
  res.json({ success: true, url: await storage.viewUrl(rows[0].photo_key, rows[0].photo_content_type, apiBase) });
});

// POST /api/admin/room-issues/:id/resolve — { note? }
const resolve = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE room_issues SET status = 'resolved', resolved_at = now(), resolved_by_admin_id = $2, resolution_note = $3
     WHERE id = $1 AND status = 'open' RETURNING id`,
    [req.params.id, req.admin.sub, req.body.note || null]
  );
  if (rows.length === 0) {
    const { rows: existing } = await query(`SELECT status FROM room_issues WHERE id = $1`, [req.params.id]);
    if (existing.length === 0) throw new ApiError(404, 'Report not found');
    throw new ApiError(409, 'This report is already resolved');
  }
  logAction({ actorType: 'admin', actorId: req.admin.sub, action: 'room_issue_resolved', details: { issueId: rows[0].id, note: req.body.note || null } });
  emitIssueUpdate('issue_resolved', { issueId: rows[0].id });
  res.json({ success: true });
});

// Deletes the photos of problems resolved more than PHOTO_RETENTION_DAYS ago.
// Returns how many were deleted. Safe to repeat.
async function purgeOldPhotos() {
  const { rows } = await query(
    `SELECT id, photo_key FROM room_issues
     WHERE photo_key IS NOT NULL AND status = 'resolved' AND resolved_at < now() - ($1 || ' days')::interval`,
    [String(PHOTO_RETENTION_DAYS)]
  );
  let purged = 0;
  for (const row of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop -- a handful of files, one at a time
      await storage.remove(row.photo_key);
      // eslint-disable-next-line no-await-in-loop
      await query(`UPDATE room_issues SET photo_key = NULL WHERE id = $1`, [row.id]);
      purged += 1;
    } catch (err) {
      console.error(`[jobs] could not delete the photo of room issue ${row.id}:`, err.message);
    }
  }
  return purged;
}

module.exports = { KINDS, PHOTO_RETENTION_DAYS, report, list, photoUrl, resolve, purgeOldPhotos };
