import { defineConfig } from 'vite'
import { getDirname } from '@adonisjs/core/helpers'
import inertia from '@adonisjs/inertia/client'
import react from '@vitejs/plugin-react'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    inertia({
      ssr: { enabled: true, entrypoint: 'inertia/site/app.tsx' },
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
    rollupOptions: {
      external: (id) => {
        // Exclude SSR-only Node.js dependencies from client bundle
        // These are only used in inertia/app/ssr.tsx and cannot run in browser
        if (id.includes('@adonisjs/redis') || id === 'node:crypto' || id === 'crypto') {
          return true
        }
        // Allow react-dom/server - it's used in client code (InlineOverlay)
        return false
      },
    },
  },

  /**
   * Optimize dependencies - exclude only Node.js-specific SSR packages
   */
  optimizeDeps: {
    exclude: ['@adonisjs/redis/services/main', 'node:crypto'],
  },
})
