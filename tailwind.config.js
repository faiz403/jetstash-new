/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B0E14',
          50: '#F4F5F7',
          100: '#E4E6EA',
          200: '#C7CBD3',
          300: '#9CA3B0',
          400: '#6B7280',
          500: '#454B57',
          600: '#2D323D',
          700: '#1E222B',
          800: '#141821',
          900: '#0B0E14',
          950: '#06080C',
        },
        brass: {
          DEFAULT: '#C8932E',
          50: '#FBF4E6',
          100: '#F6E6C2',
          200: '#EDCC86',
          300: '#E0B158',
          400: '#D3A03E',
          500: '#C8932E',
          600: '#A87423',
          700: '#85591D',
          800: '#634319',
          900: '#473015',
        },
        terracotta: {
          DEFAULT: '#C1502E',
          50: '#FBEEE8',
          100: '#F4D2C2',
          200: '#E8A685',
          300: '#DA7E57',
          400: '#CD653D',
          500: '#C1502E',
          600: '#9E3F25',
          700: '#7C311F',
          800: '#5C2519',
          900: '#421B13',
        },
        sand: {
          DEFAULT: '#F7F2E9',
          50: '#FDFBF7',
          100: '#F7F2E9',
          200: '#EFE5D2',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
      },
      borderRadius: {
        xs: '6px',
        sm: '10px',
        md: '14px',
        lg: '20px',
        xl: '28px',
      },
      boxShadow: {
        card: '0 2px 8px -2px rgba(11,14,20,0.08), 0 1px 2px -1px rgba(11,14,20,0.04)',
        'card-hover': '0 16px 32px -8px rgba(11,14,20,0.16), 0 4px 8px -2px rgba(11,14,20,0.08)',
        panel: '0 24px 64px -16px rgba(11,14,20,0.32)',
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      maxWidth: {
        content: '1320px',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'route-draw': 'routeDraw 1.8s cubic-bezier(0.65, 0, 0.35, 1) forwards',
        'pulse-dot': 'pulseDot 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        routeDraw: {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.6)', opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
};
