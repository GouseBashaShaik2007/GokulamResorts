'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { errMsg } from '../../lib/bookingUi';
import KitchenStaffCard from './KitchenStaffCard';

const ROLES = [
  { value: 'FrontDesk', label: 'Front desk' },
  { value: 'Bedding', label: 'Bedding' },
  { value: 'Toiletry', label: 'Toiletry' },
  { value: 'Inspector', label: 'Inspector' },
];
// The front desk handles bookings, payments and guest IDs, so it signs in
// with a password. Housekeeping taps a name and types a PIN.
const usesPassword = (role) => role === 'FrontDesk';
const validPin = (v) => (/^[0-9]{4,6}$/.test(v) ? '' : 'PIN must be 4 to 6 digits.');
const emptyForm = { name: '', phone: '', role: 'Bedding', password: '', pin: '' };
const smallButton = 'rounded-lg border border-sand-400 px-3 py-1 text-xs text-ink-700 hover:bg-sand-300';

/**
 * Admin → Staff: everyone who signs in to a staff screen. The front desk
 * uses a phone number and password; housekeeping a name tile and a PIN; cooks
 * a PIN each on the kitchen display (KitchenStaffCard).
 */
export default function StaffManager() {
  const ask = useConfirm();
  const toast = useToast();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/admin/staff')
      .then((res) => setStaff(res.data.staff))
      .catch((err) => toast(errMsg(err, 'Could not load staff'), { tone: 'error' }));
  }, [toast]);
  useEffect(load, [load]);

  const withPassword = usesPassword(form.role);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const { name, phone, role } = form;
    try {
      await api.post('/admin/staff', { name, phone, role, ...(withPassword ? { password: form.password } : { pin: form.pin }) });
      toast(
        withPassword
          ? `${name} added. They sign in at /staff/login with ${phone} and the password.`
          : `${name} added. At /staff/login they tap their name and type the PIN.`,
        { duration: 7000 }
      );
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
      await api.put(`/admin/staff/${s.id}`, body);
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

  const setPin = async (s) => {
    const pin = await ask({
      title: `${s.has_pin ? 'New PIN' : 'Set a PIN'} for ${s.name}`,
      body: 'They sign in by tapping their name and typing this PIN.',
      confirmLabel: s.has_pin ? 'Reset PIN' : 'Set PIN',
      input: { label: 'PIN', inputMode: 'numeric', hint: '4 to 6 digits. Give it to them in person.', validate: validPin },
    });
    if (!pin) return;
    if (await update(s, { pin })) toast(`PIN ${s.has_pin ? 'reset' : 'set'} for ${s.name}.`);
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
        <form onSubmit={submit} className="card space-y-4 self-start p-6">
          <h2 className="font-serif text-xl font-bold text-ink-900">Add front desk or housekeeping staff</h2>
          <div>
            <label className="label" htmlFor="staff-name">Name</label>
            <input id="staff-name" required className="input-field" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="staff-role">Role</label>
            <select id="staff-role" className="input-field" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="staff-phone">Phone{withPassword ? ' (they sign in with it)' : ''}</label>
            <input id="staff-phone" required inputMode="tel" className="input-field" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          {withPassword ? (
            <div>
              <label className="label" htmlFor="staff-password">Password</label>
              <input id="staff-password" required minLength={6} type="text" className="input-field" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
              <p className="mt-1 text-xs text-ink-400">At least 6 characters. The front desk signs in with phone number and password.</p>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="staff-pin">PIN (4-6 digits)</label>
              <input
                id="staff-pin" required inputMode="numeric" pattern="[0-9]{4,6}" className="input-field"
                value={form.pin} onChange={(e) => setForm((p) => ({ ...p, pin: e.target.value.replace(/[^0-9]/g, '') }))}
              />
              <p className="mt-1 text-xs text-ink-400">Housekeeping signs in by tapping their name and typing this PIN. Avoid easy ones like 1234.</p>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" className="btn-primary w-full">Add Staff</button>
        </form>

        <div className="card p-6">
          <h2 className="font-serif text-xl font-bold text-ink-900">Front desk and housekeeping</h2>
          {ROLES.map((role) => {
            const members = staff.filter((s) => s.role === role.value);
            return (
              <div key={role.value} className="mt-5">
                <p className="eyebrow text-xs">{role.label}</p>
                <div className="mt-2 space-y-2">
                  {members.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sand-300 bg-sand-200 px-4 py-2.5">
                      <div>
                        <p className={`font-medium ${s.is_active ? 'text-ink-900' : 'text-ink-400 line-through'}`}>{s.name}</p>
                        <p className="text-xs text-ink-400">
                          {s.phone}
                          {!usesPassword(s.role) && s.has_pin !== undefined && ` · ${s.has_pin ? 'signs in with a PIN' : 'no PIN yet: signs in with a password'}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {/* has_pin is missing only from an API server too old to know about PINs. */}
                        {!usesPassword(s.role) && s.has_pin !== undefined && (
                          <button onClick={() => setPin(s)} className={smallButton}>{s.has_pin ? 'Reset PIN' : 'Set PIN'}</button>
                        )}
                        {(usesPassword(s.role) || !s.has_pin) && (
                          <button onClick={() => resetPassword(s)} className={smallButton}>Reset password</button>
                        )}
                        <button
                          onClick={() => toggle(s)}
                          className={`rounded-lg border px-3 py-1 text-xs ${s.is_active ? 'border-red-500/50 text-red-700 hover:bg-red-500/10' : 'border-green-500/50 text-green-700 hover:bg-green-500/10'}`}
                        >
                          {s.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {members.length === 0 && <p className="text-sm text-ink-400">None yet.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <KitchenStaffCard />
    </div>
  );
}
