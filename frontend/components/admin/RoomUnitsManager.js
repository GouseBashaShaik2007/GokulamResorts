'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';
import { useToast } from '@/components/ui/Toast';
import { errMsg } from '../../lib/bookingUi';
import { JOB_STATUS_STYLE } from '../../lib/cleaningStyles';

/**
 * Admin → Rooms → Room numbers: the physical rooms (101, 102…) of each room
 * type. Guests pick one of these by number when they book.
 */
export default function RoomUnitsManager() {
  const toast = useToast();
  const [units, setUnits] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [form, setForm] = useState({ roomTypeId: '', unitNumber: '', floor: '', view: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/admin/room-units', withAdminAuth())
      .then((res) => setUnits(res.data.units))
      .catch((err) => toast(errMsg(err, 'Could not load rooms'), { tone: 'error' }));
  }, [toast]);

  useEffect(() => {
    load();
    api
      .get('/admin/rooms', withAdminAuth())
      .then((res) => setRoomTypes(res.data.rooms))
      .catch((err) => toast(errMsg(err, 'Could not load room types'), { tone: 'error' }));
  }, [load, toast]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(
        '/admin/room-units',
        { roomTypeId: Number(form.roomTypeId), unitNumber: form.unitNumber, floor: form.floor || null, view: form.view || null },
        withAdminAuth()
      );
      toast(`Room ${form.unitNumber} added.`);
      setForm((p) => ({ ...p, unitNumber: '' }));
      load();
    } catch (err) {
      // Stays beside the form: usually "Room 101 already exists".
      setError(errMsg(err, 'Could not add room'));
    }
  };

  const toggle = async (u) => {
    try {
      await api.put(`/admin/room-units/${u.id}`, { isActive: !u.is_active }, withAdminAuth());
      toast(`Room ${u.unit_number} ${u.is_active ? 'deactivated — it can no longer be booked' : 'reactivated'}.`);
      load();
    } catch (err) {
      toast(errMsg(err, 'Could not update room'), { tone: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[12rem] flex-[2]">
          <label className="label">Room type</label>
          <select aria-label="Room type" required className="input-field py-2" value={form.roomTypeId} onChange={(e) => setForm((p) => ({ ...p, roomTypeId: e.target.value }))}>
            <option value="">Select type…</option>
            {roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="w-28">
          <label className="label">Room no.</label>
          <input aria-label="Room no." required className="input-field py-2" value={form.unitNumber} placeholder="101" onChange={(e) => setForm((p) => ({ ...p, unitNumber: e.target.value }))} />
        </div>
        <div className="w-28">
          <label className="label">Floor</label>
          <input aria-label="Floor" className="input-field py-2" value={form.floor} onChange={(e) => setForm((p) => ({ ...p, floor: e.target.value }))} />
        </div>
        <div className="w-40">
          <label className="label">View (shown to guests)</label>
          <input aria-label="View (shown to guests)" className="input-field py-2" value={form.view} placeholder="Sea View" onChange={(e) => setForm((p) => ({ ...p, view: e.target.value }))} />
        </div>
        <button type="submit" className="btn-gold px-5 py-2 text-sm">Add Room</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {units.map((u) => (
          <div key={u.id} className={`rounded-xl border border-navy-700 bg-navy-900 p-3 ${u.is_active ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between">
              <p className="font-serif text-lg font-bold text-navy-50">{u.unit_number}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${JOB_STATUS_STYLE[u.status]}`}>{u.status}</span>
            </div>
            <p className="truncate text-xs text-navy-400" title={u.room_type}>{u.room_type}</p>
            {u.view_label && <p className="truncate text-xs text-navy-400">{u.view_label}</p>}
            <button onClick={() => toggle(u)} className="mt-2 text-xs text-navy-300 underline hover:text-gold-600">
              {u.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        ))}
      </div>
      {units.length === 0 && <p className="text-navy-400">No rooms yet. Add the first one above.</p>}
    </div>
  );
}
