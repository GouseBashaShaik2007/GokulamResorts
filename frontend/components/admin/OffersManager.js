'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';
import { inr, fmtDate, todayIST, errMsg } from '../../lib/bookingUi';
import { gstRateFor, withGst } from '../../lib/gst';
import { useConfirm } from '../ui/Confirm';
import { useToast } from '../ui/Toast';

// Admin → Offers: per-night discounts for a room type (or all of them) over a
// run of dates. One word for them everywhere: the screen, this file, the API.

// What the offer does to a night's price — and to what the guest pays, since
// GST is charged on the discounted price and drops from 18% to 5% once a
// night comes down to ₹7,500 or less.
function DiscountPreview({ roomTypeId, discountType, value, types }) {
  const value_ = Number(value);
  if (!value_ || value_ <= 0) return null;

  const rooms = roomTypeId ? types.filter((t) => String(t.id) === String(roomTypeId)) : types;
  if (rooms.length === 0) return null;

  const line = (room) => {
    const original = Number(room.price_per_night);
    const discounted =
      discountType === 'percent'
        ? Math.max(0, original * (1 - value_ / 100))
        : Math.max(0, original - value_);
    return { id: room.id, name: room.name, original, discounted };
  };

  // "All room types" — preview against the first couple so the form doesn't
  // need a selection to show something useful.
  const previewRooms = roomTypeId ? rooms : rooms.slice(0, 2);

  return (
    <div className="rounded-lg border border-gold-500/30 bg-gold-500/5 px-4 py-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">Live preview</p>
      <ul className="mt-1.5 space-y-2">
        {previewRooms.map((room) => {
          const { id, name, original, discounted } = line(room);
          const newSlab = gstRateFor(discounted) !== gstRateFor(original);
          return (
            <li key={id} className="text-ink-800">
              {name}: {inr(original)} → <span className="font-semibold text-gold-600">{inr(discounted)}</span> per night
              <span className="block text-xs text-ink-500">
                Guest pays {inr(withGst(discounted))} a night with {gstRateFor(discounted)}% GST, instead of {inr(withGst(original))}.
                {newSlab && <strong className="font-semibold text-ink-800"> GST drops from {gstRateFor(original)}% to {gstRateFor(discounted)}% at this price.</strong>}
              </span>
            </li>
          );
        })}
      </ul>
      {!roomTypeId && rooms.length > 2 && (
        <p className="mt-1 text-xs text-ink-300">+ {rooms.length - 2} more room type(s), same discount.</p>
      )}
    </div>
  );
}

// Offers that are switched on, cover some of the same nights and the same
// room type (or all of them) as the one being typed in. They don't stack —
// the bigger saving applies — so the manager should know before saving.
function overlapping(form, rows, editingId) {
  if (!form.startDate || !form.endDate) return [];
  return rows.filter(
    (p) =>
      p.is_active &&
      p.id !== editingId &&
      String(p.start_date).slice(0, 10) <= form.endDate &&
      String(p.end_date).slice(0, 10) >= form.startDate &&
      (!form.roomTypeId || !p.room_type_id || String(p.room_type_id) === String(form.roomTypeId))
  );
}

const OFFER_STATE = {
  Live: 'bg-green-500/15 text-green-700',
  Scheduled: 'bg-blue-400/10 text-blue-700',
  Ended: 'bg-sand-300 text-ink-500',
  Off: 'bg-sand-300 text-ink-500',
};

// Where an offer stands today (resort calendar): its switch, then its dates.
function offerState(offer, today) {
  if (!offer.is_active) return 'Off';
  if (today < String(offer.start_date).slice(0, 10)) return 'Scheduled';
  if (today > String(offer.end_date).slice(0, 10)) return 'Ended';
  return 'Live';
}

export default function OffersManager() {
  const today = todayIST();
  const empty = { name: '', roomTypeId: '', discountType: 'percent', value: '', startDate: today, endDate: today, reason: '' };
  const ask = useConfirm();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null); // the offer being edited, or null when adding
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/admin/offers').then((r) => setRows(r.data.offers)).catch((err) => setError(errMsg(err, 'Could not load offers')));
  }, []);
  useEffect(() => {
    load();
    api.get('/admin/rooms').then((r) => setTypes(r.data.rooms)).catch((err) => setError(errMsg(err, 'Could not load room types')));
  }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const stopEditing = () => {
    setEditing(null);
    setForm(empty);
    setError('');
  };

  const startEditing = (p) => {
    setEditing(p);
    setError('');
    setForm({
      name: p.name,
      roomTypeId: p.room_type_id ? String(p.room_type_id) : '',
      discountType: p.discount_type,
      value: String(Number(p.value)),
      startDate: String(p.start_date).slice(0, 10),
      endDate: String(p.end_date).slice(0, 10),
      reason: p.reason,
    });
    document.getElementById('offer-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { ...form, roomTypeId: form.roomTypeId ? Number(form.roomTypeId) : null, value: Number(form.value) };
    try {
      if (editing) {
        await api.put(`/admin/offers/${editing.id}`, payload);
        toast(`“${form.name}” updated.`);
      } else {
        await api.post('/admin/offers', payload);
        toast(`“${form.name}” added.`);
      }
      stopEditing();
      load();
    } catch (err) {
      // Stays beside the form: it is usually about one of its fields.
      setError(errMsg(err, 'Could not save the offer'));
    }
  };

  const toggle = async (p) => {
    try {
      await api.put(`/admin/offers/${p.id}`, { isActive: !p.is_active });
      toast(`“${p.name}” turned ${p.is_active ? 'off' : 'on'}.`);
    } catch (err) {
      toast(errMsg(err, `Could not turn “${p.name}” ${p.is_active ? 'off' : 'on'}`), { tone: 'error' });
    }
    load();
  };

  const remove = async (p) => {
    const ok = await ask({
      title: `Delete “${p.name}”?`,
      body: 'It is removed for good. Bookings already made keep the price they were given. To pause an offer instead, turn it off.',
      confirmLabel: 'Delete offer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/offers/${p.id}`);
      toast(`“${p.name}” deleted.`);
      if (editing?.id === p.id) stopEditing();
    } catch (err) {
      toast(errMsg(err, `Could not delete “${p.name}”`), { tone: 'error' });
    }
    load();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <form id="offer-form" onSubmit={submit} className="card scroll-mt-24 space-y-3 self-start p-6">
        <h2 className="font-serif text-xl font-bold text-ink-900">{editing ? `Edit offer: ${editing.name}` : 'New offer'}</h2>
        <p className="text-xs text-ink-400">
          Applies per night to new bookings and extensions. When two offers cover the same night, the bigger
          discount wins (they don&apos;t stack). Existing bookings keep their price. Guests see live offers on
          the home page, the room cards and each room&apos;s page.
        </p>
        <div>
          <label className="label">Name (shown to guests)</label>
          <input aria-label="Name (shown to guests)" required className="input-field py-2" placeholder="Monsoon Villa Offer" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label">Room type</label>
          <select aria-label="Room type" className="input-field py-2" value={form.roomTypeId} onChange={set('roomTypeId')}>
            <option value="">All room types</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="input-field py-2" aria-label="Discount type" value={form.discountType} onChange={set('discountType')}>
            <option value="percent">% off per night</option>
            <option value="fixed">₹ off per night</option>
          </select>
          <input required type="number" min="1" step="0.01" max={form.discountType === 'percent' ? 100 : undefined} className="input-field py-2" aria-label="Discount value" placeholder="Value" value={form.value} onChange={set('value')} />
        </div>

        <DiscountPreview roomTypeId={form.roomTypeId} discountType={form.discountType} value={form.value} types={types} />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">First night</label>
            <input aria-label="First night" required type="date" className="input-field py-2" value={form.startDate} onChange={set('startDate')} />
          </div>
          <div>
            <label className="label">Last night</label>
            <input aria-label="Last night" required type="date" min={form.startDate} className="input-field py-2" value={form.endDate} onChange={set('endDate')} />
          </div>
        </div>
        {overlapping(form, rows, editing?.id).length > 0 && (
          <div role="status" className="rounded-lg border border-orange-400/40 bg-orange-400/10 px-4 py-3 text-sm text-orange-800">
            <p className="font-semibold">Overlaps another offer</p>
            <ul className="mt-1 space-y-0.5">
              {overlapping(form, rows, editing?.id).map((p) => (
                <li key={p.id}>
                  {p.name} — {p.discount_type === 'percent' ? `${Number(p.value)}% off` : `${inr(p.value)} off`}, {p.room_type || 'all room types'}, {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
                </li>
              ))}
            </ul>
            <p className="mt-1">On nights both cover, a guest gets the bigger saving of the two, not both.</p>
          </div>
        )}
        <div>
          <label className="label">Reason (internal, required)</label>
          <input aria-label="Reason (internal, required)" required minLength={3} className="input-field py-2" placeholder="e.g. Low season, owner approved" value={form.reason} onChange={set('reason')} />
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-3">
          <button className="btn-primary flex-1">{editing ? 'Save changes' : 'Add offer'}</button>
          {editing && <button type="button" onClick={stopEditing} className="btn-outline">Cancel</button>}
        </div>
      </form>

      <div className="card p-6">
        <h2 className="font-serif text-xl font-bold text-ink-900">Offers</h2>
        <div className="mt-4 space-y-2">
          {rows.map((p) => (
            <div key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sand-300 bg-sand-200 px-4 py-3 ${offerState(p, today) === 'Live' || offerState(p, today) === 'Scheduled' ? '' : 'opacity-60'}`}>
              <div>
                <p className="font-medium text-ink-900">
                  <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${OFFER_STATE[offerState(p, today)]}`}>{offerState(p, today)}</span>
                  {p.name} · {p.discount_type === 'percent' ? `${Number(p.value)}% off` : `${inr(p.value)} off`}/night
                </p>
                <p className="text-xs text-ink-400">
                  {p.room_type || 'All room types'} · {fmtDate(p.start_date)} – {fmtDate(p.end_date)} · {p.reason}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEditing(p)} className="rounded-lg border border-gold-500/50 px-3 py-1 text-xs text-gold-600 hover:bg-gold-500/10">
                  Edit
                </button>
                <button onClick={() => toggle(p)} className="rounded-lg border border-sand-400 px-3 py-1 text-xs text-ink-700 hover:bg-sand-300">
                  {p.is_active ? 'Turn off' : 'Turn on'}
                </button>
                <button onClick={() => remove(p)} className="rounded-lg border border-red-500/50 px-3 py-1 text-xs text-red-700 hover:bg-red-500/10">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-ink-400">No offers yet.</p>}
        </div>
      </div>
    </div>
  );
}
