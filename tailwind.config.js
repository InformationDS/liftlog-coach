/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1A2744',
        copper: '#C5943A',
        inferred: '#FEF3C7',
        blocked: '#FEE2E2',
      },
    },
  },
  plugins: [],
};
