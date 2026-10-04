import GalleryGrid from '@/components/site/GalleryGrid';
import PageHeader from '@/components/ui/PageHeader';
import { GALLERY_CATEGORIES, galleryCategory } from '@/lib/gallery';
import { realPhotos, roomPath } from '@/lib/rooms';
import { getRooms } from '@/lib/server-api';

// The category is part of the address (/gallery?c=beach). Reading it here
// means the page arrives already showing that category, named in its title.
export function generateMetadata({ searchParams }) {
  const category = GALLERY_CATEGORIES.find((c) => c.key === galleryCategory(searchParams.c));
  return {
    title: category ? `${category.label} photos` : 'Gallery',
    description: 'Photos of the rooms, the beach and dining at Gokulam Resorts, Chirala Beach.',
    alternates: { canonical: '/gallery' },
  };
}

// Each room photo knows its room, so the viewer can offer "View this room".
async function getRoomPhotos() {
  const rooms = await getRooms();
  return rooms.flatMap((room) =>
    realPhotos(room).map((src, i) => ({
      id: `room-${room.id}-${i}`,
      src,
      alt: `${room.name} — photo ${i + 1}`,
      link: { href: roomPath(room), label: 'View this room' },
    }))
  );
}

export default async function GalleryPage() {
  const roomPhotos = await getRoomPhotos();
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Gallery" title="A look around">
        <p className="mt-4 max-w-2xl text-navy-300">The rooms, the beach, the table and the celebrations. Tap any photo to see it full screen.</p>
      </PageHeader>
      <div className="mt-10">
        <GalleryGrid roomPhotos={roomPhotos} />
      </div>
    </div>
  );
}
