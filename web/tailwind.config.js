/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#0B0E14',
        charcoal: '#151923',
        teal: {
          DEFAULT: '#00E5FF',
          400: '#33EAFF',
          500: '#00E5FF',
          600: '#00B8CC',
        },
        purple: {
          DEFAULT: '#7B1FA2',
          400: '#9A3FC0',
          600: '#5E1780',
        },
      },
      boxShadow: {
        // resting glass panel: barely-there edge, no glow
        glass: '0 1px 0 0 rgb(255 255 255 / 0.04) inset',
        // hover state: teal ring + glow outside, soft purple wash inside
        'card-hover':
          '0 0 0 1.5px rgb(0 229 255 / 0.9), 0 0 32px rgb(0 229 255 / 0.4), inset 0 0 40px rgb(123 31 162 / 0.5)',
      },
      backdropBlur: {
        glass: '16px',
      },
      fontFamily: {
        display: ['"Poppins"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(0,229,255,0.4)' },
          '50%': { boxShadow: '0 0 30px rgba(0,229,255,0.7), 0 0 18px rgba(123,31,162,0.5)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [
    function ({ addUtilities, theme }) {
      addUtilities({
        '.glass-panel': {
          backgroundColor: 'rgb(21 25 35 / 0.55)',
          backdropFilter: `blur(${theme('backdropBlur.glass')})`,
          WebkitBackdropFilter: `blur(${theme('backdropBlur.glass')})`,
          border: '1px solid rgb(255 255 255 / 0.08)',
        },
      })
    },
  ],
}
