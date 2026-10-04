'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/rooms', label: 'Rooms' },
  { href: '/admin/menu', label: 'Menu' },
  { href: '/admin/orders', label: 'Food Orders' },
  { href: '/admin/housekeeping', label: 'Housekeeping' },
  { href: '/admin/staff', label: 'Staff' },
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
      aria-current={active ? 'page' : undefined}
      className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-ocean-500 text-white' : 'text-navy-200 hover:bg-navy-800 hover:text-navy-50'
      }`}
    >
      {item.label}
    </Link>
  );
}

/** The admin's navigation: a bar with a Menu button on phones, a sidebar from desktop width. */
export default function AdminSidebar({ email, onSignOut }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-navy-800 bg-navy-950 px-4 py-3 lg:hidden">
        <span className="font-serif text-lg font-bold text-gold-600">Gokulam Admin</span>
        <button
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-expanded={mobileNavOpen}
          aria-controls="admin-nav"
          className="rounded-lg border border-navy-700 px-3 py-1.5 text-sm text-navy-200"
        >
          {mobileNavOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      <aside
        id="admin-nav"
        className={`w-full shrink-0 border-b border-navy-800 bg-navy-950 lg:block lg:w-64 lg:border-b-0 lg:border-r lg:px-4 lg:py-6 ${
          mobileNavOpen ? 'block px-4 py-4' : 'hidden lg:block'
        }`}
      >
        <div className="hidden lg:block">
          <p className="eyebrow">Gokulam Resorts</p>
          <p className="font-serif text-xl font-bold text-navy-50">Admin</p>
        </div>
        <nav className="mt-6 space-y-1" aria-label="Admin">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setMobileNavOpen(false)} />
          ))}
        </nav>
        <div className="mt-6 border-t border-navy-800 pt-4">
          <p className="truncate text-xs text-navy-400" title={email}>{email}</p>
          <button onClick={onSignOut} className="btn-outline mt-2 w-full px-3 py-1.5 text-xs">
            Log Out
          </button>
        </div>
      </aside>
    </>
  );
}
