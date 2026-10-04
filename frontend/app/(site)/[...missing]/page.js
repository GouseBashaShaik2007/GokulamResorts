import { notFound } from 'next/navigation';

// Catches any address that isn't a real page so the 404 renders inside the
// guest layout (navbar, footer) instead of Next's bare default screen.
export default function Missing() {
  notFound();
}
