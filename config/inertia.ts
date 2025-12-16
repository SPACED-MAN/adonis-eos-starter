import { defineConfig } from '@adonisjs/inertia'
import type { InferSharedProps } from '@adonisjs/inertia/types'

const inertiaConfig = defineConfig({
  /**
   * Path to the Edge view that will be used as the root view for Inertia responses
   */
  rootView: 'inertia_layout',

  /**
   * Data that should be shared with all rendered pages
   */
  sharedData: {
    currentUser: (ctx) =>
      ctx.inertia.always(() => {
        try {
          return ctx.auth?.use('web').user || null
        } catch {
          return null
        }
      }),
    csrf: (ctx) => ctx.request.csrfToken,
    errors: (ctx) => ctx.session?.flashMessages?.get('errors') ?? {},
    errorsBag: (ctx) => ctx.session?.flashMessages?.get('errorsBag') ?? {},
    error: (ctx) => ctx.session?.flashMessages?.get('error') ?? null,
    success: (ctx) => ctx.session?.flashMessages?.get('success') ?? null,
    locale: (ctx) => ctx.locale || 'en',
  },

  /**
   * Options for the server-side rendering
   */
  ssr: {
    enabled: true,
    entrypoint: 'inertia/app/ssr.tsx',
    /**
     * Only SSR public pages for SEO benefits.
     * Admin pages don't need SSR (behind auth, no SEO value)
     */
    pages: (_ctx, page) => !page.startsWith('admin'),
  },
})

export default inertiaConfig

declare module '@adonisjs/inertia/types' {
  export interface SharedProps extends InferSharedProps<typeof inertiaConfig> {}
}
