import { Cormorant_Garamond } from 'next/font/google';

// The italic in the home page headline ("slows you down"). Kept apart from
// fonts.js so only the home page downloads it.
export const serifItalic = Cormorant_Garamond({
  subsets: ['latin'],
  weight: '500',
  style: 'italic',
  display: 'swap',
});
