'use client';

import { useState } from 'react';
import api, { authFor } from '../../lib/api';
import { inr, todayIST, addDays, errMsg } from '../../lib/bookingUi';
import RoomPicker from './RoomPicker';

// Walk-in booking at the desk: confirmed immediately, paid in full now.
export default function CounterBookingForm({ mode, onCreated }) {
  const auth = authFor(mode);
  const today = todayIST();
  const [stay, setStay] = useState({ checkIn: today, checkOut: addDays(today, 1), adults: 2, children: 0 });
  const [types, setTypes] = useState(null);
  const [pick, setPick] = useState(null);
  const [guest, setGuest] = useState({ name: '', phone: '', email: '', specialRequests: '' });
  const [payment, setPayment] = useState({ paymentMethod: 'cash', paymentReference: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = async (e) => {
    e?.preventDefault();
    setError('');
    setPick(null);
    try {
      const res = await api.get('/desk/availability', auth({
        params: { checkIn: stay.checkIn, checkOut: stay.checkOut, guests: Number(stay.adults) + Number(stay.children) },
      }));
      setTypes(res.data.types);
    } catch (err) {
      setTypes(null);
      setError(errMsg(err, 'Could not check availability'));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post(
        '/desk/bookings',
        {
          roomUnitId: pick.unit.id,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          adults: Number(stay.adults),
          children: Number(stay.children),
          ...guest,
          ...payment,
        },
        auth()
      );
      onCreated(res.data.booking);
    } catch (err) {
      setError(errMsg(err, 'Could not create booking'));
      if (err?.response?.status === 409) search();
    } finally {
      setBusy(false);
    }
  };

  const setS = (k) => (e) => setStay((s) => ({ ...s, [k]: e.target.value }));
  const setG = (k) => (e) => setGuest((g) => ({ ...g, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <form onSubmit={search} className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-5 sm:items-end">
        <div>
          <label className="label">Check-in</label>
          <input aria-label="Check-in" type="date" required min={today} className="input-field py-2" value={stay.checkIn} onChange={(e) => setStay((s) => ({ ...s, checkIn: e.target.value, checkOut: s.checkOut <= e.target.value ? addDays(e.target.value, 1) : s.checkOut }))} />
        </div>
        <div>
          <label className="label">Check-out</label>
          <input aria-label="Check-out" type="date" required min={addDays(stay.checkIn, 1)} className="input-field py-2" value={stay.checkOut} onChange={setS('checkOut')} />
        </div>
        <div>
          <label className="label">Adults</label>
          <input aria-label="Adults" type="number" min={1} max={10} className="input-field py-2" value={stay.adults} onChange={setS('adults')} />
        </div>
        <div>
          <label className="label">Children</label>
          <input aria-label="Children" type="number" min={0} max={10} className="input-field py-2" value={stay.children} onChange={setS('children')} />
        </div>
        <button className="btn-gold col-span-2 py-2.5 sm:col-span-1">Find rooms</button>
      </form>

      {types && (
        <div className="card p-4">
          <RoomPicker types={types} selectedId={pick?.unit.id} onSelect={(unit, roomType, quote) => setPick({ unit, roomType, quote })} />
        </div>
      )}

      {pick && (
        <form onSubmit={submit} className="card space-y-4 p-4">
          <p className="text-sm text-navy-200">
            Room <span className="font-semibold text-navy-50">{pick.unit.unitNumber}</span> · {pick.roomType.name} · {stay.checkIn} → {stay.checkOut}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Guest name</label>
              <input aria-label="Guest name" required className="input-field py-2" value={guest.name} onChange={setG('name')} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input aria-label="Phone" required type="tel" className="input-field py-2" value={guest.phone} onChange={setG('phone')} placeholder="+91 …" />
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input aria-label="Email (optional)" type="email" className="input-field py-2" value={guest.email} onChange={setG('email')} />
            </div>
          </div>
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3">
            <p className="mb-2 text-sm text-navy-100">
              Collect full payment: <span className="font-semibold text-gold-600">{inr(pick.quote.total)}</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
              <select className="input-field py-2" value={payment.paymentMethod} onChange={(e) => setPayment((p) => ({ ...p, paymentMethod: e.target.value }))}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
              <input required minLength={2} className="input-field py-2" placeholder="Reference — receipt no. / UPI UTR / card slip no." value={payment.paymentReference} onChange={(e) => setPayment((p) => ({ ...p, paymentReference: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="btn-gold w-full disabled:opacity-60">{busy ? 'Saving…' : 'Confirm booking & payment'}</button>
          <p className="text-center text-xs text-navy-400">Counter bookings are confirmed immediately. Record the guest's ID at check-in.</p>
        </form>
      )}
      {!pick && error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
