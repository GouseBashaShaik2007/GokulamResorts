'use client';

import { useBooking } from '../BookingContext';
import { todayIST } from '../../../lib/bookingUi';
import DateRangePicker from '../DateRangePicker';

export default function StayStep() {
  const { stay, setStay, datesValid, goTo, error, adults, children: kids } = useBooking();

  const setField = (k) => (e) => setStay({ [k]: e.target.value });

  const handleContinue = () => {
    if (!datesValid) return;
    goTo('room');
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Step 1 of 4</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-navy-50">Dates &amp; Guests</h2>
      </div>

      <div role="group" aria-labelledby="stay-dates-label">
        <p className="label" id="stay-dates-label">Check-in &amp; check-out</p>
        <div className="input-field">
          <DateRangePicker
            checkIn={stay.checkIn}
            checkOut={stay.checkOut}
            onChange={({ checkIn, checkOut }) => setStay({ checkIn, checkOut })}
            minDateISO={todayIST()}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="stayAdults">Adults</label>
          <input
            id="stayAdults" type="number" min={1} max={10} required className="input-field"
            value={stay.adults} onChange={setField('adults')}
            onBlur={() => stay.adults === '' && setStay({ adults })}
          />
        </div>
        <div>
          <label className="label" htmlFor="stayChildren">Children</label>
          <input
            id="stayChildren" type="number" min={0} max={6} className="input-field"
            value={stay.children} onChange={setField('children')}
            onBlur={() => stay.children === '' && setStay({ children: kids })}
          />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <button type="button" onClick={handleContinue} disabled={!datesValid} className="btn-gold w-full disabled:opacity-60">
        Check Availability
      </button>
    </div>
  );
}
