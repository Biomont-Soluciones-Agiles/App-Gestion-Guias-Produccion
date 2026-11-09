/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        biomont: {
          blue: '#003380',
          red: '#E3001B',
        }
      }
    },
  },
  plugins: [],
}