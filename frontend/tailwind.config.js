/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef2f8',
          100: '#d7e0ee',
          200: '#aebfdd',
          300: '#7f9bc9',
          400: '#4f75ab',
          500: '#345a8a',
          600: '#254470',
          700: '#1a3257',
          800: '#0f2140',
          900: '#081428',
          950: '#040a17',
        },
        gold: {
          50: '#fbf6e8',
          100: '#f5e8c2',
          200: '#eed89a',
          300: '#e5c66c',
          400: '#dcb548',
          500: '#c9a227',
          600: '#a9841e',
          700: '#83651a',
          800: '#5e491a',
          900: '#3c2f14',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', "Times New Roman", 'Times', 'serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(180deg, rgba(4,10,23,0.55) 0%, rgba(8,20,40,0.85) 100%)',
      },
    },
  },
  plugins: [],
};
