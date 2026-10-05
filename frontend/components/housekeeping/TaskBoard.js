'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import useCleaningSocket, { LiveBadge, StaleNotice } from '@/lib/useCleaningSocket';
import { errMsg } from '@/lib/bookingUi';
import Chip from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import AssignRooms, { needsSomeone } from './AssignRooms';
import { CleaningTaskCard, InspectionCard } from './TaskCards';

/**
 * A housekeeper's or inspector's rooms for the day. `staff`: { name, role };
 * `onLogout` signs them out (also called when their login stops working).
 * An inspector also gets every room being cleaned, to say who works on it.
 */
export default function TaskBoard({ staff, onLogout }) {
  const isInspector = staff.role === 'Inspector';
  const [tasks, setTasks] = useState([]);
  // Inspectors only: every open cleaning job, and the team to pick from.
  const [jobs, setJobs] = useState([]);
  const [team, setTeam] = useState([]);
  const [view, setView] = useState('tasks'); // inspectors: 'tasks' | 'assign'
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState(null); // the task being saved
  const [error, setError] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [mine, all] = await Promise.all([api.get('/staff/tasks'), isInspector ? api.get('/staff/jobs') : null]);
      setTasks(mine.data.tasks);
      if (all) {
        setJobs(all.data.jobs);
        setTeam(all.data.team);
      }
      setLoaded(true);
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) onLogout();
      else setError('Could not load your tasks.');
    }
  }, [onLogout, isInspector]);

  useEffect(() => {
    load();
  }, [load]);
  const live = useCleaningSocket('staff', load);

  const act = async (task, action, body) => {
    setBusyId(task.id);
    setError('');
    try {
      await api.post(`/staff/tasks/${task.id}/${action}`, body || {});
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

  // Inspectors: rooms still being cleaned are folded away until asked for.
  const [showWaiting, setShowWaiting] = useState(false);
  // Inspectors: rooms ready to inspect first; each group keeps the server's priority order.
  const groups = isInspector
    ? [
        { title: 'Ready to inspect', list: tasks.filter((t) => t.job_status === 'Inspection') },
        { title: 'Being cleaned', list: tasks.filter((t) => t.job_status !== 'Inspection'), folded: true },
      ]
    : [{ title: 'My rooms', list: tasks }];
  const nothingToInspect = isInspector && tasks.length > 0 && groups[0].list.length === 0;
  const toAssign = jobs.filter(needsSomeone).length;
  const assigning = isInspector && view === 'assign';

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{isInspector ? 'Inspector' : `${staff.role} team`}</p>
          <h1 className="font-serif text-2xl font-bold text-ink-900">Hi, {(staff.name || '').split(' ')[0] || 'there'}</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <LiveBadge live={live} />
          <button onClick={onLogout} className="text-xs text-ink-500 underline">Log out</button>
        </div>
      </div>

      <StaleNotice live={live} onRefresh={load} />
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isInspector && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="What to show">
          <Chip tone="solid" pressed={!assigning} onClick={() => setView('tasks')}>
            To inspect ({groups[0].list.length})
          </Chip>
          <Chip tone="solid" pressed={assigning} onClick={() => setView('assign')}>
            Assign rooms{toAssign > 0 ? ` (${toAssign})` : ''}
          </Chip>
        </div>
      )}

      {assigning && loaded && <AssignRooms jobs={jobs} team={team} onChanged={load} />}

      {!assigning && loaded && tasks.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-lg text-ink-800">All clear <span aria-hidden="true">✨</span></p>
          <p className="mt-1 text-sm text-ink-400">No rooms assigned to you right now.</p>
        </div>
      )}

      {!assigning && nothingToInspect && (
        <p className="card mb-8 p-5 text-sm text-ink-700">Nothing to inspect yet. Rooms appear here as soon as cleaning finishes.</p>
      )}

      {groups.map(({ title, list, folded }) => {
        if (assigning || list.length === 0) return null;
        const open = !folded || showWaiting;
        return (
          <section key={title} className="mb-8">
            {isInspector && !folded && (
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
                {title} ({list.length})
              </h2>
            )}
            {folded && (
              <h2 className="mb-3">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setShowWaiting((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl border border-sand-300 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-ink-500"
                >
                  <span>{title} ({list.length})</span>
                  <span aria-hidden="true">{open ? 'Hide' : 'Show'}</span>
                </button>
              </h2>
            )}
            {open && (
              <div className="space-y-4">
                {list.map((task) =>
                  isInspector ? (
                    <InspectionCard key={task.id} task={task} onAction={act} busy={busyId === task.id} />
                  ) : (
                    <CleaningTaskCard key={task.id} task={task} onAction={act} busy={busyId === task.id} />
                  )
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
