'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { errMsg } from '../../lib/bookingUi';

const ROLES = [
  { value: 'FrontDesk', label: 'Front desk' },
  { value: 'Bedding', label: 'Bedding' },
  { value: 'Toiletry', label: 'Toiletry' },
  { value: 'Inspector', label: 'Inspector' },
];
const emptyForm = { name: '', phone: '', role: 'Bedding', password: '' };

/**
 * Admin → Staff: the front desk and housekeeping logins (phone + password).
 * Cooks are separate — they sign in with a PIN, set in Settings.
 */
export default function StaffManager() {
  const ask = useConfirm();
  const toast = useToast();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/admin/staff', withAdminAuth())
      .then((res) => setStaff(res.data.staff))
      .catch((err) => toast(errMsg(err, 'Could not load staff'), { tone: 'error' }));
  }, [toast]);
  useEffect(load, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/staff', form, withAdminAuth());
      toast(`${form.name} added. They sign in at /staff/login with ${form.phone}.`, { duration: 7000 });
      setForm(emptyForm);
      load();
    } catch (err) {
      // Stays beside the form: it is usually about one of its fields.
      setError(errMsg(err, 'Could not add staff'));
    }
  };

  // Resolves true only when the server accepted the change.
  const update = async (s, body) => {
    try {
      await api.put(`/admin/staff/${s.id}`, body, withAdminAuth());
      load();
      return true;
    } catch (err) {
      toast(errMsg(err, 'Could not update staff'), { tone: 'error' });
      return false;
    }
  };

  const toggle = async (s) => {
    if (await update(s, { isActive: !s.is_active })) toast(`${s.name} ${s.is_active ? 'deactivated — they can no longer sign in' : 'reactivated'}.`);
  };

  const resetPassword = async (s) => {
    const password = await ask({
      title: `New password for ${s.name}`,
      confirmLabel: 'Reset password',
      input: {
        label: 'New password',
        hint: 'At least 6 characters. Give it to them in person.',
        validate: (v) => (v.trim().length < 6 ? 'Use at least 6 characters.' : ''),
      },
    });
    if (!password) return;
    if (await update(s, { password })) toast(`Password reset for ${s.name}.`);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
      <form onSubmit={submit} className="card space-y-4 self-start p-6">
        <h2 className="font-serif text-xl font-bold text-navy-50">Add Staff</h2>
        <div>
          <label className="label">Name</label>
          <input aria-label="Name" required className="input-field" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Phone (login)</label>
          <input aria-label="Phone (login)" required inputMode="tel" className="input-field" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        </div>
        <div>
          <label className="label">Role</label>
          <select aria-label="Role" className="input-field" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Password</label>
          <input aria-label="Password" required minLength={6} type="text" className="input-field" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" className="btn-gold w-full">Add Staff</button>
      </form>

      <div className="card p-6">
        <h2 className="font-serif text-xl font-bold text-navy-50">Team</h2>
        {ROLES.map((role) => {
          const members = staff.filter((s) => s.role === role.value);
          return (
            <div key={role.value} className="mt-5">
              <p className="eyebrow text-xs">{role.label}</p>
              <div className="mt-2 space-y-2">
                {members.map((s) => (
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
                        onClick={() => toggle(s)}
                        className={`rounded-lg border px-3 py-1 text-xs ${s.is_active ? 'border-red-500/50 text-red-700 hover:bg-red-500/10' : 'border-green-500/50 text-green-700 hover:bg-green-500/10'}`}
                      >
                        {s.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </div>
                ))}
                {members.length === 0 && <p className="text-sm text-navy-400">None yet.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
