'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api, { withAdminAuth } from '../../lib/api';
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
      <h2 className="font-serif text-xl font-bold text-navy-50">Website Address</h2>
      <p className="text-sm text-navy-400">
        The address guests type to reach the site, starting with https://. It goes into every printed QR code, so it
        is never guessed from your browser — leave it empty (QR printing stays off) until the real address is live.
      </p>
      <input
        aria-label="Website address"
        type="url"
        pattern="https://.+"
        title="A full web address starting with https://"
        className="input-field"
        placeholder="https://gokulamresorts.in"
        value={draft}
        onChange={(e) => setDraft(e.target.value.trim())}
      />
      {siteUrl && <p className="text-xs text-navy-400">Currently: <code>{siteUrl}</code></p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={saving} className="btn-gold px-5 py-2 text-sm disabled:opacity-60">
        {saving ? 'Saving…' : 'Save address'}
      </button>
    </form>
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
      <p className="text-sm text-navy-400">
        Looking for kitchen PINs? Everyone who signs in is now under{' '}
        <Link href="/admin/staff" className="font-semibold text-ocean-600 underline">Staff</Link>.
      </p>
    </div>
  );
}
