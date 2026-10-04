'use client';

import { useEffect, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';
import { useConfirm } from '@/components/ui/Confirm';
import { errMsg } from '../../lib/bookingUi';


function SiteAddressCard() {
  const [siteUrl, setSiteUrl] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/settings', withAdminAuth())
      .then((res) => {
        setSiteUrl(res.data.settings.site_url || '');
        setDraft(res.data.settings.site_url || '');
      })
      .catch(() => setError('Could not load settings.'));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await api.put('/admin/settings', { siteUrl: draft }, withAdminAuth());
      setSiteUrl(res.data.settings.site_url || '');
      setDraft(res.data.settings.site_url || '');
      setMessage('Saved.');
    } catch (err) {
      setError(errMsg(err, 'Could not save the site address.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-3 p-6">
      <h2 className="font-serif text-xl font-bold text-navy-50">Production Site Address</h2>
      <p className="text-sm text-navy-400">
        Used to build every printed table/kiosk QR code. Never guessed from your browser — leave it empty
        (QR printing stays disabled) until you have a real domain.
      </p>
      <input
        className="input-field"
        placeholder="https://gokulamresorts.in"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {siteUrl && <p className="text-xs text-navy-400">Currently: <code>{siteUrl}</code></p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={saving} className="btn-gold px-5 py-2 text-sm disabled:opacity-60">
        {saving ? 'Saving…' : 'Save address'}
      </button>
    </form>
  );
}

function KitchenStaffCard() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: '', pin: '' });
  const ask = useConfirm();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    api.get('/admin/kitchen-staff', withAdminAuth()).then((res) => setStaff(res.data.staff)).catch((err) => setError(errMsg(err, 'Could not load kitchen staff')));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.post('/admin/kitchen-staff', form, withAdminAuth());
      setMessage(`${form.name} added. They sign in at /kitchen with the PIN you just set.`);
      setForm({ name: '', pin: '' });
      load();
    } catch (err) {
      setError(errMsg(err, 'Could not add kitchen staff'));
    }
  };

  const toggle = async (s) => {
    try {
      await api.put(`/admin/kitchen-staff/${s.id}`, { isActive: !s.is_active }, withAdminAuth());
      load();
    } catch (err) {
      setError(errMsg(err, 'Could not update kitchen staff'));
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
        validate: (v) => (/^\d{4,6}$/.test(v) ? '' : 'PIN must be 4 to 6 digits.'),
      },
    });
    if (!pin) return;
    api
      .put(`/admin/kitchen-staff/${s.id}`, { pin }, withAdminAuth())
      .then(() => {
        setMessage(`PIN reset for ${s.name}.`);
        load();
      })
      .catch((err) => setError(errMsg(err, 'Could not reset PIN')));
  };

  return (
    <div className="card space-y-4 p-6">
      <div>
        <h2 className="font-serif text-xl font-bold text-navy-50">Kitchen Staff</h2>
        <p className="text-sm text-navy-400">
          Each cook signs into the kitchen display with their own PIN instead of a shared device password —
          order actions are attributed to the person who made them.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <label className="label">Name</label>
          <input aria-label="Name" required className="input-field" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="w-32">
          <label className="label">PIN (4-6 digits)</label>
          <input aria-label="PIN (4-6 digits)"
            required inputMode="numeric" pattern="\d{4,6}" className="input-field"
            value={form.pin} onChange={(e) => setForm((p) => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))}
          />
        </div>
        <button type="submit" className="btn-gold px-5 py-2 text-sm">Add</button>
      </form>

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        {staff.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-navy-700 bg-navy-800 px-4 py-2.5">
            <p className={`font-medium ${s.is_active ? 'text-navy-50' : 'text-navy-400 line-through'}`}>{s.name}</p>
            <div className="flex gap-2">
              <button onClick={() => resetPin(s)} className="rounded-lg border border-navy-600 px-3 py-1 text-xs text-navy-200 hover:bg-navy-700">
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
        {staff.length === 0 && <p className="text-sm text-navy-500">No kitchen staff yet.</p>}
      </div>
    </div>
  );
}

export default function SettingsManager() {
  return (
    <div className="space-y-8">
      <SiteAddressCard />
      <KitchenStaffCard />
    </div>
  );
}
