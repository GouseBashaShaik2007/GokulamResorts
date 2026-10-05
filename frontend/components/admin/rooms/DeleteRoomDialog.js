'use client';

import { useState } from 'react';
import api from '../../../lib/api';
import useModal from '../../../lib/useModal';
import { errMsg } from '../../../lib/bookingUi';
import { useToast } from '@/components/ui/Toast';

/** Removing a room type from the site: the manager types its name to confirm. */
export default function DeleteRoomDialog({ room, onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const matches = confirmText.trim() === room.name;
  const dialogRef = useModal(true, onClose);
  const toast = useToast();

  const submit = async () => {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/admin/rooms/${room.id}`);
      onDeleted();
      onClose();
      toast(`${room.name} removed from the site`);
    } catch (err) {
      setError(errMsg(err, 'Could not delete room'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-label={`Remove ${room.name}`} tabIndex={-1} className="w-full max-w-md rounded-2xl border border-red-500/30 bg-sand-50 p-6 focus:outline-none">
        <h2 className="font-serif text-lg font-bold text-ink-900">Remove &quot;{room.name}&quot;?</h2>
        <p className="mt-2 text-sm text-ink-500">
          This removes it from public listings. Past bookings for this room type are kept. Type the room name to
          confirm.
        </p>
        <input
          autoFocus
          className="input-field mt-3"
          placeholder={room.name}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button
            onClick={submit}
            disabled={!matches || deleting}
            className="flex-1 rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            
          >
            {deleting ? 'Removing…' : 'Remove Room'}
          </button>
          <button onClick={onClose} className="btn-outline">Cancel</button>
        </div>
      </div>
    </div>
  );
}
