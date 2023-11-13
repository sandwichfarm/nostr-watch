module.exports = {
    important: true,
    darkMode: 'class',
    content: [
      "./index.html",     
      "./src/**/*.{vue,js,ts,jsx,tsx}"
    ],
    theme: {
      extend: {
        zIndex: {
          '9000': '9000',
        },
        screens: {
          'sm': '640px',
          // => @media (min-width: 640px) { ... }
          'md': '768px',
          // => @media (min-width: 768px) { ... }
          'lg': '1024px',
          // => @media (min-width: 1024px) { ... }
          'xl': '1280px',
          // => @media (min-width: 1280px) { ... }
          '2xl': '1536px',
          // => @media (min-width: 1536px) { ... }
        },
        spacing: {
          '13': '3.25rem',
          '15': '3.75rem',
          '17': '4.25rem',
          '18': '4.5rem',
          '19': '4.75rem',
          '20': '5rem',
          '21': '5.25rem',
          '22': '5.5rem',
          '23': '5.75rem',
          '25': '6.25rem',
          '26': '6.5rem',
          '27': '6.75rem',
          '29': '7.25rem',
          '30': '7.5rem',
          '31': '7.75rem',
          '128': '32rem',
          '144': '36rem',
        }
      }
    },
    // variants: {
    //   extend: {},
    // },
    plugins: [
      require('tailwindcss')('./tailwind.config.js'),
      require('autoprefixer'),
    ],
  }
  