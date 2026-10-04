'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api, { withAdminAuth } from '@/lib/api';
import { errMsg, fmtDateTime } from '@/lib/bookingUi';

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// `action`: this number is something waiting on the manager, so when it is
// above zero the card is tinted and says so.
function StatCard({ label, value, hint, href, action = false }) {
  const waiting = action && Number(value) > 0;
  const body = (
    <div className={`card h-full p-5 ${waiting ? 'border-gold-500 bg-gold-500/10' : ''} ${href ? 'transition-colors hover:border-ocean-400' : ''}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${waiting ? 'text-gold-700' : 'text-navy-400'}`}>{label}</p>
      <p className="mt-2 font-serif text-3xl font-bold text-navy-50">{value}</p>
      {hint && <p className={`mt-1 text-xs ${waiting ? 'font-medium text-gold-700' : 'text-navy-400'}`}>{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // One request: the API counts everything for today on the resort's own calendar.
    async function load() {
      try {
        const res = await api.get('/admin/stats/today', withAdminAuth());
        if (cancelled) return;
        if (res.data.stats.arrivals === undefined) {
          setError('The API server is running an older version. Restart it to see today’s numbers.');
          return;
        }
        setStats(res.data.stats);
        setError('');
      } catch (err) {
        if (!cancelled) setError(errMsg(err, 'Could not load the overview.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    // Keep the numbers current while the page stays open.
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const occupancy = stats && stats.rooms > 0 ? Math.round((stats.inHouse / stats.rooms) * 100) : 0;

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Today, {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}</p>
        <h1 className="section-heading mt-1">Overview</h1>
      </div>

      {error && <p role="alert" className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-navy-800" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* What is waiting on a decision or an action comes first. */}
          <StatCard
            action
            label="Awaiting Approval"
            value={stats.awaitingApproval}
            hint={stats.approvalDeadline ? `First one auto-cancels ${fmtDateTime(stats.approvalDeadline)}` : 'Bookings needing a decision'}
            href="/admin/bookings"
          />
          <StatCard action label="Refunds to Pay Out" value={stats.pendingRefunds} hint={stats.pendingRefunds > 0 ? 'At the counter' : undefined} href="/admin/bookings" />
          <StatCard label="Open Food Orders" value={stats.openFoodOrders} href="/admin/orders" />
          <StatCard label="Rooms Needing Cleaning" value={stats.roomsNotReady} href="/admin/housekeeping" />

          <StatCard label="Arrivals Today" value={stats.arrivals} href="/admin/bookings" />
          <StatCard label="Departures Today" value={stats.departures} href="/admin/bookings" />
          <StatCard label="Occupancy" value={`${occupancy}%`} hint={`${stats.inHouse} of ${stats.rooms} rooms`} />
          <StatCard
            label="Payments Today"
            value={rupees(stats.paymentsToday)}
            hint={stats.refundsToday > 0 ? `Online and counter · ${rupees(stats.refundsToday)} refunded` : 'Online and counter'}
          />
        </div>
      ) : null}
    </div>
  );
}
