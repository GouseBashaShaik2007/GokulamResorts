'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { authFor } from '../../lib/api';
import { useConfirm } from '@/components/ui/Confirm';
import { printRegistrationCard } from '../../lib/registrationCard';
import { CONTACT } from '../../lib/site';
import { StatusBadge, inr, fmtDate, fmtDateTime, nightsBetween, todayIST, errMsg } from '../../lib/bookingUi';
import { Shell, btn } from './detail/parts';
import { RejectCancelForm, DiscountForm, PaymentForm, ExtendForm, IdUploadForm } from './detail/forms';
import { StaySection, GuestSection, MoneySection, DocumentsSection, HistorySection } from './detail/sections';

/**
 * One booking, in a slide-over: what can be done with it now (buttons, and
 * the form each opens), then its stay, guest, money, IDs and history.
 * mode: 'desk' (front desk staff) or 'admin' (manager — also approves,
 * rejects, cancels, discounts and can open ID files).
 */
export default function BookingDetail({ bookingId, mode, onClose, onChanged, refreshKey }) {
  const auth = authFor(mode);
  const isAdmin = mode === 'admin';
  const ask = useConfirm();
  const [b, setB] = useState(null);
  const [panel, setPanel] = useState(null); // which form is open: reject | cancel | discount | payment | extend | upload
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // The resort's address as saved in Settings, for the printed registration card.
  const [resortAddress, setResortAddress] = useState(CONTACT.address);
  useEffect(() => {
    api.get('/site-info').then((res) => res.data.info?.address && setResortAddress(res.data.info.address)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/desk/bookings/${bookingId}`, auth());
      setB(res.data.booking);
    } catch (err) {
      setError(errMsg(err, 'Could not load booking'));
    }
  }, [bookingId, auth]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const open = (name) => {
    setPanel(panel === name ? null : name);
    setError('');
  };

  // Runs one change, then reloads the booking and tells the board behind it.
  const run = async (fn, success) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fn();
      setPanel(null);
      const warnings = res?.data?.warnings;
      setNotice([success, ...(warnings || [])].filter(Boolean).join(' · '));
      await load();
      onChanged?.();
    } catch (err) {
      setError(errMsg(err, 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const post = (path, body) => api.post(`/desk/bookings/${bookingId}${path}`, body || {}, auth());
  const adminPost = (path, body) => api.post(`/admin/bookings/${bookingId}${path}`, body || {}, auth());

  const viewDocument = async (doc) => {
    const win = window.open('', '_blank'); // open synchronously so popup blockers allow it
    try {
      const res = await api.get(`/admin/documents/${doc.id}/url`, auth());
      win.location = res.data.url;
      load();
    } catch (err) {
      win.close();
      setError(errMsg(err, 'Could not open document'));
    }
  };

  const removeDocument = async (doc) => {
    const ok = await ask({ title: `Remove the ID for ${doc.guest_name}?`, confirmLabel: 'Remove ID', danger: true });
    if (ok) run(() => api.delete(`/desk/bookings/${bookingId}/documents/${doc.id}`, auth()), 'ID removed');
  };

  if (!b) {
    return (
      <Shell onClose={onClose}>
        <p className="p-6 text-navy-300">{error || 'Loading…'}</p>
      </Shell>
    );
  }

  const today = todayIST();
  const due = Number(b.balance_due);
  const nights = nightsBetween(b.check_in, b.check_out);
  const hasPrimary = b.documents.some((d) => !d.purged_at && d.is_primary);
  const staying = ['confirmed', 'checked_in'].includes(b.status);

  // Everything a check-in needs, shown together so staff see every blocker at
  // once instead of fixing them one at a time.
  const checkInNeeds = b.status !== 'confirmed' ? [] : [
    { ok: today >= b.check_in, label: today >= b.check_in ? 'Arrival day reached' : `Check-in opens ${fmtDate(b.check_in)}` },
    { ok: due <= 0, label: due <= 0 ? 'Paid in full' : `Collect ${inr(due)}` },
    { ok: hasPrimary, label: hasPrimary ? 'Primary guest ID on file' : 'Add the primary guest’s ID' },
    { ok: b.room_status === 'Ready', label: b.room_status === 'Ready' ? 'Room ready' : `Room is ${String(b.room_status).toLowerCase()} — not ready yet` },
  ];
  const checkInBlocked = checkInNeeds.some((need) => !need.ok);

  const printCard = () => {
    if (!printRegistrationCard(b, resortAddress)) setError('The browser blocked the print window. Allow pop-ups for this site and try again.');
  };

  const checkOut = async () => {
    const early = today < b.check_out;
    const ok = !early || (await ask({
      title: 'Check out early?',
      body: `The stay ends today instead of ${fmtDate(b.check_out)}. There is no automatic refund for the unused nights.`,
      confirmLabel: 'Check out today',
    }));
    if (ok) run(() => post('/check-out'), 'Checked out — housekeeping notified');
  };

  const markNoShow = async () => {
    const ok = await ask({
      title: 'Mark as no-show?',
      body: 'The room is released and the payment is kept. There is no refund.',
      confirmLabel: 'Mark no-show',
      danger: true,
    });
    if (ok) run(() => post('/no-show'), 'Marked no-show');
  };

  return (
    <Shell onClose={onClose}>
      <div className="flex items-start justify-between gap-3 px-6 pt-6">
        <div>
          <p className="text-xs text-navy-400">
            Booking #{b.id} · {b.source === 'online' ? 'Online' : 'Counter'} · {fmtDateTime(b.created_at)}
          </p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-navy-50">{b.guest_name}</h2>
          <div className="mt-2">
            <StatusBadge status={b.status} />
          </div>
        </div>
        <button onClick={onClose} className="rounded-full border border-navy-600 px-3 py-1 text-navy-300 hover:text-navy-50" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="px-6 pb-8">
        {b.status === 'paid' && b.hold_expires_at && (
          <p className="mt-3 rounded-lg bg-gold-500/10 px-3 py-2 text-sm text-gold-700">
            Waiting for manager approval — auto-cancels with full refund at {fmtDateTime(b.hold_expires_at)}.
          </p>
        )}
        {b.close_reason && <p className="mt-3 rounded-lg bg-navy-800 px-3 py-2 text-sm text-navy-200">Reason: {b.close_reason}</p>}
        {notice && <p role="status" className="mt-3 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700">{notice}</p>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>}

        {checkInNeeds.length > 0 && (
          <ul className="mt-4 grid gap-1.5 rounded-xl border border-navy-700 p-3 text-sm sm:grid-cols-2" aria-label="Before check-in">
            {checkInNeeds.map((need) => (
              <li key={need.label} className={`flex items-center gap-2 ${need.ok ? 'text-green-700' : 'font-medium text-red-700'}`}>
                <span aria-hidden="true">{need.ok ? '✓' : '✕'}</span>
                <span className="sr-only">{need.ok ? 'Done:' : 'Still needed:'}</span>
                {need.label}
              </li>
            ))}
          </ul>
        )}

        {/* ---------------- Actions ---------------- */}
        <div className="mt-4 flex flex-wrap gap-2">
          {isAdmin && b.status === 'paid' && (
            <>
              <button disabled={busy} onClick={() => run(() => adminPost('/approve'), 'Approved — guest notified')} className={`${btn} bg-green-700 text-white`}>
                Approve
              </button>
              <button disabled={busy} onClick={() => open('reject')} className={`${btn} border border-red-500/60 text-red-700`}>Reject</button>
            </>
          )}
          {b.status === 'confirmed' && (
            <button disabled={busy || checkInBlocked} onClick={() => run(() => post('/check-in'), 'Checked in')} className={`${btn} bg-ocean-500 text-white`}>
              Check in
            </button>
          )}
          {b.status === 'checked_in' && (
            <button disabled={busy || due > 0} onClick={checkOut} className={`${btn} bg-ocean-500 text-white`}>
              Check out{due > 0 ? ` · collect ${inr(due)}` : ''}
            </button>
          )}
          {staying && due > 0 && (
            <button disabled={busy} onClick={() => open('payment')} className={`${btn} bg-green-700 text-white`}>
              Record payment
            </button>
          )}
          {staying && (
            <button disabled={busy} onClick={() => open('upload')} className={`${btn} border border-navy-600 text-navy-100`}>
              + Guest ID
            </button>
          )}
          {staying && (
            <button disabled={busy} onClick={() => open('extend')} className={`${btn} border border-navy-600 text-navy-100`}>
              Extend stay
            </button>
          )}
          {b.status === 'confirmed' && today >= b.check_in && (
            <button disabled={busy} onClick={markNoShow} className={`${btn} border border-orange-400/50 text-orange-700`}>
              No-show
            </button>
          )}
          {['confirmed', 'checked_in', 'checked_out'].includes(b.status) && (
            <button type="button" onClick={printCard} className={`${btn} border border-navy-600 text-navy-100`}>
              Print registration card
            </button>
          )}
          {isAdmin && ['paid', 'confirmed', 'checked_in'].includes(b.status) && (
            <button disabled={busy} onClick={() => open('discount')} className={`${btn} border border-gold-500/50 text-gold-600`}>
              Discount
            </button>
          )}
          {isAdmin && ['pending_payment', 'paid', 'confirmed'].includes(b.status) && (
            <button disabled={busy} onClick={() => open('cancel')} className={`${btn} border border-red-500/40 text-red-700`}>
              Cancel booking
            </button>
          )}
        </div>

        {/* ---------------- The form the pressed button opened ---------------- */}
        {(panel === 'reject' || panel === 'cancel') && (
          <RejectCancelForm
            key={panel}
            kind={panel}
            b={b}
            busy={busy}
            onSubmit={(reason) => run(() => adminPost(`/${panel}`, { reason }), panel === 'reject' ? 'Rejected — refund initiated' : 'Cancelled — refund initiated')}
          />
        )}
        {panel === 'discount' && <DiscountForm busy={busy} onSubmit={(discount) => run(() => adminPost('/discount', discount), 'Discount applied')} />}
        {panel === 'payment' && <PaymentForm due={due} busy={busy} onSubmit={(payment) => run(() => post('/payments', payment), 'Payment recorded')} />}
        {panel === 'extend' && <ExtendForm b={b} busy={busy} onSubmit={(newCheckOut) => run(() => post('/extend', { checkOut: newCheckOut }), 'Stay extended — collect the new balance')} />}
        {panel === 'upload' && (
          <IdUploadForm
            b={b}
            hasPrimary={hasPrimary}
            busy={busy}
            onSubmit={(data) =>
              run(() => api.post(`/desk/bookings/${bookingId}/documents`, data, auth({ headers: { 'Content-Type': 'multipart/form-data' } })), 'ID saved')
            }
          />
        )}

        {/* ---------------- Details ---------------- */}
        <StaySection b={b} nights={nights} />
        <GuestSection b={b} />
        <MoneySection
          b={b}
          nights={nights}
          due={due}
          auth={auth}
          onError={setError}
          onPayoutDone={() => {
            setNotice('Refund payout recorded');
            load();
            onChanged?.();
          }}
        />
        <DocumentsSection b={b} onView={isAdmin ? viewDocument : null} onRemove={removeDocument} />
        <HistorySection b={b} />
      </div>
    </Shell>
  );
}
