

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        'gray-900': '#111827',
        'gray-800': '#1F2A44',
        'gray-700': '#374151',
        'gray-600': '#4B5563',
        'gray-400': '#9CA3AF',
        'gray-300': '#D1D5DB',
        'gray-200': '#E5E7EB',
        'gray-100': '#F3F4F6',
        'gray-50': '#F9FAFB',
        'blue-600': '#2563EB',
        'blue-700': '#1D4ED8',
        'blue-200': '#BFDBFE',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        lg: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
};