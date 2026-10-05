/**
 * Socket.IO live updates.
 * Clients are signed in the same way as for the REST API: the browser sends
 * the sign-in cookie with the connection, and says which staff tool it is —
 * io(url, { withCredentials: true, auth: { section: 'kitchen' } }) — so the
 * right cookie is read (see utils/session.js). They are placed in rooms:
 *   admins       — every manager dashboard
 *   frontdesk    — every front desk screen
 *   staff:<id>   — one staff member's devices (housekeeping tasks)
 *   inspectors   — every inspector (they assign rooms, so they see every job)
 *   kitchen      — every kitchen display
 * Events carry just enough to tell the client what changed; clients refetch.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { tokenForSocket } = require('./utils/session');

let io = null;

function initRealtime(httpServer, allowedOrigins) {
  io = new Server(httpServer, { cors: { origin: allowedOrigins, credentials: true } });

  io.use((socket, next) => {
    try {
      const payload = jwt.verify(tokenForSocket(socket.handshake) || '', process.env.JWT_SECRET);
      if (!['admin', 'staff', 'kitchen'].includes(payload.role)) return next(new Error('Forbidden'));
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (user.role === 'admin') {
      socket.join('admins');
    } else if (user.role === 'kitchen') {
      socket.join('kitchen');
    } else {
      socket.join(`staff:${user.sub}`);
      if (user.staffRole === 'FrontDesk') socket.join('frontdesk');
      if (user.staffRole === 'Inspector') socket.join('inspectors');
    }
  });

  return io;
}

/**
 * Broadcast a cleaning job change to admins, inspectors and the job's assigned staff.
 * `event` is a short machine name, e.g. 'task_completed', 'inspection_approved'.
 * Never throws — realtime is best-effort on top of the committed DB change.
 */
async function emitJobUpdate(jobId, event, extraStaffIds = []) {
  if (!io) return;
  try {
    // Required lazily to avoid a cycle (service -> pool, realtime -> service).
    const { staffIdsForJob } = require('./services/cleaning.service');
    const staffIds = new Set([...(await staffIdsForJob(jobId)), ...extraStaffIds]);
    const payload = { jobId, event, at: new Date().toISOString() };

    let target = io.to('admins').to('inspectors');
    for (const id of staffIds) target = target.to(`staff:${id}`);
    target.emit('cleaning:update', payload);
  } catch (err) {
    console.error('[realtime] emit failed:', err.message);
  }
}

/** Booking changed — managers and the front desk refresh. */
function emitBookingUpdate(bookingId, event) {
  if (!io) return;
  io.to('admins').to('frontdesk').emit('booking:update', { bookingId, event, at: new Date().toISOString() });
}

/**
 * A food order or a table request changed — kitchen displays, managers and
 * the front desk (which takes the payment) refresh. `event`: 'order_created',
 * 'order_status', 'order_paid', 'table_request' …
 * Best-effort: the screens also poll, so a missed event only costs seconds.
 */
function emitFoodUpdate(event, details = {}) {
  if (!io) return;
  io.to('kitchen').to('admins').to('frontdesk').emit('food:update', { event, ...details, at: new Date().toISOString() });
}

/** A room problem was reported or resolved — managers refresh. */
function emitIssueUpdate(event, details = {}) {
  if (!io) return;
  io.to('admins').emit('issue:update', { event, ...details, at: new Date().toISOString() });
}

module.exports = { initRealtime, emitJobUpdate, emitBookingUpdate, emitFoodUpdate, emitIssueUpdate };
