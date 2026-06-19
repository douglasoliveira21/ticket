/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf2f2',
          100: '#fde8e8',
          200: '#fbd5d5',
          300: '#f8b4b4',
          400: '#f98080',
          500: '#f05252',
          600: '#e02424',
          700: '#8B1A1A',
          800: '#6B1414',
          900: '#4B0E0E',
        },
      },
    },
  },
  plugins: [],
};
