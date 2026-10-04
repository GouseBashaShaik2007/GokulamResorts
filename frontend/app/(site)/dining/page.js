import Link from 'next/link';
import Reveal from '@/components/motion/Reveal';
import Photo from '@/components/ui/Photo';
import DiningMenu from '@/components/site/DiningMenu';
import PageHeader from '@/components/ui/PageHeader';
import { getContact, getMenuByCategory } from '@/lib/server-api';
import { jsonLd, restaurantJsonLd } from '@/lib/jsonLd';

export const metadata = {
  title: 'Dining',
  description:
    'The restaurant at Gokulam Resorts, Chirala Beach: coastal Andhra cooking, fresh seafood and vegetarian dishes. See the full menu with prices.',
};

// Stock stand-ins until the resort's own photos arrive.
const PHOTOS = [
  { src: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1400&q=80', alt: 'Open-air tables by the water' },
  { src: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80', alt: 'A plated main course' },
];

export default async function DiningPage() {
  const [menu, contact] = await Promise.all([getMenuByCategory(), getContact()]);

  return (
    <div>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <Reveal>
          <PageHeader eyebrow="Dining" title="Coastal cooking, unhurried">
            {/* TODO(owner): replace with the restaurant's own story, and add a chef section when details arrive. */}
            <p className="mt-6 leading-relaxed text-navy-300">
              Our kitchen cooks the food of the Andhra coast — fresh catch from the Bay of Bengal, slow curries and
              the vegetarian classics of the region — alongside familiar favourites for younger guests.
            </p>
          </PageHeader>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#menu" className="btn-gold">See the full menu</a>
            {/* For diners who aren't staying, and for groups: an enquiry, opened on "Dining". */}
            <Link href="/contact?reason=Dining" className="btn-outline">Reserve a table</Link>
          </div>
          {/* Ordering opens from the QR codes at the restaurant, not from this page. */}
          <p className="mt-4 max-w-md text-sm text-navy-300">At the restaurant? Scan the QR code on your table to order from your phone.</p>
        </Reveal>
        {/* One wide photo on a phone; the tall second one joins it from tablet width up. */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative h-56 overflow-hidden rounded-2xl sm:col-span-2 sm:h-80">
            <Photo src={PHOTOS[0].src} alt={PHOTOS[0].alt} data-placeholder="true" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 66vw, 100vw" priority />
          </div>
          <div className="relative hidden h-80 overflow-hidden rounded-2xl sm:block">
            <Photo src={PHOTOS[1].src} alt={PHOTOS[1].alt} data-placeholder="true" sizes="(min-width: 1024px) 17vw, 33vw" />
          </div>
        </div>
      </section>

      <section id="menu" className="scroll-mt-24 bg-navy-900 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="section-heading">Menu</h2>
          {menu.length === 0 ? (
            <p className="mt-6 text-navy-300">The menu isn&apos;t available right now. Please check back shortly.</p>
          ) : (
            <>
              <DiningMenu menu={menu} />
              <p className="mt-10 text-sm text-navy-400">
                Not every ingredient is listed. If you have an allergy, please tell our staff before you order.
              </p>
            </>
          )}
        </div>
      </section>

      {/* The restaurant and its menu in the format search engines read. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(restaurantJsonLd(contact, menu)) }} />
    </div>
  );
}
