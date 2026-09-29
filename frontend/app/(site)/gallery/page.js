import GalleryGrid from '@/components/site/GalleryGrid';
import { realPhotos } from '@/lib/rooms';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const metadata = { title: 'Gallery — Gokulam Resorts' };

async function getRoomPhotos() {
  try {
    const res = await fetch(`${API_URL}/rooms`, { cache: 'no-store' });
    if (!res.ok) return [];
    const { rooms = [] } = await res.json();
    return rooms.flatMap((r) => realPhotos(r).map((src, i) => ({ src, alt: `${r.name} — photo ${i + 1}` })));
  } catch {
    return [];
  }
}

export default async function GalleryPage() {
  const roomPhotos = await getRoomPhotos();
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="eyebrow">Gallery</p>
      <h1 className="display-heading mt-2 text-4xl md:text-5xl">A look around</h1>
      <p className="mt-4 max-w-2xl text-navy-300">The rooms, the beach, the table and the celebrations. Tap any photo to see it full screen.</p>
      <div className="mt-10">
        <GalleryGrid roomPhotos={roomPhotos} />
      </div>
    </div>
  );
}
