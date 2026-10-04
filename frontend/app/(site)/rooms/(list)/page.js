import Reveal from '@/components/motion/Reveal';
import RoomsExplorer from '@/components/site/RoomsExplorer';
import RecentlyViewed from '@/components/site/RecentlyViewed';
import PageHeader from '@/components/ui/PageHeader';
import { getOffers, getRooms } from '@/lib/server-api';

// The list's filters live in the address (/rooms?view=Sea&guests=2), read here
// and by RoomsExplorer. A filtered or re-sorted list is still this one page,
// so search engines are pointed at the plain address.
export function generateMetadata({ searchParams }) {
  const filtered = ['view', 'guests', 'sort'].some((key) => searchParams[key]);
  return {
    title: 'Rooms & Suites',
    description:
      'Room types at Gokulam Resorts, Chirala Beach. Compare size, beds, views and nightly rates, then pick your exact room number when you book.',
    alternates: { canonical: '/rooms' },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function RoomsPage() {
  const [rooms, offers] = await Promise.all([getRooms(), getOffers()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-6">
        <Reveal className="max-w-2xl">
          <PageHeader eyebrow="Chirala Beach" title="Rooms &amp; Suites">
            <p className="mt-4 text-navy-300">
              Compare the room types by size, bed, view and price. Choose one, then pick your exact room by number
              when you book.
            </p>
          </PageHeader>
        </Reveal>
        <RecentlyViewed />
      </div>

      {rooms.length > 0 ? (
        <RoomsExplorer rooms={rooms} offers={offers} />
      ) : (
        <div className="card p-8 text-center text-navy-300">
          Rooms are not available to view right now. Please try again shortly.
        </div>
      )}
    </div>
  );
}
