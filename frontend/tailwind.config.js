/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#080c14',
        surface: '#0f172a',
        'surface-raised': '#1e293b',
        'accent-mint': '#2dd4bf',
        'accent-amber': '#f59e0b',
        'accent-emerald': '#10b981',
        bgPrimary: '#080c14',
        bgCard: '#0f172a',
      }
    },
  },
  plugins: [],
}
