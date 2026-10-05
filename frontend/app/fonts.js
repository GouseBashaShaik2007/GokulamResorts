import { Cormorant_Garamond, Inter } from 'next/font/google';

// The serif for headings, in the three weights the site uses (medium for the
// large page headings, semibold and bold for the rest). Each weight is a file
// every visitor downloads, so none is loaded "just in case". The one italic —
// in the home page headline — lives in fonts-home.js and loads only there.
export const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
});

export const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
