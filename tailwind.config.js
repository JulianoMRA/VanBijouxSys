/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        rose: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337'
        },
        blush: {
          50: '#fdf4f7',
          100: '#fce8f0',
          200: '#fad1e4',
          300: '#f5aacb',
          400: '#ee78aa',
          500: '#e44d8a',
          600: '#d02d6b',
          700: '#ae2057',
          800: '#911d4a',
          900: '#791c41'
        },
        cream: {
          50: '#fdfcfb',
          100: '#faf7f4',
          200: '#f5ede6',
          300: '#edddd2',
          400: '#e2c9b8',
          500: '#d4b09a'
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem'
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)',
        card: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.06)'
      }
    }
  },
  plugins: []
}
