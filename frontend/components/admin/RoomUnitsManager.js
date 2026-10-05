'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';
import { useToast } from '@/components/ui/Toast';
import useModal from '../../lib/useModal';
import { errMsg } from '../../lib/bookingUi';
import { JOB_STATUS_STYLE } from '../../lib/cleaningStyles';

// Correcting one room: its number, floor, view or type. A small dialog.
function EditUnit({ unit, roomTypes, onClose, onSaved }) {
  const toast = useToast();
  const ref = useModal(true, onClose);
  const [form, setForm] = useState({
    roomTypeId: String(unit.room_type_id || ''),
    unitNumber: unit.unit_number,
    floor: unit.floor || '',
    view: unit.view_label || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put(
        `/admin/room-units/${unit.id}`,
        { roomTypeId: Number(form.roomTypeId), unitNumber: form.unitNumber, floor: form.floor || null, view: form.view || null }
      );
      toast(`Room ${form.unitNumber} saved.`);
      onSaved();
    } catch (err) {
      // Usually "That room number is already in use".
      setError(errMsg(err, 'Could not save the room'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <form
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-unit-title"
        tabIndex={-1}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-2xl border border-sand-300 bg-sand-50 p-6 shadow-2xl focus:outline-none"
      >
        <h2 id="edit-unit-title" className="font-serif text-xl font-semibold text-ink-900">Edit room {unit.unit_number}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="edit-unit-number">Room no.</label>
            <input id="edit-unit-number" data-autofocus required maxLength={20} className="input-field py-2" value={form.unitNumber} onChange={set('unitNumber')} />
          </div>
          <div>
            <label className="label" htmlFor="edit-unit-floor">Floor</label>
            <input id="edit-unit-floor" maxLength={20} className="input-field py-2" value={form.floor} onChange={set('floor')} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="edit-unit-view">View (shown to guests)</label>
          <input id="edit-unit-view" maxLength={60} className="input-field py-2" placeholder="Sea View" value={form.view} onChange={set('view')} />
        </div>
        <div>
          <label className="label" htmlFor="edit-unit-type">Room type</label>
          <select id="edit-unit-type" required className="input-field py-2" value={form.roomTypeId} onChange={set('roomTypeId')}>
            {roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-ink-400">Bookings already made for this room keep the price they were given.</p>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-outline px-5 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">{saving ? 'Saving…' : 'Save room'}</button>
        </div>
      </form>
    </div>
  );
}

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
  const [editing, setEditing] = useState(null); // the room being corrected

  const load = useCallback(() => {
    api
      .get('/admin/room-units')
      .then((res) => setUnits(res.data.units))
      .catch((err) => toast(errMsg(err, 'Could not load rooms'), { tone: 'error' }));
  }, [toast]);

  useEffect(() => {
    load();
    api
      .get('/admin/rooms')
      .then((res) => setRoomTypes(res.data.rooms))
      .catch((err) => toast(errMsg(err, 'Could not load room types'), { tone: 'error' }));
  }, [load, toast]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(
        '/admin/room-units',
        { roomTypeId: Number(form.roomTypeId), unitNumber: form.unitNumber, floor: form.floor || null, view: form.view || null }
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
      await api.put(`/admin/room-units/${u.id}`, { isActive: !u.is_active });
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
        <button type="submit" className="btn-primary px-5 py-2 text-sm">Add Room</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {units.map((u) => (
          <div key={u.id} className={`rounded-xl border border-sand-300 bg-sand-100 p-3 ${u.is_active ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between">
              <p className="font-serif text-lg font-bold text-ink-900">{u.unit_number}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${JOB_STATUS_STYLE[u.status]}`}>{u.status}</span>
            </div>
            <p className="truncate text-xs text-ink-400" title={u.room_type}>{u.room_type}</p>
            {u.view_label && <p className="truncate text-xs text-ink-400">{u.view_label}</p>}
            <div className="mt-2 flex gap-3 text-xs">
              <button onClick={() => setEditing(u)} className="text-ocean-600 underline" aria-label={`Edit room ${u.unit_number}`}>Edit</button>
              <button onClick={() => toggle(u)} className="text-ink-500 underline hover:text-gold-600">
                {u.is_active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {units.length === 0 && <p className="text-ink-400">No rooms yet. Add the first one above.</p>}

      {editing && (
        <EditUnit
          key={editing.id}
          unit={editing}
          roomTypes={roomTypes}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
