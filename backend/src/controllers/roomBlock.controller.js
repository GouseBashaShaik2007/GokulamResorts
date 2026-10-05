// Rooms taken out of order, and put back. Front desk or manager (deskAuth).
const asyncHandler = require('../utils/asyncHandler');
const roomBlocks = require('../services/roomBlocks.service');
const { logAction } = require('../utils/auditLog');
const { emitBookingUpdate } = require('../realtime');

// Dates travel as YYYY-MM-DD; anything after the day is dropped.
const day = (value) => (value ? String(value).slice(0, 10) : null);

// GET /api/desk/room-blocks?from&to — blocks touching those days; without them, all not yet over
const list = asyncHandler(async (req, res) => {
  res.json({ success: true, blocks: await roomBlocks.list({ from: day(req.query.from), to: day(req.query.to) }) });
});

// POST /api/desk/room-blocks — { roomUnitId, startDate?, endDate?, reason, roomIssueId? }
// Answers with the block and the bookings in that room that now need moving.
const create = asyncHandler(async (req, res) => {
  const { roomUnitId, startDate, endDate, reason, roomIssueId } = req.body;
  const { block, affected } = await roomBlocks.create(
    { roomUnitId, startDate: day(startDate), endDate: day(endDate), reason, roomIssueId: roomIssueId || null },
    req.actor
  );
  logAction({
    actorType: req.actor.type,
    actorId: req.actor.id,
    action: 'room_blocked',
    details: { blockId: block.id, room: block.unit_number, from: block.start_date, until: block.end_date, reason, bookingsToMove: affected.length },
  });
  // The rooms board and the calendar are refreshed by booking events.
  emitBookingUpdate(null, 'room_blocked');
  res.status(201).json({ success: true, block, affected });
});

// POST /api/desk/room-blocks/:id/end — the room is back in service from today
const end = asyncHandler(async (req, res) => {
  const block = await roomBlocks.end(Number(req.params.id), req.actor);
  logAction({
    actorType: req.actor.type,
    actorId: req.actor.id,
    action: 'room_unblocked',
    details: { blockId: block.id, room: block.unit_number, backFrom: block.end_date },
  });
  emitBookingUpdate(null, 'room_unblocked');
  res.json({ success: true, block });
});

module.exports = { list, create, end };
