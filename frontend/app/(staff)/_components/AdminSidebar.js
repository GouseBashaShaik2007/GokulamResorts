'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import useModal from '@/lib/useModal';

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
        active ? 'bg-ocean-500 text-white' : 'text-ink-700 hover:bg-sand-200 hover:text-ink-900'
      }`}
    >
      {item.label}
    </Link>
  );
}

function NavBody({ email, pathname, onNavigate, onSignOut }) {
  return (
    <>
      <nav className="space-y-1" aria-label="Admin">
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
        ))}
      </nav>
      <div className="mt-6 border-t border-sand-200 pt-4">
        <p className="truncate text-xs text-ink-400" title={email}>{email}</p>
        <button onClick={onSignOut} className="btn-outline mt-2 w-full px-3 py-1.5 text-xs">
          Log Out
        </button>
      </div>
    </>
  );
}

/**
 * The admin's navigation. From desktop width it is a sidebar. On a phone it
 * is a bar with a Menu button, and the links slide in over the page as a
 * drawer — the page underneath stays where it was instead of being pushed down.
 */
export default function AdminSidebar({ email, onSignOut }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const drawerRef = useModal(open, close); // focus stays in the drawer; Escape closes it

  // A drawer left open must not follow the screen to desktop width.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const onChange = () => wide.matches && setOpen(false);
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, []);

  const here = NAV.find((item) => (item.exact ? pathname === item.href : pathname.startsWith(item.href)));

  return (
    <>
      {/* Phone and tablet: a bar, and the drawer it opens. */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-sand-200 bg-sand-50 px-4 py-3 lg:hidden no-print">
        <span className="font-serif text-lg font-bold text-gold-600">
          Gokulam Admin{here && <span className="ml-2 font-sans text-sm font-medium text-ink-500">· {here.label}</span>}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-drawer"
          className="rounded-lg border border-sand-300 px-3 py-1.5 text-sm text-ink-700"
        >
          Menu
        </button>
      </div>

      {open && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/50" onClick={close} aria-hidden="true" />
          <div
            id="admin-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            tabIndex={-1}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-sand-200 bg-sand-50 px-4 py-5 shadow-2xl focus:outline-none"
          >
            <div className="mb-5 flex items-center justify-between">
              <p className="font-serif text-xl font-bold text-ink-900">Admin</p>
              <button type="button" onClick={close} className="rounded-lg border border-sand-300 px-3 py-1.5 text-sm text-ink-700">
                Close
              </button>
            </div>
            <NavBody email={email} pathname={pathname} onNavigate={close} onSignOut={onSignOut} />
          </div>
        </div>
      )}

      {/* Desktop: always there, beside the page. */}
      <aside className="hidden w-64 shrink-0 border-r border-sand-200 bg-sand-50 px-4 py-6 lg:block no-print">
        <div className="mb-6">
          <p className="eyebrow">Gokulam Resorts</p>
          <p className="font-serif text-xl font-bold text-ink-900">Admin</p>
        </div>
        <NavBody email={email} pathname={pathname} onSignOut={onSignOut} />
      </aside>
    </>
  );
}
