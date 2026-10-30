/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f7f4',
          100: '#e1ede6',
          200: '#c5dbcf',
          300: '#9ec0b1',
          400: '#71a18d',
          500: '#4f8571',
          600: '#3d6b5a',
          700: '#325649',
          800: '#2b463d',
          900: '#253b34',
        }
      }
    },
  },
  plugins: [],
}
