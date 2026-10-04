import Link from 'next/link';
import Reveal from '@/components/motion/Reveal';
import Photo from '@/components/ui/Photo';
import { VegMark } from '@/components/MenuItemCard';
import { getMenuByCategory } from '@/lib/server-api';

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
  const menu = await getMenuByCategory();

  return (
    <div>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <Reveal>
          <p className="eyebrow">Dining</p>
          <h1 className="display-heading mt-2 text-4xl md:text-5xl">Coastal cooking, unhurried</h1>
          {/* TODO(owner): replace with the restaurant's own story, and add a chef section when details arrive. */}
          <p className="mt-6 leading-relaxed text-navy-300">
            Our kitchen cooks the food of the Andhra coast — fresh catch from the Bay of Bengal, slow curries and
            the vegetarian classics of the region — alongside familiar favourites for younger guests.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dine" className="btn-gold">Order from the menu</Link>
            <a href="#menu" className="btn-outline">See the full menu</a>
          </div>
        </Reveal>
        <div className="grid grid-cols-3 gap-3">
          <div className="relative col-span-2 h-80 overflow-hidden rounded-2xl">
            <Photo src={PHOTOS[0].src} alt={PHOTOS[0].alt} data-placeholder="true" sizes="(min-width: 1024px) 33vw, 66vw" priority />
          </div>
          <div className="relative h-80 overflow-hidden rounded-2xl">
            <Photo src={PHOTOS[1].src} alt={PHOTOS[1].alt} data-placeholder="true" sizes="(min-width: 1024px) 17vw, 33vw" />
          </div>
        </div>
      </section>

      <section id="menu" className="bg-navy-900 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="section-heading">Menu</h2>
          {menu.length === 0 && <p className="mt-6 text-navy-300">The menu isn&apos;t available right now. Please check back shortly.</p>}
          <div className="mt-8 grid gap-12 md:grid-cols-2">
            {menu.map((cat) => (
              <div key={cat.id}>
                <h3 className="border-b border-navy-700 pb-2 font-serif text-2xl font-semibold text-navy-50">{cat.name}</h3>
                <ul className="mt-4 space-y-4">
                  {cat.items.map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <VegMark veg={item.is_veg} className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-medium text-navy-50">{item.name}</span>
                          <span className="price whitespace-nowrap">₹{Number(item.price).toLocaleString('en-IN')}</span>
                        </div>
                        {item.description && <p className="text-sm text-navy-300">{item.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
