'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import NameTiles from '../../_components/NameTiles';
import PinPad from '../../_components/PinPad';
import useStaffLogin from '../../_lib/useStaffLogin';

// The API answers 401 for a wrong PIN; say what to do about it.
const messageFor = (err) =>
  err?.response?.status === 401 ? 'Wrong PIN. Try again, or ask the manager to set a new one in Admin → Staff.' : null;

/**
 * Kitchen sign-in: tap your name, then type your PIN. Choosing the name first
 * means a PIN is only ever checked against one cook.
 */
export default function KitchenSignIn() {
  const [cooks, setCooks] = useState(null); // null while loading
  const [loadError, setLoadError] = useState(false);
  const [who, setWho] = useState(null);
  const { signIn, error, loading, clearError } = useStaffLogin('kitchen', { messageFor });

  useEffect(() => {
    api
      .get('/kitchen/cooks')
      .then((res) => setCooks(res.data.cooks))
      .catch(() => setLoadError(true));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 py-10 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Kitchen</p>

      {who ? (
        <div className="mt-2 w-full max-w-md">
          <h1 className="sr-only">Kitchen sign-in</h1>
          <PinPad
            name={who.name}
            tone="dark"
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
        <div className="mt-2 w-full max-w-xl text-center">
          <h1 className="text-3xl font-bold">Who is cooking?</h1>
          <p className="mt-2 text-neutral-400">Tap your name, then enter your PIN.</p>
          <div className="mt-8">
            {loadError && (
              <p role="alert" className="text-sm font-semibold text-red-400">
                The names could not be loaded. Check the connection and reload this page.
              </p>
            )}
            {!loadError && cooks === null && <p className="text-neutral-500" role="status">Loading names…</p>}
            {cooks?.length === 0 && (
              <p className="text-neutral-300">No kitchen staff have been added yet. The manager adds them in Admin → Staff.</p>
            )}
            {cooks?.length > 0 && <NameTiles people={cooks} tone="dark" onPick={setWho} />}
          </div>
        </div>
      )}
    </div>
  );
}
