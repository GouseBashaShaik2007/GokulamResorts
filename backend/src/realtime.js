/**
 * Socket.IO live updates.
 * Clients authenticate with the same JWT they use for the REST API
 * (socket = io(url, { auth: { token } })) and are placed in rooms:
 *   admins       — every manager dashboard
 *   frontdesk    — every front desk screen
 *   staff:<id>   — one staff member's devices (housekeeping tasks)
 * Events carry just enough to tell the client what changed; clients refetch.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function initRealtime(httpServer, allowedOrigins) {
  io = new Server(httpServer, { cors: { origin: allowedOrigins, credentials: true } });

  io.use((socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token || '', process.env.JWT_SECRET);
      if (payload.role !== 'admin' && payload.role !== 'staff') return next(new Error('Forbidden'));
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
    } else {
      socket.join(`staff:${user.sub}`);
      if (user.staffRole === 'FrontDesk') socket.join('frontdesk');
    }
  });

  return io;
}

/**
 * Broadcast a cleaning job change to admins and the job's assigned staff.
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

    let target = io.to('admins');
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

module.exports = { initRealtime, emitJobUpdate, emitBookingUpdate };
