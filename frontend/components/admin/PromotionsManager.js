'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';
import { inr, fmtDate, todayIST, errMsg } from '../../lib/bookingUi';

const PREVIEW_NIGHTS = 3;

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
    return { name: room.name, original, discounted };
  };

  // "All room types" — preview against the first couple so the form doesn't
  // need a selection to show something useful.
  const previewRooms = roomTypeId ? rooms : rooms.slice(0, 2);

  return (
    <div className="rounded-lg border border-gold-500/30 bg-gold-500/5 px-4 py-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">Live preview</p>
      <ul className="mt-1.5 space-y-1">
        {previewRooms.map((room) => {
          const { name, original, discounted } = line(room);
          return (
            <li key={name} className="text-navy-100">
              {name}: {inr(original)} → <span className="font-semibold text-gold-600">{inr(discounted)}</span> per
              night <span className="text-navy-400">(≈ {inr(discounted * PREVIEW_NIGHTS)} for {PREVIEW_NIGHTS} nights)</span>
            </li>
          );
        })}
      </ul>
      {!roomTypeId && rooms.length > 2 && (
        <p className="mt-1 text-xs text-navy-500">+ {rooms.length - 2} more room type(s), same discount.</p>
      )}
    </div>
  );
}

const OFFER_STATE = {
  Live: 'bg-green-500/15 text-green-700',
  Scheduled: 'bg-blue-400/10 text-blue-700',
  Ended: 'bg-navy-700 text-navy-300',
  Off: 'bg-navy-700 text-navy-300',
};

// Where an offer stands today (resort calendar): its switch, then its dates.
function offerState(offer, today) {
  if (!offer.is_active) return 'Off';
  if (today < String(offer.start_date).slice(0, 10)) return 'Scheduled';
  if (today > String(offer.end_date).slice(0, 10)) return 'Ended';
  return 'Live';
}

export default function PromotionsManager() {
  const today = todayIST();
  const empty = { name: '', roomTypeId: '', discountType: 'percent', value: '', startDate: today, endDate: today, reason: '' };
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/admin/rate-discounts', withAdminAuth()).then((r) => setRows(r.data.discounts)).catch((err) => setError(errMsg(err, 'Could not load offers')));
  }, []);
  useEffect(() => {
    load();
    api.get('/admin/rooms', withAdminAuth()).then((r) => setTypes(r.data.rooms)).catch((err) => setError(errMsg(err, 'Could not load room types')));
  }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(
        '/admin/rate-discounts',
        { ...form, roomTypeId: form.roomTypeId ? Number(form.roomTypeId) : null, value: Number(form.value) },
        withAdminAuth()
      );
      setForm(empty);
      load();
    } catch (err) {
      setError(errMsg(err, 'Could not save promotion'));
    }
  };

  const toggle = async (p) => {
    setError('');
    try {
      await api.put(`/admin/rate-discounts/${p.id}`, { isActive: !p.is_active }, withAdminAuth());
    } catch (err) {
      setError(errMsg(err, `Could not turn "${p.name}" ${p.is_active ? 'off' : 'on'}`));
    }
    load();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <form onSubmit={submit} className="card space-y-3 p-6">
        <h2 className="font-serif text-xl font-bold text-navy-50">New offer</h2>
        <p className="text-xs text-navy-400">
          Applies per night to new bookings and extensions. When two offers cover the same night, the bigger
          discount wins (they don&apos;t stack). Existing bookings keep their price.
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
          <select className="input-field py-2" value={form.discountType} onChange={set('discountType')}>
            <option value="percent">% off per night</option>
            <option value="fixed">₹ off per night</option>
          </select>
          <input required type="number" min="1" step="0.01" max={form.discountType === 'percent' ? 100 : undefined} className="input-field py-2" placeholder="Value" value={form.value} onChange={set('value')} />
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
        <div>
          <label className="label">Reason (internal, required)</label>
          <input aria-label="Reason (internal, required)" required minLength={3} className="input-field py-2" value={form.reason} onChange={set('reason')} />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="btn-gold w-full">Add offer</button>
      </form>

      <div className="card p-6">
        <h2 className="font-serif text-xl font-bold text-navy-50">Offers</h2>
        <div className="mt-4 space-y-2">
          {rows.map((p) => (
            <div key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-navy-700 bg-navy-800 px-4 py-3 ${offerState(p, today) === 'Live' || offerState(p, today) === 'Scheduled' ? '' : 'opacity-60'}`}>
              <div>
                <p className="font-medium text-navy-50">
                  <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${OFFER_STATE[offerState(p, today)]}`}>{offerState(p, today)}</span>
                  {p.name} · {p.discount_type === 'percent' ? `${Number(p.value)}% off` : `${inr(p.value)} off`}/night
                </p>
                <p className="text-xs text-navy-400">
                  {p.room_type || 'All room types'} · {fmtDate(p.start_date)} – {fmtDate(p.end_date)} · {p.reason}
                </p>
              </div>
              <button onClick={() => toggle(p)} className="rounded-lg border border-navy-600 px-3 py-1 text-xs text-navy-200 hover:bg-navy-700">
                {p.is_active ? 'Turn off' : 'Turn on'}
              </button>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-navy-400">No offers yet.</p>}
        </div>
      </div>
    </div>
  );
}
