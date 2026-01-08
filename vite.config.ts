import { defineConfig } from 'vite'
import { getDirname } from '@adonisjs/core/helpers'
import inertia from '@adonisjs/inertia/client'
import react from '@vitejs/plugin-react'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    inertia({
      ssr: { enabled: true, entrypoint: 'inertia/app/ssr.tsx' },
    }),
    react(),
    adonisjs({
      entrypoints: ['inertia/site/app.tsx', 'inertia/admin/app.tsx'],
      reload: ['resources/views/**/*.edge'],
    }),
  ],

  /**
   * Define aliases for importing modules from
   * your frontend code
   */
  resolve: {
    alias: {
      '~/': `${getDirname(import.meta.url)}/inertia/`,
    },
  },

  /**
   * Build configuration to exclude SSR-only Node.js dependencies from client bundles
   * Note: We only exclude truly Node.js-only packages (redis, crypto)
   * react-dom/server is kept because InlineOverlay uses renderToStaticMarkup on client
   */
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('lexical')) {
              return 'vendor-lexical'
            }
            if (id.includes('lucide-react') || id.includes('fortawesome')) {
              return 'vendor-icons'
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion'
            }
            if (id.includes('recharts')) {
              return 'vendor-charts'
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-ui'
            }
            if (id.includes('@dnd-kit')) {
              return 'vendor-dnd'
            }
            if (id.includes('prismjs') || id.includes('marked')) {
              return 'vendor-utils'
            }
            return 'vendor'
          }
        },
      },
      external: (id) => {
        // Exclude SSR-only Node.js dependencies from client bundle
        // These are only used in inertia/app/ssr.tsx and cannot run in browser
        if (
          id.includes('@adonisjs/redis') ||
          id === 'node:crypto' ||
          id === 'crypto' ||
          id === 'sharp' ||
          id.includes('@aws-sdk')
        ) {
          return true
        }
        // Allow react-dom/server - it's used in client code (InlineOverlay)
        return false
      },
    },
    chunkSizeWarningLimit: 1500,
  },

  /**
   * Optimize dependencies - exclude only Node.js-specific SSR packages
   */
  optimizeDeps: {
    exclude: ['@adonisjs/redis/services/main', 'node:crypto'],
  },
})
