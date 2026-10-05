const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const cleaning = require('../services/cleaning.service');
const { emitJobUpdate } = require('../realtime');
const { startSession, endSession } = require('../utils/session');
const { tileNames } = require('../utils/tiles');

// Housekeeping may sign in with a PIN; the front desk (bookings, payments,
// guest IDs) always needs its phone number and password.
const PIN_ROLES = ['Bedding', 'Toiletry', 'Inspector'];

// Compared against when there is nobody to check, so every wrong answer takes the same time.
const NO_ONE = bcrypt.hashSync(crypto.randomBytes(12).toString('hex'), 10);

function signIn(res, staff) {
  const token = jwt.sign({ sub: staff.id, role: 'staff', staffRole: staff.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.STAFF_JWT_EXPIRES_IN || '12h',
  });
  startSession(res, 'staff', token);
  res.json({ success: true, staff: { id: staff.id, name: staff.name, role: staff.role } });
}

// POST /api/staff/login — phone number and password
const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;

  // The number as the manager typed it, or the same number written another way
  // ("98765 43210", "+91 9876543210"): compared on its last ten digits. If two
  // staff would match that loosely, only the exact spelling is accepted.
  const digits = String(phone || '').replace(/\D/g, '');
  const { rows } = await query(
    `SELECT id, name, phone, role, password_hash, is_active FROM staff
     WHERE phone = $1
        OR (length($2) >= 10 AND right(regexp_replace(phone, '\\D', '', 'g'), 10) = right($2, 10))
     ORDER BY (phone = $1) DESC, id
     LIMIT 2`,
    [phone, digits]
  );
  const staff = rows[0] && (rows[0].phone === phone || rows.length === 1) ? rows[0] : null;
  if (!staff || !staff.is_active || !(await bcrypt.compare(password, staff.password_hash))) {
    throw new ApiError(401, 'Invalid phone number or password');
  }

  signIn(res, staff);
});

// GET /api/staff/housekeepers — the name tiles on the housekeeping sign-in
// screen: active housekeeping staff who have a PIN. Public (shown before
// anyone has signed in): first names and roles only.
const listHousekeepers = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, role FROM staff
     WHERE is_active = true AND pin_hash IS NOT NULL AND role = ANY($1)
     ORDER BY name, id`,
    [PIN_ROLES]
  );
  res.json({ success: true, staff: tileNames(rows) });
});

// POST /api/staff/pin-login — { staffId, pin }: tap your name, type your PIN.
const pinLogin = asyncHandler(async (req, res) => {
  const { staffId, pin } = req.body;
  const { rows } = await query(
    `SELECT id, name, role, pin_hash FROM staff
     WHERE id = $1 AND is_active = true AND pin_hash IS NOT NULL AND role = ANY($2)`,
    [staffId, PIN_ROLES]
  );
  const staff = rows[0];
  const matches = await bcrypt.compare(String(pin), staff ? staff.pin_hash : NO_ONE);
  if (!staff || !matches) {
    throw new ApiError(401, 'Wrong PIN');
  }

  signIn(res, staff);
});

// POST /api/staff/logout
const logout = (req, res) => {
  endSession(res, 'staff');
  res.json({ success: true });
};

// GET /api/staff/me
const me = asyncHandler(async (req, res) => {
  const { id, name, role } = req.staff;
  res.json({ success: true, staff: { id, name, role } });
});

// GET /api/staff/tasks — my open tasks, priority DESC then oldest first
const myTasks = asyncHandler(async (req, res) => {
  const tasks = await cleaning.listTasksForStaff(req.staff.id);
  res.json({ success: true, tasks });
});

// POST /api/staff/tasks/:id/{start,pause,complete,approve,reject}
function taskAction(fn, event) {
  return asyncHandler(async (req, res) => {
    const job = await fn(req);
    await emitJobUpdate(job.id, event);
    res.json({ success: true });
  });
}

const startTask = taskAction((req) => cleaning.startTask(Number(req.params.id), req.staff.id), 'task_started');
const pauseTask = taskAction((req) => cleaning.pauseTask(Number(req.params.id), req.staff.id), 'task_paused');
const completeTask = taskAction(
  (req) => cleaning.completeTask(Number(req.params.id), req.staff.id),
  'task_completed'
);
const approveInspection = taskAction(
  (req) => cleaning.approveInspection(Number(req.params.id), req.staff.id),
  'inspection_approved'
);
const rejectInspection = taskAction(
  (req) =>
    cleaning.rejectInspection(Number(req.params.id), req.staff.id, req.body.failedTasks, req.body.failureReason),
  'inspection_rejected'
);

// GET /api/staff/jobs — inspectors only. Every open cleaning job with its
// tasks, and the housekeeping team, so an inspector can assign or reassign
// who does what.
const openJobs = asyncHandler(async (req, res) => {
  const [jobs, { rows: team }] = await Promise.all([
    cleaning.listJobsForAdmin(),
    query(`SELECT id, name, role FROM staff WHERE is_active = true AND role = ANY($1) ORDER BY name, id`, [PIN_ROLES]),
  ]);
  res.json({ success: true, jobs: jobs.filter((j) => j.status !== 'Ready'), team });
});

module.exports = {
  PIN_ROLES,
  login,
  listHousekeepers,
  pinLogin,
  logout,
  me,
  myTasks,
  openJobs,
  startTask,
  pauseTask,
  completeTask,
  approveInspection,
  rejectInspection,
};
