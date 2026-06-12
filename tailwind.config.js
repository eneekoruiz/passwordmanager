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
    },
  },
  plugins: [],
}
