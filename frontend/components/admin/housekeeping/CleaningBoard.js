'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { TOKEN_KEYS, withAdminAuth } from '../../../lib/api';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import useCleaningSocket, { LiveBadge } from '../../../lib/useCleaningSocket';
import { errMsg } from '../../../lib/bookingUi';
import JobCard from './JobCard';
import RoomStatusBoard from './RoomStatusBoard';
import { PRIORITIES } from './shared';

function MarkDirtyForm({ units, openUnitIds, onCreated, onError }) {
  const [form, setForm] = useState({ roomUnitId: '', priority: 'Normal', notes: '' });
  const available = units.filter((u) => u.is_active && !openUnitIds.has(u.id));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(
        '/admin/cleaning/jobs',
        { roomUnitId: Number(form.roomUnitId), priority: form.priority, notes: form.notes || null },
        withAdminAuth()
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
      <button type="submit" className="btn-gold px-5 py-2 text-sm">Mark Dirty</button>
    </form>
  );
}

/**
 * The day's cleaning jobs: rooms at a glance, mark a room dirty, and one card
 * per job to set its priority and assign its tasks. Updates live.
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
      const res = await api.get('/admin/cleaning/jobs', withAdminAuth());
      setJobs(res.data.jobs);
      reloadUnits?.(); // room tiles follow the jobs
    } catch (err) {
      fail(errMsg(err, 'Failed to load cleaning jobs'));
    }
  }, [fail, reloadUnits]);

  useEffect(() => {
    load();
  }, [load]);
  const live = useCleaningSocket(TOKEN_KEYS.admin, load);

  const runNightly = async () => {
    setNightlyMenuOpen(false);
    const ok = await ask({
      title: 'Create missing cleaning jobs now?',
      body: 'This is the run that happens automatically at 11 PM: every checkout without a cleaning job gets one. It never creates duplicates, but new jobs appear on every housekeeper’s screen straight away.',
      confirmLabel: 'Run now',
    });
    if (!ok) return;
    try {
      const res = await api.post('/admin/cleaning/run-nightly', {}, withAdminAuth());
      toast(`Nightly run for ${res.data.date}: ${res.data.created} new job(s).`);
      load();
    } catch (err) {
      fail(errMsg(err, 'Nightly run failed'));
    }
  };

  const openUnitIds = new Set(jobs.filter((j) => j.status !== 'Ready').map((j) => j.room_unit_id));
  const counts = ['Dirty', 'Cleaning', 'Inspection', 'Ready'].map((s) => [s, jobs.filter((j) => j.status === s).length]);
  const shown = jobs.filter((j) => (filter === 'open' ? j.status !== 'Ready' : filter === 'all' ? true : j.status === filter));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter('open')} aria-pressed={filter === 'open'} className={`rounded-full px-3 py-1 text-xs ${filter === 'open' ? 'bg-ocean-500 text-white' : 'bg-navy-800 text-navy-200'}`}>
            Open ({jobs.filter((j) => j.status !== 'Ready').length})
          </button>
          {counts.map(([s, n]) => (
            <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s} className={`rounded-full px-3 py-1 text-xs ${filter === s ? 'bg-ocean-500 text-white' : 'bg-navy-800 text-navy-200'}`}>
              {s === 'Ready' ? 'Ready today' : s} ({n})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <LiveBadge live={live} />
          <div className="relative">
            <button
              onClick={() => setNightlyMenuOpen((v) => !v)}
              className="rounded-lg border border-navy-700 px-2.5 py-1.5 text-sm text-navy-300 hover:bg-navy-800"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={nightlyMenuOpen}
            >
              ⋯
            </button>
            {nightlyMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setNightlyMenuOpen(false)} />
                <div role="menu" className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-navy-700 bg-navy-900 py-1 shadow-lg">
                  <button
                    role="menuitem"
                    onClick={runNightly}
                    className="block w-full px-4 py-2 text-left text-sm text-navy-200 hover:bg-navy-800"
                    title="Same as the automatic 11 PM run. Never creates duplicates."
                  >
                    Run nightly now…
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((job) => (
          <JobCard key={job.id} job={job} staff={staff} onChanged={load} onError={fail} />
        ))}
      </div>
      {shown.length === 0 && <p className="text-navy-400">No cleaning jobs here.</p>}
    </div>
  );
}
