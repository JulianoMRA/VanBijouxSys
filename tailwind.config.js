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
        },

        /* Paleta do refactor visual. Vinho como primária, neutros quentes
           dessaturados e semânticas terrosas para status. */
        wine: {
          50: '#f6ecf0',
          100: '#eddae2',
          200: '#dcbccb',
          300: '#c599ae',
          400: '#a4718a',
          500: '#8b3a5c',
          600: '#78314e',
          700: '#61273f',
          800: '#471d2e',
          900: '#2e121d'
        },
        ink: {
          100: '#c4b6b2',
          200: '#b09b96',
          300: '#a8938f',
          400: '#8a7a7d',
          500: '#7d6c6f',
          600: '#6d5c60',
          700: '#4a3a3e',
          800: '#3d2b30',
          900: '#241419'
        },
        bone: {
          50: '#fffdfc',
          100: '#fbf7f5',
          200: '#f7f4f2',
          300: '#f2ebe7',
          400: '#eae1dc',
          500: '#e3d9d4',
          600: '#d5c8c2'
        },
        sage: {
          100: '#e4f3ec',
          400: '#5d8f76',
          500: '#1c7d5a',
          600: '#2f6b52'
        },
        clay: {
          100: '#fbe6e4',
          500: '#b3413f',
          600: '#9c3232'
        },
        honey: {
          100: '#fdf6ec',
          200: '#f0dfc4',
          400: '#c98b2e',
          500: '#9a5b12',
          600: '#7d4f14'
        },
        gold: {
          300: '#e2c48f',
          500: '#c9a15f'
        },
        plum: {
          100: '#f0e8f0',
          500: '#6c4a63'
        }
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif']
      },
      fontSize: {
        /* A proposta trabalha numa escala mais densa do que a do Tailwind. */
        meta: ['11px', { lineHeight: '1.4' }],
        micro: ['12px', { lineHeight: '1.45' }],
        aux: ['12.5px', { lineHeight: '1.45' }],
        body: ['13.5px', { lineHeight: '1.5' }]
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        control: '9px',
        card: '14px'
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)',
        card: '0 1px 3px rgba(160,80,100,0.06), 0 4px 20px rgba(160,80,100,0.07)',
        'card-hover': '0 4px 24px rgba(160,80,100,0.14), 0 8px 32px rgba(160,80,100,0.08)',
        warm: '0 2px 10px rgba(228,77,138,0.2), 0 4px 20px rgba(228,77,138,0.12)',
        raised: '0 1px 2px rgba(36,20,25,0.06)',
        pop: '0 8px 28px rgba(36,20,25,0.12), 0 2px 6px rgba(36,20,25,0.06)'
      }
    }
  },
  plugins: []
}
