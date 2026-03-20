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
        },
        mauve: {
          50: '#f7f0f4',
          100: '#efe0e8',
          200: '#dfc1d2',
          300: '#c99ab8',
          400: '#b0739c',
          500: '#8b4d6b',
          600: '#733d57',
          700: '#5c2e42',
          800: '#3d1e2c',
          900: '#220f19'
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem'
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)',
        card: '0 1px 3px rgba(160,80,100,0.06), 0 4px 20px rgba(160,80,100,0.07)',
        'card-hover': '0 4px 24px rgba(160,80,100,0.14), 0 8px 32px rgba(160,80,100,0.08)',
        warm: '0 2px 10px rgba(228,77,138,0.2), 0 4px 20px rgba(228,77,138,0.12)'
      }
    }
  },
  plugins: []
}
