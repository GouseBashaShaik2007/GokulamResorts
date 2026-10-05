'use client';

import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { errMsg } from '../../lib/bookingUi';

/** Admin → Staff: the cooks, who sign in to the kitchen display with a PIN each. */
export default function KitchenStaffCard() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: '', pin: '' });
  const ask = useConfirm();
  const toast = useToast();
  const [error, setError] = useState('');

  const load = () => {
    api.get('/admin/kitchen-staff').then((res) => setStaff(res.data.staff)).catch((err) => setError(errMsg(err, 'Could not load kitchen staff')));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/kitchen-staff', form);
      toast(`${form.name} added. They sign in at /kitchen with the PIN you just set.`);
      setForm({ name: '', pin: '' });
      load();
    } catch (err) {
      setError(errMsg(err, 'Could not add kitchen staff'));
    }
  };

  const toggle = async (s) => {
    try {
      await api.put(`/admin/kitchen-staff/${s.id}`, { isActive: !s.is_active });
      toast(`${s.name} ${s.is_active ? 'deactivated — their PIN no longer works' : 'reactivated'}.`);
      load();
    } catch (err) {
      toast(errMsg(err, 'Could not update kitchen staff'), { tone: 'error' });
    }
  };

  const resetPin = async (s) => {
    const pin = await ask({
      title: `New PIN for ${s.name}`,
      confirmLabel: 'Reset PIN',
      input: {
        label: 'New PIN',
        inputMode: 'numeric',
        hint: '4 to 6 digits. Give it to them in person.',
        validate: (v) => (/^[0-9]{4,6}$/.test(v) ? '' : 'PIN must be 4 to 6 digits.'),
      },
    });
    if (!pin) return;
    api
      .put(`/admin/kitchen-staff/${s.id}`, { pin })
      .then(() => {
        toast(`PIN reset for ${s.name}.`);
        load();
      })
      .catch((err) => toast(errMsg(err, 'Could not reset PIN'), { tone: 'error' }));
  };

  return (
    <div className="card space-y-4 p-6">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink-900">Kitchen</h2>
        <p className="text-sm text-ink-400">
          Each cook signs in to the kitchen display with their own PIN, so every order action is recorded against the
          person who made it.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <label className="label" htmlFor="cook-name">Name</label>
          <input id="cook-name" required className="input-field" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="w-36">
          <label className="label" htmlFor="cook-pin">PIN (4-6 digits)</label>
          <input
            id="cook-pin"
            required inputMode="numeric" pattern="[0-9]{4,6}" className="input-field"
            value={form.pin} onChange={(e) => setForm((p) => ({ ...p, pin: e.target.value.replace(/[^0-9]/g, '') }))}
          />
        </div>
        <button type="submit" className="btn-primary px-5 py-2 text-sm">Add</button>
      </form>

      {/* Stays beside the form it belongs to: usually "that PIN is too easy to guess". */}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        {staff.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sand-300 bg-sand-200 px-4 py-2.5">
            <p className={`font-medium ${s.is_active ? 'text-ink-900' : 'text-ink-400 line-through'}`}>{s.name}</p>
            <div className="flex gap-2">
              <button onClick={() => resetPin(s)} className="rounded-lg border border-sand-400 px-3 py-1 text-xs text-ink-700 hover:bg-sand-300">
                Reset PIN
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
        {staff.length === 0 && <p className="text-sm text-ink-400">No kitchen staff yet.</p>}
      </div>
    </div>
  );
}
