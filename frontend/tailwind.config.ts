import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'ginto': ['var(--font-ginto)'],
        'ginto-nord': ['var(--font-ginto-nord)'],
        'newsreader': ['var(--font-newsreader)', 'serif'],
        'sans': ['system-ui', 'sans-serif'],
        'mono': ['monospace'],
      },
      colors: {
        // Colors are now defined in CSS using @theme directive
        // Only keep any custom colors that aren't defined in CSS
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontWeight: {
        'thin': '100',
        'hairline': '200',
        'light': '300',
        'normal': '400',
        'medium': '500',
        'bold': '700',
        'extrabold': '800',
        'black': '900',
      },
    },
  },
  plugins: [],
}

export default config
