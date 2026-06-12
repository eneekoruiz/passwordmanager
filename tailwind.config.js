/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'sans-serif',
        ],
      },
      colors: {
        surface: {
          DEFAULT: '#f9f9f9',
          elevated: '#ffffff',
          hover: '#f0f0f0',
          active: '#e8e8e8',
        },
        border: {
          subtle: '#e5e5e5',
          DEFAULT: '#d4d4d4',
        },
        text: {
          primary: '#1a1a1a',
          secondary: '#6b6b6b',
          tertiary: '#9a9a9a',
        },
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0, 0, 0, 0.04)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.75' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulse-subtle 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
