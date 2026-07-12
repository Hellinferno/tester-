/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui-components/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Google AI Studio (light) palette
        studio: {
          canvas: '#ffffff',
          rail: '#f0f4f9',
          surface: '#f8fafd',
          hover: '#e9eef6',
          border: '#dde3ea',
          line: '#e3e6ea',
          text: '#1f1f1f',
          muted: '#5f6368',
          faint: '#80868b',
          blue: '#0b57d0',
          bluehover: '#0842a0',
          bluesoft: '#d3e3fd',
          bluetext: '#0b57d0',
        },
        // legacy tokens kept for older screens
        background: '#ffffff',
        card: '#ffffff',
        primary: '#0b57d0',
        accent: '#1a73e8',
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        display: ['"Google Sans"', 'Roboto', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};
