'use client';

import { useEffect, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';
import { useConfirm } from '@/components/ui/Confirm';
import { useToast } from '@/components/ui/Toast';
import { errMsg } from '../../lib/bookingUi';
import { CONTACT } from '../../lib/site';

// What guests see on the site: phone, WhatsApp, address, check-in times.
// Phone, WhatsApp, the map link and the times are simply not shown while
// empty. Email and address always appear, so an empty field falls back to the
// one written into the site (CONTACT in lib/site.js) — the hints say which.
const DETAIL_FIELDS = [
  { key: 'phone', column: 'phone', label: 'Phone', placeholder: 'e.g. +91 98765 43210', hint: 'Shown on the Contact page, footer and booking pages as a tap-to-call link. Empty: no phone is shown.', type: 'tel' },
  { key: 'whatsapp', column: 'whatsapp', label: 'WhatsApp number', placeholder: 'e.g. 919876543210', hint: 'Digits only, starting with the country code (91 for India). Turns on the WhatsApp button.', inputMode: 'numeric' },
  { key: 'email', column: 'email', label: 'Email', placeholder: 'e.g. stay@yourresort.in', hint: `Empty: the site shows ${CONTACT.email}.`, type: 'email' },
  { key: 'address', column: 'address', label: 'Address', placeholder: 'e.g. Street, Chirala, Andhra Pradesh, PIN', hint: `Empty: the site shows “${CONTACT.address}”.`, wide: true },
  { key: 'mapsUrl', column: 'maps_url', label: 'Google Maps link', placeholder: 'e.g. https://maps.app.goo.gl/…', hint: 'Open the resort in Google Maps → Share → Copy link. “Directions” buttons then lead to the resort itself, not just to Chirala Beach.', type: 'url', wide: true },
  { key: 'checkInTime', column: 'check_in_time', label: 'Check-in from', placeholder: 'e.g. 2:00 PM', hint: 'Shown on room pages, the FAQ and booking confirmations.' },
  { key: 'checkOutTime', column: 'check_out_time', label: 'Check-out by', placeholder: 'e.g. 11:00 AM' },
];

const detailsFrom = (settings) => Object.fromEntries(DETAIL_FIELDS.map((f) => [f.key, settings?.[f.column] || '']));

function ResortDetailsCard({ settings, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(detailsFrom(settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setForm(detailsFrom(settings)), [settings]);

  // An API server started before this form existed would ignore these fields
  // (and blank the site address instead), so the form stays locked until the
  // server answers with them.
  const ready = !!settings && 'phone' in settings;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/admin/settings', form, withAdminAuth());
      onSaved(res.data.settings);
      toast('Resort details saved. The site shows them within a minute.');
    } catch (err) {
      setError(errMsg(err, 'Could not save the resort details.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <h2 className="font-serif text-xl font-bold text-navy-50">Resort Details</h2>
        <p className="text-sm text-navy-400">
          Shown to guests across the site, within a minute of saving. Nothing is filled in yet unless you see it typed below.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {DETAIL_FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
            <label className="label" htmlFor={`resort-${f.key}`}>{f.label}</label>
            <input
              id={`resort-${f.key}`}
              type={f.type || 'text'}
              inputMode={f.inputMode}
              className="input-field"
              placeholder={f.placeholder}
              value={form[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
            {f.hint && <p className="mt-1 text-xs text-navy-400">{f.hint}</p>}
          </div>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {settings && !ready && (
        <p role="alert" className="text-sm text-red-700">
          The API server is running an older version that can&apos;t store these yet. Restart it, then reload this page.
        </p>
      )}
      <button type="submit" disabled={saving || !ready} className="btn-gold px-5 py-2 text-sm disabled:opacity-60">
        {saving ? 'Saving…' : 'Save details'}
      </button>
    </form>
  );
}

function SiteAddressCard({ settings, onSaved }) {
  const toast = useToast();
  const siteUrl = settings?.site_url || '';
  const [draft, setDraft] = useState(siteUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setDraft(siteUrl), [siteUrl]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/admin/settings', { siteUrl: draft }, withAdminAuth());
      onSaved(res.data.settings);
      toast('Site address saved.');
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
        aria-label="Production site address"
        className="input-field"
        placeholder="https://gokulamresorts.in"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {siteUrl && <p className="text-xs text-navy-400">Currently: <code>{siteUrl}</code></p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
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
  const toast = useToast();
  const [error, setError] = useState('');

  const load = () => {
    api.get('/admin/kitchen-staff', withAdminAuth()).then((res) => setStaff(res.data.staff)).catch((err) => setError(errMsg(err, 'Could not load kitchen staff')));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/kitchen-staff', form, withAdminAuth());
      toast(`${form.name} added. They sign in at /kitchen with the PIN you just set.`);
      setForm({ name: '', pin: '' });
      load();
    } catch (err) {
      setError(errMsg(err, 'Could not add kitchen staff'));
    }
  };

  const toggle = async (s) => {
    try {
      await api.put(`/admin/kitchen-staff/${s.id}`, { isActive: !s.is_active }, withAdminAuth());
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
        validate: (v) => (/^\d{4,6}$/.test(v) ? '' : 'PIN must be 4 to 6 digits.'),
      },
    });
    if (!pin) return;
    api
      .put(`/admin/kitchen-staff/${s.id}`, { pin }, withAdminAuth())
      .then(() => {
        toast(`PIN reset for ${s.name}.`);
        load();
      })
      .catch((err) => toast(errMsg(err, 'Could not reset PIN'), { tone: 'error' }));
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

      {/* Stays beside the form it belongs to: usually "that PIN is too easy to guess". */}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

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
        {staff.length === 0 && <p className="text-sm text-navy-400">No kitchen staff yet.</p>}
      </div>
    </div>
  );
}

export default function SettingsManager() {
  // One copy of the saved settings, shared by the two cards that edit it.
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/settings', withAdminAuth())
      .then((res) => setSettings(res.data.settings))
      .catch(() => setError('Could not load settings. Please reload the page.'));
  }, []);

  return (
    <div className="space-y-8">
      {error && <p role="alert" className="card p-4 text-sm text-red-700">{error}</p>}
      <ResortDetailsCard settings={settings} onSaved={setSettings} />
      <SiteAddressCard settings={settings} onSaved={setSettings} />
      <KitchenStaffCard />
    </div>
  );
}
