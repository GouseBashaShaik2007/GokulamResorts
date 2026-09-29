'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import StaffSkeleton from '../../_components/StaffSkeleton';
import { clearSignedIn } from '../../_lib/session';

const TOKEN_KEY = 'gokulam_admin_token';

const NAV = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/rooms', label: 'Rooms' },
  { href: '/admin/menu', label: 'Menu' },
  { href: '/admin/orders', label: 'Food Orders' },
  { href: '/admin/housekeeping', label: 'Housekeeping' },
  { href: '/admin/offers', label: 'Offers' },
  { href: '/admin/qr-codes', label: 'QR Codes' },
  { href: '/admin/settings', label: 'Settings' },
];

function NavLink({ item, pathname, onClick }) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-gold-500 text-navy-950' : 'text-navy-200 hover:bg-navy-800 hover:text-navy-50'
      }`}
    >
      {item.label}
    </Link>
  );
}

export default function AdminDashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const goToLogin = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    clearSignedIn('admin');
    router.replace('/admin/login');
  };

  useEffect(() => {
    // middleware.js already redirected here if the session cookie was
    // missing; this covers a token that expired or an account deactivated
    // mid-session, without a full navigation.
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) {
      goToLogin();
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setAdminEmail(payload.email || '');
    } catch {
      // cosmetic only — a malformed token still fails on the first API call
    }
    const id = api.interceptors.response.use(undefined, (err) => {
      if (err?.response?.status === 401) goToLogin();
      return Promise.reject(err);
    });
    setReady(true);
    return () => api.interceptors.response.eject(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return <StaffSkeleton />;

  return (
    <div className="admin-shell min-h-screen bg-navy-950 lg:flex">
      {/* Admin-only overrides: real white inputs on the sand card background
          (the shared .input-field is tuned for the guest site's cards), and a
          stable scrollbar gutter so switching sections doesn't shift the page
          sideways when a section's content does/doesn't need a scrollbar. */}
      <style jsx global>{`
        html {
          scrollbar-gutter: stable;
        }
        .admin-shell .input-field {
          background: #ffffff;
          border-color: #e4d6bf;
        }
        .admin-shell .input-field:focus {
          border-color: #0e4f5c;
          box-shadow: 0 0 0 1px #0e4f5c;
        }
      `}</style>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-navy-800 bg-navy-950 px-4 py-3 lg:hidden">
        <span className="font-serif text-lg font-bold text-gold-400">Gokulam Admin</span>
        <button
          onClick={() => setMobileNavOpen((v) => !v)}
          className="rounded-lg border border-navy-700 px-3 py-1.5 text-sm text-navy-200"
        >
          {mobileNavOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      <aside
        className={`w-full shrink-0 border-b border-navy-800 bg-navy-950 lg:block lg:w-64 lg:border-b-0 lg:border-r lg:px-4 lg:py-6 ${
          mobileNavOpen ? 'block px-4 py-4' : 'hidden lg:block'
        }`}
      >
        <div className="hidden lg:block">
          <p className="eyebrow">Gokulam Resorts</p>
          <h1 className="font-serif text-xl font-bold text-navy-50">Admin</h1>
        </div>
        <nav className="mt-6 space-y-1">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setMobileNavOpen(false)} />
          ))}
        </nav>
        <div className="mt-6 border-t border-navy-800 pt-4">
          <p className="truncate text-xs text-navy-400" title={adminEmail}>{adminEmail}</p>
          <button onClick={goToLogin} className="btn-outline mt-2 w-full px-3 py-1.5 text-xs">
            Log Out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
