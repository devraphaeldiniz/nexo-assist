import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#FFFFFF',
        desk: '#F6F7F9',
        ink: '#1B2431',
        'ink-2': '#3D4656',
        'ink-3': '#5B6472',
        rule: '#E6E8EC',
        cta: '#0062C4',
        primary: '#0285F7',
        success: '#00BD6C',
        'success-text': '#00804A',
        warning: '#F5A500',
        'warning-text': '#946300',
        danger: '#EE343B',
        'danger-text': '#C4161D',
        violet: '#A37AFF',
        'violet-text': '#6B3FE0',
      },
      borderRadius: {
        'radius-6': '6px',
        'radius-10': '10px',
        'radius-14': '14px',
      },
      fontFamily: {
        display: ['var(--font-newsreader)', 'serif'],
        ui: ['var(--font-schibsted-grotesk)', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;