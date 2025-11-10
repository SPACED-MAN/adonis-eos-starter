import { defineConfig } from 'vite'
import { getDirname } from '@adonisjs/core/helpers'
import inertia from '@adonisjs/inertia/client'
import react from '@vitejs/plugin-react'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    inertia({ 
      ssr: { 
        enabled: true, 
        entrypoint: 'inertia/app/ssr.tsx' 
      } 
    }),
    react(),
    adonisjs({
      entrypoints: [
        'inertia/site/app.tsx',
        'inertia/admin/app.tsx',
      ],
      reload: ['resources/views/**/*.edge'],
    }),
  ],

  /**
   * Define aliases for importing modules from
   * client-side code (React components)
   */
  resolve: {
    alias: {
      '~/': `${getDirname(import.meta.url)}/inertia/`,
    },
  },
})
