/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Marine : en-tête, pied de page, titres (jamais le fond de page).
        ink: {
          DEFAULT: '#152238',
          card: '#1d3050',
          dark: '#0F1A2C',
        },
        // Fond clair chaud du site public.
        cream: {
          DEFAULT: '#FBF7EF',
          dim: '#F4EDE1',
          deep: '#EFE5D3',
        },
        // Anciennes surfaces sombres (back-office, /suivi) — conservées.
        paper: {
          DEFAULT: '#F4EFE4',
          dim: '#E7DFCE',
        },
        // Terracotta : couleur du logo, boutons et accents.
        laterite: {
          DEFAULT: '#B5502E',
          light: '#D3714D',
        },
        lagoon: {
          DEFAULT: '#2E7D6B',
          light: '#4FA893',
        },
        sand: '#D8C9A3',
        line: '#E4DACB',
        body: '#1F2933',
        muted: '#5B6673',
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(21, 34, 56, 0.05), 0 18px 40px -28px rgba(21, 34, 56, 0.35)',
        lift: '0 2px 4px rgba(21, 34, 56, 0.06), 0 24px 48px -24px rgba(21, 34, 56, 0.28)',
      },
      borderRadius: {
        card: '1rem',
      },
    },
  },
  plugins: [],
};
