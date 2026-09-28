'use client';

import Link from 'next/link';
import { useState } from 'react';

const links = [
  { href: '/', label: 'Home' },
  { href: '/rooms', label: 'Rooms' },
  { href: '/kiosk', label: 'Order Food' },
  { href: '/booking/status', label: 'My Booking' },
  { href: '/contact', label: 'Contact' },
  { href: '/frontdesk', label: 'Front Desk' },
  { href: '/kitchen', label: 'Kitchen' },
  { href: '/admin', label: 'Admin' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gold-500/20 bg-navy-950/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="font-serif text-2xl font-bold tracking-wide text-gold-400">Gokulam</span>
          <span className="hidden text-sm uppercase tracking-[0.3em] text-navy-200 sm:inline lg:hidden xl:inline">Resorts</span>
        </Link>

        <div className="hidden items-center gap-5 lg:flex xl:gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm font-medium text-navy-100 transition-colors hover:text-gold-400"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/rooms" className="btn-gold whitespace-nowrap px-5 py-2 text-sm">
            Book Now
          </Link>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/40 text-gold-400 lg:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '✕' : '☰'}
        </button>
      </nav>

      {open && (
        <div className="border-t border-navy-800 bg-navy-950 px-4 pb-4 lg:hidden">
          <div className="flex flex-col gap-3 pt-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-navy-100 hover:bg-navy-800 hover:text-gold-400"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/rooms" className="btn-gold mt-1 text-center" onClick={() => setOpen(false)}>
              Book Now
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
