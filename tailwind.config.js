/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg': '#F6F8F6',
        'app-surface': '#FFFFFF',
        'app-surface-2': '#F2F6F3',
        'app-border': '#E4EAE6',
        'app-text': '#1F2A24',
        'app-muted': '#6B7A72',
        sage: '#7FA88C',
        'sage-strong': '#5F8672',
        'sage-soft': '#DCE8E1',
        danger: '#D16B6B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        app: '0 8px 24px rgba(31,42,36,0.08)',
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
