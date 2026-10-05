'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import useCleaningSocket, { LiveBadge, StaleNotice } from '../../../lib/useCleaningSocket';
import Chip from '../../ui/Chip';
import { errMsg } from '../../../lib/bookingUi';
import JobCard from './JobCard';
import RoomStatusBoard from './RoomStatusBoard';
import { PRIORITIES, TASK_ROLES } from '../../housekeeping/shared';

function MarkDirtyForm({ units, openUnitIds, onCreated, onError }) {
  const [form, setForm] = useState({ roomUnitId: '', priority: 'Normal', notes: '' });
  const available = units.filter((u) => u.is_active && !openUnitIds.has(u.id));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(
        '/admin/cleaning/jobs',
        { roomUnitId: Number(form.roomUnitId), priority: form.priority, notes: form.notes || null }
      );
      onCreated(units.find((u) => u.id === Number(form.roomUnitId)));
      setForm({ roomUnitId: '', priority: 'Normal', notes: '' });
    } catch (err) {
      onError(errMsg(err, 'Could not mark room dirty'));
    }
  };

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-[8rem] flex-1">
        <label className="label">Mark room dirty</label>
        <select aria-label="Mark room dirty" required className="input-field py-2" value={form.roomUnitId} onChange={(e) => setForm((p) => ({ ...p, roomUnitId: e.target.value }))}>
          <option value="">Select room…</option>
          {available.map((u) => <option key={u.id} value={u.id}>{u.unit_number} — {u.room_type}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Priority</label>
        <select aria-label="Priority" className="input-field py-2" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className="min-w-[10rem] flex-[2]">
        <label className="label">Note (optional)</label>
        <input aria-label="Note (optional)" className="input-field py-2" value={form.notes} placeholder="e.g. VIP arriving 2 PM" onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
      </div>
      <button type="submit" className="btn-primary px-5 py-2 text-sm">Mark Dirty</button>
    </form>
  );
}

// After a busy checkout morning: give every task that has nobody on it to one
// person per role, in one go, instead of three dropdowns on every card.
function AssignAll({ jobs, staff, onDone, onError }) {
  const [picks, setPicks] = useState({}); // role type -> staff id
  const [busy, setBusy] = useState(false);

  // Tasks still waiting for someone, by type.
  const waiting = (type) => jobs.filter((j) => j.status !== 'Ready' && j.tasks?.[type] && !j.tasks[type].assigned_staff_id && j.tasks[type].status !== 'Completed');
  const total = TASK_ROLES.reduce((n, r) => n + waiting(r.type).length, 0);
  if (total === 0) return null;

  const chosen = TASK_ROLES.filter((r) => picks[r.type] && waiting(r.type).length > 0);

  const assign = async () => {
    setBusy(true);
    let done = 0;
    try {
      const jobIds = new Set(chosen.flatMap((r) => waiting(r.type).map((j) => j.id)));
      for (const id of jobIds) {
        const job = jobs.find((j) => j.id === id);
        const body = Object.fromEntries(chosen.filter((r) => waiting(r.type).includes(job)).map((r) => [r.field, Number(picks[r.type])]));
        // eslint-disable-next-line no-await-in-loop -- one room at a time keeps the board's live updates in order
        await api.put(`/admin/cleaning/jobs/${id}/assign`, body);
        done += 1;
      }
      onDone(`${done} room${done === 1 ? '' : 's'} assigned.`);
      setPicks({});
    } catch (err) {
      onError(`${errMsg(err, 'Could not assign every room')} (${done} done before it stopped).`);
      onDone('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex flex-wrap items-end gap-3 p-4">
      <p className="w-full text-sm font-medium text-ink-800">Assign everything that has nobody on it ({total} task{total === 1 ? '' : 's'})</p>
      {TASK_ROLES.map((r) => {
        const n = waiting(r.type).length;
        const people = staff.filter((s) => s.role === r.role && s.is_active);
        return (
          <div key={r.type} className="min-w-[9rem] flex-1">
            <label className="label" htmlFor={`assign-all-${r.type}`}>{r.type} ({n})</label>
            <select
              id={`assign-all-${r.type}`}
              className="input-field py-2"
              disabled={n === 0 || people.length === 0}
              value={picks[r.type] || ''}
              onChange={(e) => setPicks((p) => ({ ...p, [r.type]: e.target.value }))}
            >
              <option value="">{people.length === 0 ? 'No one with this role' : 'Leave as they are'}</option>
              {people.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        );
      })}
      <button type="button" disabled={busy || chosen.length === 0} onClick={assign} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
        {busy ? 'Assigning…' : 'Assign'}
      </button>
    </div>
  );
}

// The pills above the cards. A stayover (the guest is staying) is kept apart
// from the full cleans: its room is occupied, so it is never "Dirty" or
// "Ready" the way a room waiting for its next guest is.
const isStayover = (job) => job.reason === 'stayover';
const FILTERS = {
  open: (job) => job.status !== 'Ready',
  all: () => true,
  stayover: isStayover,
};
const matches = (filter) => FILTERS[filter] || ((job) => !isStayover(job) && job.status === filter);

/**
 * The day's cleaning jobs: rooms at a glance, mark a room dirty, and one card
 * per job to set its priority and assign its tasks. Updates live.
 * Full cleans (a guest left, or a room marked dirty) and stayovers (the guest
 * is staying) are both here; "Stayovers" shows the day's, open and finished.
 * `staff` and `units`: everyone who can be assigned, and every physical room.
 */
export default function CleaningBoard({ staff, units, reloadUnits }) {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('open');
  const [nightlyMenuOpen, setNightlyMenuOpen] = useState(false);
  const ask = useConfirm();
  const toast = useToast();
  const fail = useCallback((message) => toast(message, { tone: 'error', duration: 7000 }), [toast]);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/cleaning/jobs');
      setJobs(res.data.jobs);
      reloadUnits?.(); // room tiles follow the jobs
    } catch (err) {
      fail(errMsg(err, 'Failed to load cleaning jobs'));
    }
  }, [fail, reloadUnits]);

  useEffect(() => {
    load();
  }, [load]);
  const live = useCleaningSocket('admin', load);

  const runNightly = async () => {
    setNightlyMenuOpen(false);
    const ok = await ask({
      title: 'Create missing cleaning jobs now?',
      body: 'Every checkout that has no cleaning job gets one. New jobs appear on the housekeepers’ screens straight away.',
      confirmLabel: 'Create jobs',
    });
    if (!ok) return;
    try {
      const res = await api.post('/admin/cleaning/run-nightly', {});
      toast(res.data.created ? `${res.data.created} cleaning job${res.data.created === 1 ? '' : 's'} created.` : 'Nothing was missing — every checkout already has a cleaning job.');
      load();
    } catch (err) {
      fail(errMsg(err, 'Could not create the cleaning jobs'));
    }
  };

  // Rooms that cannot be marked dirty again: a full clean is already open.
  // (Marking an occupied room dirty replaces its stayover, so that is allowed.)
  const openUnitIds = new Set(jobs.filter((j) => j.status !== 'Ready' && !isStayover(j)).map((j) => j.room_unit_id));
  const counts = ['Dirty', 'Cleaning', 'Inspection', 'Ready'].map((s) => [s, jobs.filter(matches(s)).length]);
  const stayovers = jobs.filter(isStayover); // today's: still to do, and finished
  const shown = jobs.filter(matches(filter));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip tone="solid" size="xs" pressed={filter === 'open'} onClick={() => setFilter('open')}>
            Open ({jobs.filter((j) => j.status !== 'Ready').length})
          </Chip>
          {counts.map(([s, n]) => (
            <Chip key={s} tone="solid" size="xs" pressed={filter === s} onClick={() => setFilter(s)}>
              {s === 'Ready' ? 'Ready today' : s} ({n})
            </Chip>
          ))}
          <Chip tone="solid" size="xs" pressed={filter === 'stayover'} onClick={() => setFilter('stayover')}>
            Stayovers ({stayovers.length})
          </Chip>
        </div>
        <div className="flex items-center gap-3">
          <LiveBadge live={live} />
          <div className="relative">
            <button
              onClick={() => setNightlyMenuOpen((v) => !v)}
              className="rounded-lg border border-sand-300 px-2.5 py-1.5 text-sm text-ink-500 hover:bg-sand-200"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={nightlyMenuOpen}
            >
              ⋯
            </button>
            {nightlyMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setNightlyMenuOpen(false)} />
                <div role="menu" className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-sand-300 bg-sand-100 py-1 shadow-lg">
                  <button
                    role="menuitem"
                    onClick={runNightly}
                    className="block w-full px-4 py-2 text-left text-sm text-ink-700 hover:bg-sand-200"
                  >
                    Create missing cleaning jobs…
                    <span className="mt-0.5 block text-xs text-ink-400">Done automatically at 11 PM; never makes duplicates.</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <StaleNotice live={live} onRefresh={load} />

      <RoomStatusBoard units={units} filter={filter} onFilterStatus={setFilter} />

      <MarkDirtyForm
        units={units}
        openUnitIds={openUnitIds}
        onError={fail}
        onCreated={(unit) => {
          toast(`Room ${unit?.unit_number || ''} marked dirty — assign it below.`);
          load();
        }}
      />

      <AssignAll
        jobs={jobs}
        staff={staff}
        onError={fail}
        onDone={(message) => {
          if (message) toast(message);
          load();
        }}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((job) => (
          <JobCard key={job.id} job={job} staff={staff} onChanged={load} onError={fail} />
        ))}
      </div>
      {shown.length === 0 && <p className="text-ink-400">No cleaning jobs here.</p>}
    </div>
  );
}
