/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFCFB',
          100: '#FAF9F7',
          200: '#F5F3F0',
          300: '#EBE8E4',
          400: '#D9D4CD',
          500: '#C4BDB4',
        },
        sand: {
          100: '#F0EDE8',
          200: '#E5E0D9',
          300: '#D4CEC5',
          400: '#B8AFA3',
          500: '#9C9183',
        },
        accent: {
          DEFAULT: '#C97B4A',
          light: '#E8A87C',
          dark: '#8B5E3C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 16px rgba(0, 0, 0, 0.06)',
        'elevated': '0 8px 32px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
}
