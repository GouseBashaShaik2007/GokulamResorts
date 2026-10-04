'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { TOKEN_KEYS, withStaffAuth } from '@/lib/api';
import useCleaningSocket, { LiveBadge, StaleNotice } from '@/lib/useCleaningSocket';
import { errMsg } from '@/lib/bookingUi';
import { useToast } from '@/components/ui/Toast';
import { CleaningTaskCard, InspectionCard } from './TaskCards';

/**
 * A housekeeper's or inspector's rooms for the day. `staff`: { name, role };
 * `onLogout` signs them out (also called when their login stops working).
 */
export default function TaskBoard({ staff, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState(null); // the task being saved
  const [error, setError] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const res = await api.get('/staff/tasks', withStaffAuth());
      setTasks(res.data.tasks);
      setLoaded(true);
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) onLogout();
      else setError('Could not load your tasks.');
    }
  }, [onLogout]);

  useEffect(() => {
    load();
  }, [load]);
  const live = useCleaningSocket(TOKEN_KEYS.staff, load);

  const act = async (task, action, body) => {
    setBusyId(task.id);
    setError('');
    try {
      await api.post(`/staff/tasks/${task.id}/${action}`, body || {}, withStaffAuth());
      await load();
      return true;
    } catch (err) {
      // Shown over whatever card they are on — the top of the list may be scrolled away.
      toast(errMsg(err, 'That did not save. Please try again.'), { tone: 'error', duration: 6000 });
      load();
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const isInspector = staff.role === 'Inspector';
  // Inspectors: rooms ready to inspect first; each group keeps the server's priority order.
  const groups = isInspector
    ? [
        ['Ready to inspect', tasks.filter((t) => t.job_status === 'Inspection')],
        ['Being cleaned', tasks.filter((t) => t.job_status !== 'Inspection')],
      ]
    : [['My rooms', tasks]];

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{staff.role === 'Inspector' ? 'Inspector' : `${staff.role} team`}</p>
          <h1 className="font-serif text-2xl font-bold text-navy-50">Hi, {(staff.name || '').split(' ')[0] || 'there'}</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <LiveBadge live={live} />
          <button onClick={onLogout} className="text-xs text-navy-300 underline">Log out</button>
        </div>
      </div>

      <StaleNotice live={live} onRefresh={load} />
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loaded && tasks.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-lg text-navy-100">All clear ✨</p>
          <p className="mt-1 text-sm text-navy-400">No rooms assigned to you right now.</p>
        </div>
      )}

      {groups.map(([title, list]) =>
        list.length === 0 ? null : (
          <section key={title} className="mb-8">
            {isInspector && (
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-navy-300">
                {title} ({list.length})
              </h2>
            )}
            <div className="space-y-4">
              {list.map((task) =>
                isInspector ? (
                  <InspectionCard key={task.id} task={task} onAction={act} busy={busyId === task.id} />
                ) : (
                  <CleaningTaskCard key={task.id} task={task} onAction={act} busy={busyId === task.id} />
                )
              )}
            </div>
          </section>
        )
      )}
    </div>
  );
}
