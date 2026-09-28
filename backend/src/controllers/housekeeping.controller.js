const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const cleaning = require('../services/cleaning.service');
const { emitJobUpdate } = require('../realtime');
const { runNightlyCleaning } = require('../jobs/nightlyCleaning');

// ----- Staff -----

// GET /api/admin/staff
const listStaff = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, phone, role, is_active, created_at FROM staff ORDER BY is_active DESC, role, name`
  );
  res.json({ success: true, staff: rows });
});

// POST /api/admin/staff
const addStaff = asyncHandler(async (req, res) => {
  const { name, phone, role, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await query(
      `INSERT INTO staff (name, phone, role, password_hash) VALUES ($1, $2, $3, $4)
       RETURNING id, name, phone, role, is_active, created_at`,
      [name, phone, role, passwordHash]
    );
    res.status(201).json({ success: true, staff: rows[0] });
  } catch (err) {
    if (err.code === '23505') throw new ApiError(409, 'A staff member with this phone number already exists');
    throw err;
  }
});

// PUT /api/admin/staff/:id — name, active flag, password reset. Role is fixed
// once created (existing task assignments depend on it).
const updateStaff = asyncHandler(async (req, res) => {
  const { name, isActive, password } = req.body;
  const sets = [];
  const values = [];
  if (name !== undefined) {
    values.push(name);
    sets.push(`name = $${values.length}`);
  }
  if (isActive !== undefined) {
    values.push(isActive);
    sets.push(`is_active = $${values.length}`);
  }
  if (password) {
    values.push(await bcrypt.hash(password, 10));
    sets.push(`password_hash = $${values.length}`);
  }
  if (sets.length === 0) throw new ApiError(400, 'No valid fields provided to update');

  values.push(req.params.id);
  const { rows } = await query(
    `UPDATE staff SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}
     RETURNING id, name, phone, role, is_active, created_at`,
    values
  );
  if (rows.length === 0) throw new ApiError(404, 'Staff member not found');
  res.json({ success: true, staff: rows[0] });
});

// ----- Room units (physical rooms) -----

// GET /api/admin/room-units
const listRoomUnits = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ru.*, r.name AS room_type
     FROM room_units ru JOIN rooms r ON r.id = ru.room_type_id
     ORDER BY ru.is_active DESC, ru.unit_number`
  );
  res.json({ success: true, units: rows });
});

// POST /api/admin/room-units
const addRoomUnit = asyncHandler(async (req, res) => {
  const { roomTypeId, unitNumber, floor, view } = req.body;
  try {
    const { rows } = await query(
      `INSERT INTO room_units (room_type_id, unit_number, floor, view_label) VALUES ($1, $2, $3, $4) RETURNING *`,
      [roomTypeId, unitNumber, floor || null, view || null]
    );
    res.status(201).json({ success: true, unit: rows[0] });
  } catch (err) {
    if (err.code === '23505') throw new ApiError(409, `Room ${unitNumber} already exists`);
    if (err.code === '23503') throw new ApiError(400, 'Room type not found');
    throw err;
  }
});

// PUT /api/admin/room-units/:id
const updateRoomUnit = asyncHandler(async (req, res) => {
  const map = { roomTypeId: 'room_type_id', unitNumber: 'unit_number', floor: 'floor', view: 'view_label', isActive: 'is_active' };
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(map)) {
    if (req.body[key] === undefined) continue;
    values.push(req.body[key]);
    sets.push(`${column} = $${values.length}`);
  }
  if (sets.length === 0) throw new ApiError(400, 'No valid fields provided to update');

  values.push(req.params.id);
  let rows;
  try {
    ({ rows } = await query(
      `UPDATE room_units SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    ));
  } catch (err) {
    if (err.code === '23505') throw new ApiError(409, 'That room number is already in use');
    throw err;
  }
  if (rows.length === 0) throw new ApiError(404, 'Room not found');
  res.json({ success: true, unit: rows[0] });
});

// ----- Cleaning jobs -----

// GET /api/admin/cleaning/jobs?all=true — default: open jobs + jobs finished today
const listJobs = asyncHandler(async (req, res) => {
  const jobs = await cleaning.listJobsForAdmin({ includeAll: req.query.all === 'true' });
  res.json({ success: true, jobs });
});

// POST /api/admin/cleaning/jobs — mark a room Dirty
const createJob = asyncHandler(async (req, res) => {
  const { roomUnitId, priority, notes } = req.body;
  const job = await cleaning.createManualJob({ roomUnitId, priority, notes, adminId: req.admin.sub });
  await emitJobUpdate(job.id, 'job_created');
  res.status(201).json({ success: true, job });
});

// PUT /api/admin/cleaning/jobs/:id/assign — { beddingStaffId, toiletryStaffId, inspectorId }
const assignJob = asyncHandler(async (req, res) => {
  const jobId = Number(req.params.id);
  const { beddingStaffId, toiletryStaffId, inspectorId } = req.body;
  const previousStaff = await cleaning.staffIdsForJob(jobId); // so un-assigned staff refresh too
  await cleaning.assignStaff(jobId, {
    Bedding: beddingStaffId,
    Toiletry: toiletryStaffId,
    Inspection: inspectorId,
  });
  await emitJobUpdate(jobId, 'job_assigned', previousStaff);
  res.json({ success: true });
});

// PATCH /api/admin/cleaning/jobs/:id/priority — { priority }
const updateJobPriority = asyncHandler(async (req, res) => {
  const job = await cleaning.setPriority(Number(req.params.id), req.body.priority);
  await emitJobUpdate(job.id, 'priority_changed');
  res.json({ success: true, job });
});

// POST /api/admin/cleaning/run-nightly — same as the 11 PM run; safe to repeat.
const runNightly = asyncHandler(async (req, res) => {
  const { date, jobs } = await runNightlyCleaning();
  res.json({ success: true, date, created: jobs.length });
});

module.exports = {
  listStaff,
  addStaff,
  updateStaff,
  listRoomUnits,
  addRoomUnit,
  updateRoomUnit,
  listJobs,
  createJob,
  assignJob,
  updateJobPriority,
  runNightly,
};
