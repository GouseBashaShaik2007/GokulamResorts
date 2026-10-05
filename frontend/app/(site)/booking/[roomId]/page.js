import { notFound, permanentRedirect } from 'next/navigation';
import { roomPath } from '@/lib/rooms';
import { getRoomById } from '@/lib/server-api';

// Room pages used to live here as /booking/<number>. They are now at
// /rooms/<name>; this keeps old links, bookmarks and search results working.
export default async function LegacyRoomPage({ params }) {
  const room = /^\d+$/.test(params.roomId) ? await getRoomById(params.roomId) : null;
  if (!room) notFound();
  permanentRedirect(roomPath(room));
}
