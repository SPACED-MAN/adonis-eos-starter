// Tailwind CSS config with a simple named color palette mapped to CSS variables.
// Usage:
// - bg-backdrop-low, bg-backdrop-medium, bg-backdrop-high
// - text-neutral-high, text-neutral-low
// - border-border
// - bg-standout text-on-standout
// - text-standout
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './inertia/**/*.{js,jsx,ts,tsx,md,mdx}',
    './resources/views/**/*.edge',
    './app/**/*.edge',
  ],
  theme: {
    extend: {
      colors: {
        standout: 'var(--color-standout)',
        'on-standout': 'var(--color-on-standout)',
        error: '#dc2626',
        'on-error': '#ffffff',
        neutral: {
          low: 'var(--color-neutral-low)',
          medium: 'var(--color-neutral-medium)',
          high: 'var(--color-neutral-high)',
        },
        backdrop: {
          low: 'var(--color-backdrop-low)',
          medium: 'var(--color-backdrop-medium)',
          high: 'var(--color-backdrop-high)',
        },
        line: 'var(--color-line)',
        placeholder: 'var(--color-placeholder)',
        disabled: 'var(--color-disabled)',
      },
    },
  },
  plugins: [],
}


