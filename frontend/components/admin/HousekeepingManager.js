'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';
import useCleaningSocket from '../../lib/useCleaningSocket';
import { JOB_STATUS_STYLE, PRIORITY_STYLE, TASK_STATUS_STYLE } from '../../lib/cleaningStyles';

const PRIORITIES = ['VIP', 'High', 'Normal'];
const TASK_ROLES = [
  { type: 'Bedding', role: 'Bedding', field: 'beddingStaffId' },
  { type: 'Toiletry', role: 'Toiletry', field: 'toiletryStaffId' },
  { type: 'Inspection', role: 'Inspector', field: 'inspectorId' },
];

const errMsg = (err, fallback) => err?.response?.data?.message || fallback;
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

function Badge({ className, children }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

function SubTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm ${active ? 'bg-navy-700 text-gold-400' : 'text-navy-300 hover:text-navy-100'}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Cleaning board
// ---------------------------------------------------------------------------

function JobCard({ job, staff, onChanged, onError }) {
  const [busy, setBusy] = useState(false);
  const finished = job.status === 'Ready';

  const assign = async (field, value) => {
    setBusy(true);
    try {
      await api.put(`/admin/cleaning/jobs/${job.id}/assign`, { [field]: value ? Number(value) : null }, withAdminAuth());
      onChanged();
    } catch (err) {
      onError(errMsg(err, 'Could not assign staff'));
    } finally {
      setBusy(false);
    }
  };

  const setPriority = async (priority) => {
    try {
      await api.patch(`/admin/cleaning/jobs/${job.id}/priority`, { priority }, withAdminAuth());
      onChanged();
    } catch (err) {
      onError(errMsg(err, 'Could not change priority'));
    }
  };

  const rejection = job.last_inspection?.result === 'rejected' && job.status === 'Cleaning' ? job.last_inspection : null;

  return (
    <div className={`card p-5 ${finished ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-serif text-xl font-bold text-navy-50">Room {job.unit_number}</p>
          <p className="text-xs text-navy-400">
            {job.room_type} · {job.reason === 'manual' ? 'Marked dirty' : job.source === 'nightly' ? 'Checkout (11 PM safety net)' : 'Checkout'} ·{' '}
            {String(job.job_date).slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {finished ? (
            <Badge className={PRIORITY_STYLE[job.priority]}>{job.priority}</Badge>
          ) : (
            <select
              value={job.priority}
              onChange={(e) => setPriority(e.target.value)}
              className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[job.priority]}`}
              aria-label="Priority"
            >
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          <Badge className={JOB_STATUS_STYLE[job.status]}>{job.status}</Badge>
        </div>
      </div>

      {job.notes && <p className="mt-2 text-xs italic text-navy-300">Note: {job.notes}</p>}
      {rejection && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
          Rejected ({rejection.failed_tasks.join(' + ')}): {rejection.failure_reason}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {TASK_ROLES.map(({ type, role, field }) => {
          const task = job.tasks?.[type];
          if (!task) return null;
          const options = staff.filter((s) => s.role === role && (s.is_active || s.id === task.assigned_staff_id));
          return (
            <div key={type} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-sm">
              <span className="text-navy-300">{type}</span>
              <select
                className="input-field py-1.5 text-sm"
                value={task.assigned_staff_id || ''}
                disabled={busy || finished || task.status === 'Completed'}
                onChange={(e) => assign(field, e.target.value)}
              >
                <option value="">— Unassigned —</option>
                {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <span className="flex flex-col items-end gap-0.5">
                <Badge className={TASK_STATUS_STYLE[task.status]}>{task.status}</Badge>
                {(task.start_time || task.end_time) && (
                  <span className="text-[10px] text-navy-400">
                    {fmtTime(task.start_time)} → {fmtTime(task.end_time)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
      setForm({ roomUnitId: '', priority: 'Normal', notes: '' });
      onCreated();
    } catch (err) {
      onError(errMsg(err, 'Could not mark room dirty'));
    }
  };

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-[8rem] flex-1">
        <label className="label">Mark room dirty</label>
        <select required className="input-field py-2" value={form.roomUnitId} onChange={(e) => setForm((p) => ({ ...p, roomUnitId: e.target.value }))}>
          <option value="">Select room…</option>
          {available.map((u) => <option key={u.id} value={u.id}>{u.unit_number} — {u.room_type}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Priority</label>
        <select className="input-field py-2" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className="min-w-[10rem] flex-[2]">
        <label className="label">Note (optional)</label>
        <input className="input-field py-2" value={form.notes} placeholder="e.g. VIP arriving 2 PM" onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
      </div>
      <button type="submit" className="btn-gold px-5 py-2 text-sm">Mark Dirty</button>
    </form>
  );
}

function CleaningBoard({ staff, units }) {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('open');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/cleaning/jobs', withAdminAuth());
      setJobs(res.data.jobs);
    } catch (err) {
      setError(errMsg(err, 'Failed to load cleaning jobs'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  const live = useCleaningSocket('gokulam_admin_token', load);

  const runNightly = async () => {
    setMessage('');
    try {
      const res = await api.post('/admin/cleaning/run-nightly', {}, withAdminAuth());
      setMessage(`Nightly run for ${res.data.date}: ${res.data.created} new job(s).`);
      load();
    } catch (err) {
      setError(errMsg(err, 'Nightly run failed'));
    }
  };

  const openUnitIds = new Set(jobs.filter((j) => j.status !== 'Ready').map((j) => j.room_unit_id));
  const counts = ['Dirty', 'Cleaning', 'Inspection', 'Ready'].map((s) => [s, jobs.filter((j) => j.status === s).length]);
  const shown = jobs.filter((j) => (filter === 'open' ? j.status !== 'Ready' : filter === 'all' ? true : j.status === filter));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter('open')} className={`rounded-full px-3 py-1 text-xs ${filter === 'open' ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-navy-200'}`}>
            Open ({jobs.filter((j) => j.status !== 'Ready').length})
          </button>
          {counts.map(([s, n]) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs ${filter === s ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-navy-200'}`}>
              {s === 'Ready' ? 'Ready today' : s} ({n})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs ${live ? 'text-green-300' : 'text-navy-400'}`}>
            <span className={`h-2 w-2 rounded-full ${live ? 'bg-green-400' : 'bg-navy-500'}`} />
            {live ? 'Live' : 'Offline'}
          </span>
          <button onClick={runNightly} className="btn-outline px-4 py-1.5 text-xs" title="Same as the automatic 11 PM run. Never creates duplicates.">
            Run nightly now
          </button>
        </div>
      </div>

      <MarkDirtyForm units={units} openUnitIds={openUnitIds} onCreated={load} onError={setError} />

      {message && <p className="text-sm text-green-300">{message}</p>}
      {error && (
        <p className="text-sm text-red-300">
          {error} <button className="ml-2 underline" onClick={() => setError('')}>dismiss</button>
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((job) => (
          <JobCard key={job.id} job={job} staff={staff} onChanged={load} onError={setError} />
        ))}
      </div>
      {shown.length === 0 && <p className="text-navy-400">No cleaning jobs here.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

function StaffPanel({ staff, reload }) {
  const empty = { name: '', phone: '', role: 'Bedding', password: '' };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.post('/admin/staff', form, withAdminAuth());
      setMessage(`${form.name} added. They sign in at ${form.role === 'FrontDesk' ? '/frontdesk' : '/staff'} with ${form.phone}.`);
      setForm(empty);
      reload();
    } catch (err) {
      setError(errMsg(err, 'Could not add staff'));
    }
  };

  const update = async (s, body) => {
    setError('');
    try {
      await api.put(`/admin/staff/${s.id}`, body, withAdminAuth());
      reload();
    } catch (err) {
      setError(errMsg(err, 'Could not update staff'));
    }
  };

  const resetPassword = (s) => {
    const password = prompt(`New password for ${s.name} (min 6 characters):`);
    if (password) update(s, { password }).then(() => setMessage(`Password reset for ${s.name}.`));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
      <form onSubmit={submit} className="card space-y-4 p-6">
        <h2 className="font-serif text-xl font-bold text-navy-50">Add Staff</h2>
        <div>
          <label className="label">Name</label>
          <input required className="input-field" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Phone (login)</label>
          <input required inputMode="tel" className="input-field" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input-field" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
            <option value="FrontDesk">Front desk</option>
            <option>Bedding</option>
            <option>Toiletry</option>
            <option>Inspector</option>
          </select>
        </div>
        <div>
          <label className="label">Password</label>
          <input required minLength={6} type="text" className="input-field" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
        </div>
        {message && <p className="text-sm text-green-300">{message}</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button type="submit" className="btn-gold w-full">Add Staff</button>
      </form>

      <div className="card p-6">
        <h2 className="font-serif text-xl font-bold text-navy-50">Housekeeping Team</h2>
        {['FrontDesk', 'Bedding', 'Toiletry', 'Inspector'].map((role) => (
          <div key={role} className="mt-5">
            <p className="eyebrow text-xs">{role === 'FrontDesk' ? 'Front desk' : role}</p>
            <div className="mt-2 space-y-2">
              {staff.filter((s) => s.role === role).map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-navy-700 bg-navy-800 px-4 py-2.5">
                  <div>
                    <p className={`font-medium ${s.is_active ? 'text-navy-50' : 'text-navy-400 line-through'}`}>{s.name}</p>
                    <p className="text-xs text-navy-400">{s.phone}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => resetPassword(s)} className="rounded-lg border border-navy-600 px-3 py-1 text-xs text-navy-200 hover:bg-navy-700">
                      Reset password
                    </button>
                    <button
                      onClick={() => update(s, { isActive: !s.is_active })}
                      className={`rounded-lg border px-3 py-1 text-xs ${s.is_active ? 'border-red-500/50 text-red-300 hover:bg-red-500/10' : 'border-green-500/50 text-green-300 hover:bg-green-500/10'}`}
                    >
                      {s.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </div>
              ))}
              {staff.filter((s) => s.role === role).length === 0 && <p className="text-sm text-navy-500">None yet.</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Physical rooms
// ---------------------------------------------------------------------------

function RoomUnitsPanel({ units, reload }) {
  const [roomTypes, setRoomTypes] = useState([]);
  const [form, setForm] = useState({ roomTypeId: '', unitNumber: '', floor: '', view: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/rooms', withAdminAuth()).then((res) => setRoomTypes(res.data.rooms)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(
        '/admin/room-units',
        { roomTypeId: Number(form.roomTypeId), unitNumber: form.unitNumber, floor: form.floor || null, view: form.view || null },
        withAdminAuth()
      );
      setForm((p) => ({ ...p, unitNumber: '' }));
      reload();
    } catch (err) {
      setError(errMsg(err, 'Could not add room'));
    }
  };

  const toggle = async (u) => {
    try {
      await api.put(`/admin/room-units/${u.id}`, { isActive: !u.is_active }, withAdminAuth());
      reload();
    } catch (err) {
      setError(errMsg(err, 'Could not update room'));
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[12rem] flex-[2]">
          <label className="label">Room type</label>
          <select required className="input-field py-2" value={form.roomTypeId} onChange={(e) => setForm((p) => ({ ...p, roomTypeId: e.target.value }))}>
            <option value="">Select type…</option>
            {roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="w-28">
          <label className="label">Room no.</label>
          <input required className="input-field py-2" value={form.unitNumber} placeholder="101" onChange={(e) => setForm((p) => ({ ...p, unitNumber: e.target.value }))} />
        </div>
        <div className="w-28">
          <label className="label">Floor</label>
          <input className="input-field py-2" value={form.floor} onChange={(e) => setForm((p) => ({ ...p, floor: e.target.value }))} />
        </div>
        <div className="w-40">
          <label className="label">View (shown to guests)</label>
          <input className="input-field py-2" value={form.view} placeholder="Sea View" onChange={(e) => setForm((p) => ({ ...p, view: e.target.value }))} />
        </div>
        <button type="submit" className="btn-gold px-5 py-2 text-sm">Add Room</button>
      </form>
      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {units.map((u) => (
          <div key={u.id} className={`rounded-xl border border-navy-700 bg-navy-900 p-3 ${u.is_active ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between">
              <p className="font-serif text-lg font-bold text-navy-50">{u.unit_number}</p>
              <Badge className={JOB_STATUS_STYLE[u.status]}>{u.status}</Badge>
            </div>
            <p className="truncate text-xs text-navy-400" title={u.room_type}>{u.room_type}</p>
            {u.view_label && <p className="truncate text-xs text-navy-500">{u.view_label}</p>}
            <button onClick={() => toggle(u)} className="mt-2 text-xs text-navy-300 underline hover:text-gold-400">
              {u.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function HousekeepingManager() {
  const [view, setView] = useState('board');
  const [staff, setStaff] = useState([]);
  const [units, setUnits] = useState([]);

  const loadStaff = useCallback(() => {
    api.get('/admin/staff', withAdminAuth()).then((res) => setStaff(res.data.staff)).catch(() => {});
  }, []);
  const loadUnits = useCallback(() => {
    api.get('/admin/room-units', withAdminAuth()).then((res) => setUnits(res.data.units)).catch(() => {});
  }, []);

  useEffect(() => {
    loadStaff();
    loadUnits();
  }, [loadStaff, loadUnits]);

  return (
    <div>
      <div className="mb-6 flex gap-2 border-b border-navy-800 pb-3">
        <SubTab active={view === 'board'} onClick={() => setView('board')}>Cleaning Board</SubTab>
        <SubTab active={view === 'staff'} onClick={() => setView('staff')}>Staff</SubTab>
        <SubTab active={view === 'units'} onClick={() => { loadUnits(); setView('units'); }}>Room Numbers</SubTab>
      </div>
      {view === 'board' && <CleaningBoard staff={staff} units={units} />}
      {view === 'staff' && <StaffPanel staff={staff} reload={loadStaff} />}
      {view === 'units' && <RoomUnitsPanel units={units} reload={loadUnits} />}
    </div>
  );
}
