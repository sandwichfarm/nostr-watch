/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './index.html',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7C3AED',
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        accent: {
          DEFAULT: '#3B82F6',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        dark: {
          bg: '#0F172A',
          card: '#1E293B',
          border: '#334155',
          text: '#E2E8F0',
          muted: '#94A3B8',
        },
      },
    },
  },
  plugins: [],
};
