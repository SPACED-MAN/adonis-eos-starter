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
    './app/modules/**/*.ts',
  ],
  theme: {
    extend: {
      colors: {
        'standout': 'var(--color-standout)',
        'on-standout': 'var(--color-on-standout)',
        'error': '#dc2626',
        'on-error': '#ffffff',
        'neutral': {
          low: 'var(--color-neutral-low)',
          medium: 'var(--color-neutral-medium)',
          high: 'var(--color-neutral-high)',
        },
        'backdrop': {
          low: 'var(--color-backdrop-low)',
          medium: 'var(--color-backdrop-medium)',
          high: 'var(--color-backdrop-high)',
        },
        'line': 'var(--color-line)',
        'placeholder': 'var(--color-placeholder)',
        'disabled': 'var(--color-disabled)',
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': 'var(--color-neutral-high)',
            '--tw-prose-headings': 'var(--color-neutral-high)',
            '--tw-prose-links': 'var(--color-standout)',
            '--tw-prose-bold': 'var(--color-neutral-high)',
            '--tw-prose-bullets': 'var(--color-neutral-medium)',
            '--tw-prose-quotes': 'var(--color-neutral-medium)',
            '--tw-prose-code': 'var(--color-neutral-high)',
            '--tw-prose-hr': 'var(--color-line)',
            'maxWidth': 'none',
            // Remove default h1 styling - prose should not have h1
            'h1': {
              display: 'none',
            },
            'h2': {
              fontSize: '3rem',
              fontWeight: '600',
              marginTop: '2.5rem',
              marginBottom: '1.25rem',
              lineHeight: '3.5rem',
            },
            'h3': {
              fontSize: '1.5rem',
              fontWeight: '600',
              marginTop: '1.5rem',
              marginBottom: '0.75rem',
              lineHeight: '2rem',
            },
            'p': {
              marginTop: '1rem',
              marginBottom: '1rem',
              lineHeight: '1.75rem',
            },
            'ul': {
              listStyleType: 'disc',
              paddingLeft: '1.5rem',
              marginTop: '1rem',
              marginBottom: '1rem',
            },
            'ol': {
              listStyleType: 'decimal',
              paddingLeft: '1.5rem',
              marginTop: '1rem',
              marginBottom: '1rem',
            },
            'li': {
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
            },
            'code': {
              backgroundColor: 'var(--color-backdrop-medium)',
              padding: '0.125rem 0.25rem',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            'strong': {
              fontWeight: '600',
            },
            'a': {
              'textDecoration': 'underline',
              '&:hover': {
                opacity: '0.8',
              },
            },
          },
        },
      }),
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
