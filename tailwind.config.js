module.exports = {
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
        }
      }
    },
    variants: {
      extend: {},
    },
    plugins: [
      require('tailwindcss')('./tailwind.config.js'),
      require('autoprefixer'),
    ],
  }
  