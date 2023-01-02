module.exports = {
    content: [
      "./index.html",     
      "./src/**/*.{vue,js,ts,jsx,tsx}"
    ],
    theme: {
      extend: {
        extend: {
          zIndex: {
            '9000': '9000',
          }
        }
      },
    },
    variants: {
      extend: {},
    },
    plugins: [
      require('@tailwindcss/forms'),
    ],
  }
  