/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      gridTemplateColumns: {
        '13': 'repeat(13, minmax(0, 1fr))',
        '14': 'repeat(14, minmax(0, 1fr))',
      },
      colors: {
        primary: {
          50: '#fef2f3',
          100: '#fee2e4',
          200: '#fecacd',
          300: '#fca5aa',
          400: '#f87479',
          500: '#ee434d',
          600: '#db2536',
          700: '#b91c2a',
          800: '#991b26',
          900: '#801c25',
        },
        secondary: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef088',
          300: '#fde047',
          400: '#facc16',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        accent: {
          50: '#f7fee7',
          100: '#ecfccb',
          200: '#d9f99d',
          300: '#BFD730',
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
          700: '#4d7c0f',
          800: '#3f6212',
          900: '#365314',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        dark: {
          50: '#f8fffe',
          100: '#f0fffe',
          200: '#ccfffe',
          300: '#a3fffe',
          400: '#4dfffe',
          500: '#00fffe',
          600: '#00e6e5',
          700: '#00bfbe',
          800: '#009998',
          900: '#114029',
        }
      },
      fontFamily: {
        'sans': ['Chivo', 'Helvetica', 'Arial', 'sans-serif'],
        'poppins': ['Poppins', 'system-ui', 'sans-serif'],
        'chivo': ['Chivo', 'Helvetica', 'sans-serif'],
        'antonio': ['Antonio', 'Helvetica', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-gentle': 'bounceGentle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
};