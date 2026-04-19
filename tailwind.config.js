/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      'var(--bg)',
        surface: 'var(--surface)',
        'surface-alt':  'var(--surface-alt)',
        'surface-deep': 'var(--surface-deep)',
        ink:   'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        'ink-4': 'var(--ink-4)',
        'ink-5': 'var(--ink-5)',
        accent:  'var(--accent)',
        'accent-2':    'var(--accent-2)',
        'accent-soft': 'var(--accent-soft)',
        'accent-wash': 'var(--accent-wash)',
        hairline:      'var(--hairline)',
        'hairline-soft': 'var(--hairline-soft)',
        good:      'var(--good)',
        'good-wash': 'var(--good-wash)',
        warn:      'var(--warn)',
        'warn-wash': 'var(--warn-wash)',
        bad:       'var(--bad)',
        'bad-wash':  'var(--bad-wash)',
      },
      fontFamily: {
        display: ['Instrument Serif', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans:    ['Inter Tight', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        card:  'var(--shadow-card)',
        raise: 'var(--shadow-raise)',
      },
    },
  },
  plugins: [],
}
