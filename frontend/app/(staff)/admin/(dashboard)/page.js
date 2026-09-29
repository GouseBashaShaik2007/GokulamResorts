'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api, { withAdminAuth } from '@/lib/api';

function todayIST() {
  // Resort operates on IST regardless of the browser/server timezone.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

function StatCard({ label, value, hint, href }) {
  const body = (
    <div className="card h-full p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">{label}</p>
      <p className="mt-2 font-serif text-3xl font-bold text-navy-50">{value}</p>
      {hint && <p className="mt-1 text-xs text-navy-400">{hint}</p>}
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

    async function load() {
      try {
        const [overviewRes, unitsRes, ordersRes, bookingsRes] = await Promise.all([
          api.get('/desk/overview', withAdminAuth()),
          api.get('/admin/room-units', withAdminAuth()),
          api.get('/admin/food-orders', withAdminAuth()),
          api.get('/desk/bookings', withAdminAuth()).catch(() => ({ data: { bookings: [] } })),
        ]);
        if (cancelled) return;

        const { arrivals, inHouse, departures, awaitingApproval, pendingRefunds } = overviewRes.data;
        const units = unitsRes.data.units.filter((u) => u.is_active);
        const dirty = units.filter((u) => u.status !== 'Ready').length;
        const occupancyPct = units.length > 0 ? Math.round((inHouse.length / units.length) * 100) : 0;

        const openOrders = ordersRes.data.orders.filter((o) => ['new', 'preparing', 'ready'].includes(o.status));

        const today = todayIST();
        const revenueToday = bookingsRes.data.bookings
          .filter((b) => b.paid_at && b.paid_at.slice(0, 10) === today)
          .reduce((sum, b) => sum + Number(b.amount_paid || 0), 0);

        setStats({
          arrivals: arrivals.length,
          departures: departures.length,
          inHouse: inHouse.length,
          occupancyPct,
          totalUnits: units.length,
          dirty,
          openOrders: openOrders.length,
          awaitingApproval: awaitingApproval.length,
          pendingRefunds: pendingRefunds.length,
          revenueToday,
        });
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Could not load the overview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Today, {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h1 className="section-heading mt-1">Overview</h1>
      </div>

      {error && <p className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      {loading ? (
        <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-navy-800" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Arrivals Today" value={stats.arrivals} href="/admin/bookings" />
          <StatCard label="Departures Today" value={stats.departures} href="/admin/bookings" />
          <StatCard label="Occupancy" value={`${stats.occupancyPct}%`} hint={`${stats.inHouse} of ${stats.totalUnits} rooms`} />
          <StatCard label="Revenue Today" value={`₹${stats.revenueToday.toLocaleString('en-IN')}`} hint="Payments captured today" />
          <StatCard label="Open Food Orders" value={stats.openOrders} href="/admin/orders" />
          <StatCard label="Rooms Needing Cleaning" value={stats.dirty} href="/admin/housekeeping" />
          <StatCard label="Awaiting Approval" value={stats.awaitingApproval} hint="Bookings needing a decision" href="/admin/bookings" />
          <StatCard label="Refunds to Pay Out" value={stats.pendingRefunds} href="/admin/bookings" />
        </div>
      ) : null}
    </div>
  );
}
