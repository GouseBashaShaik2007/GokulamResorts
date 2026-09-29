import Link from 'next/link';
import { CONTACT, directionsUrl, whatsappUrl } from '@/lib/site';

export default function Footer() {
  const wa = whatsappUrl();
  return (
    <footer className="border-t border-night-800 bg-night text-white/70">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <h3 className="font-serif text-2xl font-semibold text-gold-300">Gokulam Resorts</h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed">
            A beachfront escape on Chirala Beach, Andhra Pradesh — where the Bay of Bengal meets
            timeless hospitality.
          </p>
          <p className="mt-4 text-sm text-gold-300">Best rate when you book direct.</p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Contact</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <a href={directionsUrl()} target="_blank" rel="noopener noreferrer" className="hover:text-gold-300">
                {CONTACT.address}
              </a>
            </li>
            {CONTACT.phone && (
              <li><a href={`tel:${CONTACT.phone.replace(/s/g, '')}`} className="hover:text-gold-300">{CONTACT.phone}</a></li>
            )}
            {wa && <li><a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-gold-300">WhatsApp us</a></li>}
            <li><a href={`mailto:${CONTACT.email}`} className="hover:text-gold-300">{CONTACT.email}</a></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Explore</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/rooms" className="hover:text-gold-300">Rooms &amp; Suites</Link></li>
            <li><Link href="/dining" className="hover:text-gold-300">Dining</Link></li>
            <li><Link href="/dine" className="hover:text-gold-300">Dine With Us — order</Link></li>
            <li><Link href="/gallery" className="hover:text-gold-300">Gallery</Link></li>
            <li><Link href="/chirala-guide" className="hover:text-gold-300">Chirala Guide</Link></li>
            <li><Link href="/faq" className="hover:text-gold-300">FAQ &amp; Policies</Link></li>
            <li><Link href="/booking/status" className="hover:text-gold-300">My Booking</Link></li>
            <li><Link href="/contact" className="hover:text-gold-300">Contact Us</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-night-800 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Gokulam Resorts, Chirala Beach. All rights reserved.
      </div>
    </footer>
  );
}
