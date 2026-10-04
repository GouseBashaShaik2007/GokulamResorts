'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api, { withAdminAuth } from '@/lib/api';
import { errMsg, fmtDateTime, inr as rupees } from '@/lib/bookingUi';
import PageHeader from '@/components/ui/PageHeader';

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

const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const weekday = (iso) =>
  new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

// Arrivals for each of the next seven days: bars sized against the busiest day.
function ComingWeek({ days }) {
  const busiest = Math.max(1, ...days.map((d) => d.arrivals));
  const total = days.reduce((sum, d) => sum + d.arrivals, 0);
  return (
    <section className="card mt-6 p-5" aria-labelledby="coming-week">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="coming-week" className="text-xs font-semibold uppercase tracking-wide text-navy-400">Arrivals, next 7 days</h2>
        <p className="text-sm text-navy-300">{total} booking{total === 1 ? '' : 's'} arriving</p>
      </div>
      <ol className="mt-4 space-y-2">
        {days.map((d) => (
          <li key={d.date} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 text-sm">
            <span className="text-navy-200">{weekday(d.date)}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-navy-800" aria-hidden="true">
              <span className="block h-full rounded-full bg-ocean-500" style={{ width: `${(d.arrivals / busiest) * 100}%` }} />
            </span>
            <span className="text-right font-semibold text-navy-50 [font-variant-numeric:tabular-nums]">{d.arrivals}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Overview() {
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

  // "Yesterday" figures arrive only from an API new enough to count them.
  const hasYesterday = stats && stats.paymentsYesterday !== undefined;
  const paymentsHint = stats && [
    'Online and counter',
    hasYesterday && `yesterday ${rupees(stats.paymentsYesterday)}`,
    stats.refundsToday > 0 && `${rupees(stats.refundsToday)} refunded`,
  ].filter(Boolean).join(' · ');
  const occupancyHint = stats && [
    `${stats.inHouse} of ${stats.rooms} rooms`,
    hasYesterday && `last night ${percent(stats.inHouseYesterday, stats.rooms)}%`,
  ].filter(Boolean).join(' · ');

  return (
    <div>
      <PageHeader
        size="section"
        className="mb-8"
        eyebrow={`Today, ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}`}
        title="Overview"
      />

      {error && <p role="alert" className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-navy-800" />
          ))}
        </div>
      ) : stats ? (
        <>
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
            <StatCard label="Occupancy" value={`${percent(stats.inHouse, stats.rooms)}%`} hint={occupancyHint} />
            <StatCard label="Payments Today" value={rupees(stats.paymentsToday)} hint={paymentsHint} />
          </div>
          {stats.comingWeek?.length > 0 && <ComingWeek days={stats.comingWeek} />}
        </>
      ) : null}
    </div>
  );
}
