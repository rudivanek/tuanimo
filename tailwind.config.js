/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg': '#F7F4EF',
        'app-surface': '#FFFFFF',
        'app-surface-2': '#F1EEE7',
        'app-surface-warm': '#EDE9E2',
        'app-border': '#D6E0D9',
        'app-text': '#1C2B22',
        'app-muted': '#6B7F72',
        'app-muted-soft': '#8A9A90',
        sage: '#7AAB8A',
        'sage-strong': '#4A7C59',
        'sage-hover': '#2D5A3D',
        'sage-soft': '#EAF2ED',
        'sage-deep': '#1A3827',
        danger: '#D16B6B',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'ui-sans-serif', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        app: '0 8px 24px rgba(28,43,34,0.07)',
        'app-lg': '0 16px 60px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
        cta: '0 6px 24px rgba(74,124,89,0.28)',
      },
      borderRadius: {
        '12': '12px',
        '14': '14px',
        '16': '16px',
        '18': '18px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

