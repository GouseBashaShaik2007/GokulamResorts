'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';
import { errMsg, inr } from '../../lib/bookingUi';
import { useToast } from '@/components/ui/Toast';
import RoomFormPanel from './rooms/RoomFormPanel';
import DeleteRoomDialog from './rooms/DeleteRoomDialog';

/**
 * Admin → Rooms → Room types: the list, with a slide-over to add or edit one.
 * A removed room type stays in the list (marked "not on the site") so it can
 * be put back; its past bookings are never touched.
 */
export default function RoomsManager() {
  const toast = useToast();
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [deletingRoom, setDeletingRoom] = useState(null);

  const loadRooms = useCallback(async () => {
    try {
      const res = await api.get('/admin/rooms');
      setRooms(res.data.rooms);
      setError('');
    } catch (err) {
      setError(errMsg(err, 'Failed to load rooms'));
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const openAdd = () => {
    setEditingRoom(null);
    setPanelOpen(true);
  };
  const openEdit = (room) => {
    setEditingRoom(room);
    setPanelOpen(true);
  };

  const restore = async (room) => {
    try {
      await api.put(`/admin/rooms/${room.id}`, { isActive: true });
      toast(`${room.name} is back on the site.`);
      loadRooms();
    } catch (err) {
      toast(errMsg(err, `Could not restore ${room.name}`), { tone: 'error' });
    }
  };

  const small = 'rounded-lg border px-3 py-1.5 text-xs';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-400">{rooms.length} room type{rooms.length === 1 ? '' : 's'}</p>
        <button onClick={openAdd} className="btn-primary px-4 py-2 text-sm">+ Add room</button>
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}

      <div className="space-y-3">
        {rooms.map((room) => (
          <div key={room.id} className={`flex flex-wrap items-center gap-4 rounded-xl border border-sand-300 bg-sand-100 p-4 ${room.is_active ? '' : 'opacity-70'}`}>
            {room.images?.[0] ? (
              <img src={room.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-sand-400 text-[10px] text-ink-400">
                No photo
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink-900">
                {room.name} {!room.is_active && <span className="ml-2 text-xs text-red-700">(not on the site)</span>}
              </p>
              <p className="text-sm text-ink-400">
                {inr(room.price_per_night)} / night · {room.units_count} room{room.units_count === 1 ? '' : 's'} · Up to {room.capacity} guests
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(room)} className={`${small} border-gold-500/50 text-gold-600 hover:bg-gold-500/10`}>
                Edit<span className="sr-only"> {room.name}</span>
              </button>
              {room.is_active ? (
                <button onClick={() => setDeletingRoom(room)} className={`${small} border-red-500/50 text-red-700 hover:bg-red-500/10`}>
                  Remove<span className="sr-only"> {room.name}</span>
                </button>
              ) : (
                <button onClick={() => restore(room)} className={`${small} border-green-500/50 text-green-700 hover:bg-green-500/10`}>
                  Restore<span className="sr-only"> {room.name}</span>
                </button>
              )}
            </div>
          </div>
        ))}
        {rooms.length === 0 && <p className="text-ink-400">No rooms yet — add your first one.</p>}
      </div>

      <RoomFormPanel open={panelOpen} onClose={() => setPanelOpen(false)} editingRoom={editingRoom} onSaved={loadRooms} />

      {deletingRoom && <DeleteRoomDialog room={deletingRoom} onClose={() => setDeletingRoom(null)} onDeleted={loadRooms} />}
    </div>
  );
}
