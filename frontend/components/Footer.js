const ADDRESS = 'Chirala Beach Road, Chirala, Andhra Pradesh 523155, India';
const PHONE = '+91 98765 43210';
const EMAIL = 'reservations@gokulamresorts.in';

export default function Footer() {
  return (
    <footer className="border-t border-night-800 bg-night text-white/70">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h3 className="font-serif text-2xl font-semibold text-gold-300">Gokulam Resorts</h3>
          <p className="mt-3 text-sm leading-relaxed">
            A luxury beachfront escape on Chirala Beach, Andhra Pradesh — where the Bay of Bengal
            meets timeless hospitality.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Contact</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(ADDRESS)}`}
                target="_blank" rel="noopener noreferrer"
                className="hover:text-gold-300"
              >
                {ADDRESS}
              </a>
            </li>
            <li><a href={`tel:${PHONE.replace(/\s/g, '')}`} className="hover:text-gold-300">{PHONE}</a></li>
            <li><a href={`mailto:${EMAIL}`} className="hover:text-gold-300">{EMAIL}</a></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white">Explore</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="/rooms" className="hover:text-gold-300">Rooms &amp; Suites</a></li>
            <li><a href="/kiosk" className="hover:text-gold-300">Order Food</a></li>
            <li><a href="/contact" className="hover:text-gold-300">Contact Us</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-night-800 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Gokulam Resorts, Chirala Beach. All rights reserved.
      </div>
    </footer>
  );
}
