'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useBooking } from './booking/BookingContext';

const publicLinks = [
  { href: '/', label: 'Home' },
  { href: '/rooms', label: 'Rooms' },
  { href: '/kiosk', label: 'Order Food' },
  { href: '/booking/status', label: 'My Booking' },
  { href: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { openBooking } = useBooking();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled ? 'border-gold-500/20 bg-navy-950/90 backdrop-blur' : 'border-transparent bg-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="font-serif text-2xl font-semibold tracking-wide text-gold-400">Gokulam</span>
          <span className="hidden text-sm uppercase tracking-[0.3em] text-navy-200 sm:inline lg:hidden xl:inline">Resorts</span>
        </Link>

        <div className="hidden items-center gap-5 lg:flex xl:gap-8">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm font-medium text-navy-100 transition-colors hover:text-gold-400"
            >
              {link.label}
            </Link>
          ))}

          <button type="button" onClick={() => openBooking()} className="btn-gold whitespace-nowrap px-5 py-2 text-sm">
            Book Now
          </button>
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
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-navy-100 hover:bg-navy-800 hover:text-gold-400"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openBooking();
              }}
              className="btn-gold mt-1 text-center"
            >
              Book Now
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
