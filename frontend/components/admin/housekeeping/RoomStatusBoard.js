'use client';

// Colors as specified for the at-a-glance room board (distinct from the
// badge palette used elsewhere, which is tuned for text-on-pill contrast).
const TILE_COLOR = {
  Dirty: '#E8A33D',
  Cleaning: '#3B82F6',
  Inspection: '#8B5CF6',
  Ready: '#2E9E6A',
};
// A mark as well as a colour, so status doesn't depend on telling amber from green.
const TILE_MARK = { Dirty: 'D', Cleaning: 'C', Inspection: 'I', Ready: '✓' };

// Rooms as the building has them: one row per floor, rooms in number order.
function byFloor(units) {
  const floors = new Map();
  for (const u of units) {
    const key = u.floor || '';
    if (!floors.has(key)) floors.set(key, []);
    floors.get(key).push(u);
  }
  const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
  return [...floors.entries()]
    .sort(([a], [b]) => natural(a, b))
    .map(([floor, rooms]) => ({ floor, rooms: rooms.sort((a, b) => natural(a.unit_number, b.unit_number)) }));
}

// "1" -> "Floor 1"; a named floor ("Garden") is shown as it is.
const floorLabel = (floor) => (!floor ? 'No floor set' : /^\d+$/.test(floor) ? `Floor ${floor}` : floor);

// One tile per physical room, colored by current housekeeping status — a
// glanceable summary above the detailed job cards below.
export default function RoomStatusBoard({ units, filter, onFilterStatus }) {
  const floors = byFloor(units.filter((u) => u.is_active));
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Rooms at a glance</p>
        <div className="flex flex-wrap gap-3 text-xs text-ink-400">
          {Object.entries(TILE_COLOR).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              {status} ({TILE_MARK[status]})
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {floors.map(({ floor, rooms }) => (
          <div key={floor} className="grid gap-2 sm:grid-cols-[6rem_1fr] sm:items-start">
            <p className="pt-3 text-xs font-medium text-ink-400">{floorLabel(floor)}</p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
        {rooms.map((u) => (
          <button
            key={u.id}
            onClick={() => onFilterStatus(u.status)}
            title={`${u.unit_number} — ${u.status}`}
            aria-label={`Room ${u.unit_number}, ${u.status}`}
            aria-pressed={filter === u.status}
            className={`flex h-11 flex-col items-center justify-center rounded-lg text-xs font-bold leading-tight transition ${
              u.status === 'Dirty' ? 'text-ink-900' : 'text-white' // white is unreadable on the amber tile
            } ${filter === u.status ? 'ring-2 ring-offset-2 ring-offset-sand-50' : ''}`}
            style={{ backgroundColor: TILE_COLOR[u.status], ...(filter === u.status ? { '--tw-ring-color': TILE_COLOR[u.status] } : {}) }}
          >
            {u.unit_number}
            <span className="text-[9px] font-semibold opacity-90" aria-hidden="true">{TILE_MARK[u.status]}</span>
          </button>
        ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
