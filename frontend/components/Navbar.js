'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useBookingPanel } from './booking/BookingContext';
import { CurrencySwitcher } from './site/Currency';

// Always in the bar on desktop.
const mainLinks = [
  { href: '/', label: 'Home' },
  { href: '/rooms', label: 'Rooms' },
  { href: '/dining', label: 'Dining' },
  { href: '/booking/status', label: 'My Booking' },
  { href: '/contact', label: 'Contact' },
];
// Under "More" on desktop; listed in full in the phone menu.
const moreLinks = [
  { href: '/gallery', label: 'Gallery' },
  { href: '/chirala-guide', label: 'Chirala Guide' },
  { href: '/faq', label: 'FAQ & Policies' },
];

// The rest of the site, behind one button so the bar stays short.
function MoreMenu({ overHero, isActive }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const pathname = usePathname();
  const anyActive = moreLinks.some((link) => isActive(link.href));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      ref.current?.querySelector('button')?.focus();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="more-menu"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 whitespace-nowrap text-sm font-medium transition-colors ${
          overHero ? 'text-white hover:text-white/75' : 'text-navy-100 hover:text-ocean-500'
        } ${anyActive ? 'underline decoration-gold-400 decoration-2 underline-offset-8' : ''}`}
      >
        More
        <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
      </button>
      {open && (
        <ul id="more-menu" className="absolute right-0 top-full z-50 mt-3 w-48 rounded-xl border border-navy-700 bg-navy-950 py-2 shadow-xl">
          {moreLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={`block px-4 py-2 text-sm hover:bg-navy-800 ${isActive(link.href) ? 'font-semibold text-ocean-600' : 'text-navy-100'}`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const topMarker = useRef(null);
  const { openBooking } = useBookingPanel();
  const pathname = usePathname();
  // Transparent only while sitting on top of the home page's full-bleed hero.
  const overHero = pathname === '/' && !scrolled && !open;
  const isActive = (href) => (href === '/rooms' ? pathname.startsWith('/rooms') : pathname === href);

  // Only the home page has a hero to float over. There, a marker covering the
  // top 40px of the page tells us when it has scrolled out of view — the
  // browser reports that once, where a scroll listener would run on every frame.
  useEffect(() => {
    if (pathname !== '/' || !topMarker.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    observer.observe(topMarker.current);
    return () => {
      observer.disconnect();
      setScrolled(false);
    };
  }, [pathname]);

  return (
    <>
    <div ref={topMarker} className="pointer-events-none absolute left-0 top-0 h-10 w-px" aria-hidden="true" />
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        overHero ? 'border-transparent bg-gradient-to-b from-black/50 to-transparent' : 'border-navy-700 bg-navy-950 shadow-sm'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8" aria-label="Main">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className={`font-serif text-2xl font-semibold tracking-wide ${overHero ? 'text-white' : 'text-gold-600'}`}>Gokulam</span>
          <span className={`hidden text-sm uppercase tracking-[0.3em] sm:inline lg:hidden xl:inline ${overHero ? 'text-white/80' : 'text-navy-200'}`}>Resorts</span>
        </Link>

        <div className="hidden items-center gap-5 lg:flex xl:gap-8">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={`whitespace-nowrap text-sm font-medium transition-colors ${
                overHero ? 'text-white hover:text-white/75' : 'text-navy-100 hover:text-ocean-500'
              } ${isActive(link.href) ? 'underline decoration-gold-400 decoration-2 underline-offset-8' : ''}`}
            >
              {link.label}
            </Link>
          ))}
          <MoreMenu overHero={overHero} isActive={isActive} />

          <CurrencySwitcher />
          <button type="button" onClick={() => openBooking()} className="btn-gold whitespace-nowrap px-5 py-2 text-sm">
            Book Now
          </button>
        </div>

        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          className={`flex h-10 w-10 items-center justify-center rounded-full border lg:hidden ${overHero ? 'border-white/60 text-white' : 'border-gold-500/40 text-gold-600'}`}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-navy-800 bg-navy-950 px-4 pb-4 lg:hidden">
          <div className="flex flex-col gap-1 pt-3">
            {[...mainLinks, ...moreLinks].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 hover:bg-navy-800 hover:text-gold-600 ${isActive(link.href) ? 'font-semibold text-ocean-600' : 'text-navy-100'}`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <CurrencySwitcher className="px-3 pt-2" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openBooking();
              }}
              className="btn-gold mt-2 text-center"
            >
              Book Now
            </button>
          </div>
        </div>
      )}
    </header>
    </>
  );
}
