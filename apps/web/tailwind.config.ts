import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'hrih-navy': '#0A0F1D',
        'hrih-midnight': '#0B132B',
        'hrih-gold': '#D4AF37',
        'hrih-amber': '#F59E0B',
        'hrih-surface': '#111827',
        'hrih-border': '#1F2937',
        'smrt16-canvas': '#050B14',
        'smrt16-teal': '#00F5D4',
        'smrt16-mint': '#14B8A6',
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
}

export default config
