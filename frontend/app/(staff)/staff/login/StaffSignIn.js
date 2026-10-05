'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { LoginForm } from '../../_components/LoginCard';
import NameTiles from '../../_components/NameTiles';
import PinPad from '../../_components/PinPad';
import useStaffLogin from '../../_lib/useStaffLogin';

const ROLE_LABEL = { Bedding: 'Bedding', Toiletry: 'Toiletry', Inspector: 'Inspector' };

const messageFor = (err) =>
  err?.response?.status === 401 ? 'Wrong PIN. Try again, or ask your manager to set a new one.' : null;

// Housekeeping: tap your name, type your PIN — no typing a phone number and
// password on a small shared phone.
function HousekeepingSignIn({ people }) {
  const [who, setWho] = useState(null);
  const { signIn, error, loading, clearError } = useStaffLogin('staff', { endpoint: '/staff/pin-login', messageFor });

  return (
    <section className="card p-8" aria-labelledby="hk-sign-in">
      <p className="eyebrow">Housekeeping</p>
      {who ? (
        <div className="mt-4">
          <h1 id="hk-sign-in" className="sr-only">Housekeeping sign-in</h1>
          <PinPad
            name={who.name}
            tone="light"
            error={error}
            loading={loading}
            onSubmit={(pin) => signIn({ staffId: who.id, pin })}
            onBack={() => {
              clearError();
              setWho(null);
            }}
          />
        </div>
      ) : (
        <>
          <h1 id="hk-sign-in" className="mt-2 font-serif text-2xl font-bold text-ink-900">Tap your name</h1>
          <p className="mt-1 text-sm text-ink-400">Then enter your PIN.</p>
          <div className="mt-5">
            <NameTiles people={people} tone="light" onPick={setWho} subtitle={(p) => ROLE_LABEL[p.role] || p.role} />
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Staff sign-in. Housekeepers who have a PIN tap their name; the front desk
 * (and any housekeeper without a PIN) uses a phone number and password.
 * Where each lands afterwards depends on their role (see useStaffLogin).
 */
export default function StaffSignIn() {
  // Housekeepers with a PIN; [] until loaded, and if the list can't be read
  // the password form below still works for everyone.
  const [people, setPeople] = useState([]);

  useEffect(() => {
    api
      .get('/staff/housekeepers')
      .then((res) => setPeople(res.data.staff || []))
      .catch(() => {});
  }, []);

  const hasTiles = people.length > 0;

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-12 sm:px-6">
      <p className="text-center font-serif text-2xl font-semibold tracking-wide text-gold-600">Gokulam Resorts</p>
      {hasTiles && <HousekeepingSignIn people={people} />}
      <LoginForm
        section="staff"
        eyebrow={hasTiles ? 'Front desk' : 'Staff'}
        heading={hasTiles ? 'Sign in with a password' : 'Sign in'}
        headingAs={hasTiles ? 'h2' : 'h1'}
        idField={{
          name: 'phone',
          label: 'Phone number',
          type: 'tel',
          inputMode: 'tel',
          hint: 'The mobile number your manager registered for you. Spaces and +91 don’t matter.',
        }}
        help="Forgotten your password? Ask your manager — they can set a new one in Admin → Staff."
      />
    </div>
  );
}
