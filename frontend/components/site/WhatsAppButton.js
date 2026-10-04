'use client';

import { usePathname } from 'next/navigation';
import { whatsappUrl } from '@/lib/site';

// Bottom-right chat button. Hidden until a WhatsApp number is set in lib/site.js.
// Sits above the floating booking bar's reserved space so they never overlap.
export default function WhatsAppButton() {
  const pathname = usePathname();
  const href = whatsappUrl("Hello Gokulam Resorts, I'd like to ask about a stay.");
  if (!href || pathname.startsWith('/order') || pathname === '/dine' || pathname.startsWith('/dine/')) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 sm:right-6"
      style={{ bottom: 'calc(var(--booking-bar-space, 0px) + 1.25rem)' }}
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M16.04 3C8.85 3 3 8.83 3 16.02c0 2.3.6 4.54 1.75 6.52L3 29l6.64-1.73a13 13 0 0 0 6.4 1.64h.01C23.23 28.9 29 23.07 29 15.9 29 8.8 23.2 3 16.04 3Zm0 23.7a10.8 10.8 0 0 1-5.5-1.5l-.4-.23-3.94 1.03 1.05-3.84-.26-.4a10.7 10.7 0 0 1-1.65-5.73c0-5.96 4.85-10.8 10.8-10.8a10.8 10.8 0 0 1 10.78 10.8c0 5.96-4.84 10.67-10.78 10.67Zm5.92-8.08c-.32-.16-1.93-.95-2.23-1.06-.3-.11-.52-.16-.73.16-.22.32-.84 1.06-1.03 1.28-.19.21-.38.24-.7.08-.33-.16-1.37-.5-2.6-1.6-.96-.86-1.61-1.92-1.8-2.24-.19-.32-.02-.5.14-.66.15-.14.33-.38.49-.57.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.76-1-2.4-.26-.63-.53-.55-.73-.56h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.7 0 1.58 1.16 3.12 1.32 3.33.16.22 2.28 3.48 5.53 4.88.77.33 1.37.53 1.84.68.78.25 1.48.21 2.04.13.62-.1 1.93-.79 2.2-1.55.27-.76.27-1.42.19-1.55-.08-.14-.3-.22-.62-.38Z" />
      </svg>
    </a>
  );
}
