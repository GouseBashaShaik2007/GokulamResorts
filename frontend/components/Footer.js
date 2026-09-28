export default function Footer() {
  return (
    <footer className="border-t border-navy-800 bg-navy-950">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h3 className="font-serif text-xl font-bold text-gold-400">Gokulam Resorts</h3>
          <p className="mt-3 text-sm leading-relaxed text-navy-300">
            A luxury beachfront escape on Chirala Beach, Andhra Pradesh — where the Bay of Bengal
            meets timeless hospitality.
          </p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-100">Contact</h4>
          <ul className="space-y-2 text-sm text-navy-300">
            <li>Chirala Beach Road, Chirala, Andhra Pradesh 523155, India</li>
            <li>+91 98765 43210</li>
            <li>reservations@gokulamresorts.in</li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-100">Explore</h4>
          <ul className="space-y-2 text-sm text-navy-300">
            <li><a href="/rooms" className="hover:text-gold-400">Rooms &amp; Suites</a></li>
            <li><a href="/kiosk" className="hover:text-gold-400">Order Food</a></li>
            <li><a href="/contact" className="hover:text-gold-400">Contact Us</a></li>
            <li><a href="/admin" className="hover:text-gold-400">Resort Admin</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-800 py-4 text-center text-xs text-navy-400">
        © {new Date().getFullYear()} Gokulam Resorts, Chirala Beach. All rights reserved.
      </div>
    </footer>
  );
}
