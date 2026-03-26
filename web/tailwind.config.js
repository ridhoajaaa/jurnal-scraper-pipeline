/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './*.html',
    './public/*.html',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg:      '#0a0f1e',
          card:    '#111827',
          border:  '#1f2937',
          surface: '#161d2f',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};