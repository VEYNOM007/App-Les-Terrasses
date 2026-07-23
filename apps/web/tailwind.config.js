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
          DEFAULT: '#152238',
          card: '#1d3050',
          dark: '#0F1A2C',
        },
        paper: {
          DEFAULT: '#F4EFE4',
          dim: '#E7DFCE',
        },
        laterite: {
          DEFAULT: '#B5502E',
          light: '#D3714D',
        },
        lagoon: {
          DEFAULT: '#2E7D6B',
          light: '#4FA893',
        },
        sand: '#D8C9A3',
        slate: '#5A6E8C',
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
