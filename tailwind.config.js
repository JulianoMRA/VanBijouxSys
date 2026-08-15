/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Vinho é o único acento: ação, seleção e dado principal. */
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
        /* Texto, do mais fraco ao mais forte. */
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
        /* Superfícies e bordas, em neutros quentes. */
        bone: {
          50: '#fffdfc',
          100: '#fbf7f5',
          200: '#f7f4f2',
          300: '#f2ebe7',
          400: '#eae1dc',
          500: '#e3d9d4',
          600: '#d5c8c2'
        },
        /* Semânticas de status: positivo, negativo e atenção. */
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
        /* Série secundária de gráfico e marcador de feira. */
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
        /* Escala mais densa do que a do Tailwind, como pede a proposta. */
        meta: ['11px', { lineHeight: '1.4' }],
        micro: ['12px', { lineHeight: '1.45' }],
        aux: ['12.5px', { lineHeight: '1.45' }],
        body: ['13.5px', { lineHeight: '1.5' }]
      },
      borderRadius: {
        control: '9px',
        card: '14px'
      },
      boxShadow: {
        raised: '0 1px 2px rgba(36,20,25,0.06)',
        pop: '0 8px 28px rgba(36,20,25,0.12), 0 2px 6px rgba(36,20,25,0.06)'
      }
    }
  },
  plugins: []
}
