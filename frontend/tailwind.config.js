const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Sand-to-ink gradient. Class names are unchanged from the old dark
        // theme (navy-950 was the page bg, navy-50 was the main text color)
        // but the meaning is inverted: 950 is now the lightest sand and 50
        // is now the darkest ink, so every existing bg-navy-950/text-navy-50
        // usage renders correctly in the new light theme with no per-file edits.
        navy: {
          50: '#1C2A33', // ink — primary text/headings
          100: '#24333D',
          200: '#37474F',
          300: '#5B6B73', // ink-muted — secondary/description text
          400: '#6E7D84',
          500: '#8C9AA0',
          600: '#C9C0AE',
          700: '#E4D6BF', // sand border/divider
          800: '#EDE4D2', // light surface (inputs, subtle panels)
          900: '#F3ECE1', // alternate section background
          950: '#FBF8F3', // page background
        },
        // "Brass" — decorative only (eyebrows, small labels, thin accents).
        // Never a large button fill; see the `ocean` scale for that.
        gold: {
          50: '#FBF6EC',
          100: '#F3E6CE',
          200: '#E8D9BE',
          300: '#D4BC8E',
          400: '#B08D57',
          500: '#9A7743',
          600: '#7C5F33',
          700: '#5F481F',
          800: '#3F3015',
          900: '#241C0C',
        },
        // Primary buttons, links, and interactive/focus states.
        ocean: {
          50: '#E4EEF0',
          100: '#CFE3E6',
          200: '#A3CBD0',
          300: '#4E8E97',
          400: '#2C7580',
          500: '#0E4F5C',
          600: '#13707F',
          700: '#0A3940',
          800: '#082A2F',
          900: '#051A1D',
        },
        // Literal dark navy, deliberately untouched by the inversion above —
        // reserved for the footer and photo overlays only.
        night: {
          DEFAULT: '#0B1F26',
          700: '#122A32',
          800: '#16323B',
          900: '#081619',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        'display-lg': ['clamp(2.75rem, 5vw, 4.5rem)', { lineHeight: '1.05' }],
        'display-md': ['clamp(2rem, 3.5vw, 3rem)', { lineHeight: '1.1' }],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(180deg, rgba(4,10,23,0.55) 0%, rgba(8,20,40,0.85) 100%)',
        'editorial-fade': 'linear-gradient(90deg, rgba(4,10,23,0.9) 0%, rgba(4,10,23,0.2) 100%)',
      },
      transitionDuration: {
        600: '600ms',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      boxShadow: {
        glass: '0 1px 2px rgba(28,42,51,.06), 0 12px 32px -12px rgba(28,42,51,.28)',
      },
    },
  },
  plugins: [],
};
