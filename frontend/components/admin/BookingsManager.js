'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';
import { inr, fmtDate, todayIST, errMsg } from '../../lib/bookingUi';
import DeskBoard from '../bookings/DeskBoard';

// Standing price promotions, e.g. "20% off Villas in June".
function PromotionsManager() {
  const today = todayIST();
  const empty = { name: '', roomTypeId: '', discountType: 'percent', value: '', startDate: today, endDate: today, reason: '' };
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/admin/rate-discounts', withAdminAuth()).then((r) => setRows(r.data.discounts)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    api.get('/admin/rooms', withAdminAuth()).then((r) => setTypes(r.data.rooms)).catch(() => {});
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
    await api.put(`/admin/rate-discounts/${p.id}`, { isActive: !p.is_active }, withAdminAuth()).catch(() => {});
    load();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <form onSubmit={submit} className="card space-y-3 p-6">
        <h2 className="font-serif text-xl font-bold text-navy-50">New promotion</h2>
        <p className="text-xs text-navy-400">
          Applies per night to new bookings and extensions. When two promotions cover the same night, the bigger discount wins (they don't stack). Existing bookings keep their price.
        </p>
        <div>
          <label className="label">Name (shown to guests)</label>
          <input required className="input-field py-2" placeholder="Monsoon Villa Offer" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label">Room type</label>
          <select className="input-field py-2" value={form.roomTypeId} onChange={set('roomTypeId')}>
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">First night</label>
            <input required type="date" className="input-field py-2" value={form.startDate} onChange={set('startDate')} />
          </div>
          <div>
            <label className="label">Last night</label>
            <input required type="date" min={form.startDate} className="input-field py-2" value={form.endDate} onChange={set('endDate')} />
          </div>
        </div>
        <div>
          <label className="label">Reason (internal, required)</label>
          <input required minLength={3} className="input-field py-2" value={form.reason} onChange={set('reason')} />
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button className="btn-gold w-full">Add promotion</button>
      </form>

      <div className="card p-6">
        <h2 className="font-serif text-xl font-bold text-navy-50">Promotions</h2>
        <div className="mt-4 space-y-2">
          {rows.map((p) => (
            <div key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-navy-700 bg-navy-800 px-4 py-3 ${p.is_active ? '' : 'opacity-50'}`}>
              <div>
                <p className="font-medium text-navy-50">
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
          {rows.length === 0 && <p className="text-sm text-navy-400">No promotions yet.</p>}
        </div>
      </div>
    </div>
  );
}

export default function BookingsManager() {
  const [view, setView] = useState('desk');
  return (
    <div>
      <div className="mb-6 flex gap-2 border-b border-navy-800 pb-3">
        {[
          ['desk', 'Approvals & front desk'],
          ['promotions', 'Promotions'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`rounded-lg px-3 py-1.5 text-sm ${view === key ? 'bg-navy-700 text-gold-400' : 'text-navy-300 hover:text-navy-100'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'desk' && <DeskBoard mode="admin" />}
      {view === 'promotions' && <PromotionsManager />}
    </div>
  );
}
