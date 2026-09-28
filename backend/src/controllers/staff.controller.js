const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const cleaning = require('../services/cleaning.service');
const { emitJobUpdate } = require('../realtime');

// POST /api/staff/login
const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;

  const { rows } = await query(
    `SELECT id, name, phone, role, password_hash, is_active FROM staff WHERE phone = $1`,
    [phone]
  );
  const staff = rows[0];
  if (!staff || !staff.is_active || !(await bcrypt.compare(password, staff.password_hash))) {
    throw new ApiError(401, 'Invalid phone number or password');
  }

  const token = jwt.sign({ sub: staff.id, role: 'staff', staffRole: staff.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.STAFF_JWT_EXPIRES_IN || '12h',
  });

  res.json({ success: true, token, staff: { id: staff.id, name: staff.name, role: staff.role } });
});

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

module.exports = { login, me, myTasks, startTask, pauseTask, completeTask, approveInspection, rejectInspection };
