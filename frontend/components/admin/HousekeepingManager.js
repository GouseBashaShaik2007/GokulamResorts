'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../lib/api';
import { errMsg } from '../../lib/bookingUi';
import CleaningBoard from './housekeeping/CleaningBoard';
import RoomIssues from './housekeeping/RoomIssues';

/**
 * Admin → Housekeeping: the cleaning board. It needs the staff list (who can
 * be assigned) and the room list (the tiles); both are managed on their own
 * pages — Staff, and Rooms → Room numbers.
 */
export default function HousekeepingManager() {
  const [staff, setStaff] = useState([]);
  const [units, setUnits] = useState([]);
  const [loadError, setLoadError] = useState('');

  const loadUnits = useCallback(() => {
    api.get('/admin/room-units').then((res) => setUnits(res.data.units)).catch((err) => setLoadError(errMsg(err, 'Could not load rooms')));
  }, []);

  useEffect(() => {
    api.get('/admin/staff').then((res) => setStaff(res.data.staff)).catch((err) => setLoadError(errMsg(err, 'Could not load staff')));
  }, []);

  return (
    <div>
      {loadError && <p role="alert" className="mb-4 text-sm text-red-700">{loadError}. Reload the page to try again.</p>}
      <div className="mb-6">
        <RoomIssues />
      </div>
      <CleaningBoard staff={staff} units={units} reloadUnits={loadUnits} />
      <p className="mt-8 text-sm text-ink-400">
        Looking for the team or the room list? They have their own pages now:{' '}
        <Link href="/admin/staff" className="font-semibold text-ocean-600 underline">Staff</Link> and{' '}
        <Link href="/admin/rooms?tab=numbers" className="font-semibold text-ocean-600 underline">Rooms → Room numbers</Link>.
      </p>
    </div>
  );
}
