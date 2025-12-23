import '../css/app.css'
import ReactDOMServer from 'react-dom/server'
import { createInertiaApp } from '@inertiajs/react'
import redis from '@adonisjs/redis/services/main'
import crypto from 'node:crypto'
import { ThemeProvider } from '../utils/ThemeContext'

export default async function render(page: any) {
  const componentName = String(page?.component ?? '')
  const isAdminPage = componentName.startsWith('admin/')

  // Never SSR admin pages (extra guard in addition to config)
  if (isAdminPage) {
    // Return empty string so the client fully renders
    return ''
  }

  // Generate cache key from page component and props
  const cacheKey = `ssr:${page.component}:${crypto
    .createHash('md5')
    .update(JSON.stringify(page.props))
    .digest('hex')}`

  // Check cache first
  if (!isAdminPage) {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return cached
    }
  }

  // Render if not cached
  try {
    const html = await createInertiaApp({
      page,
      render: ReactDOMServer.renderToString,
      resolve: (name) => {
        const sitePages = import.meta.glob('../site/pages/**/*.tsx', { eager: true })
        const adminPages = import.meta.glob('../admin/pages/**/*.tsx', { eager: true })

        // Handle both "site/home" and "admin/dashboard" formats
        let modulePath: string
        let module: any

        if (name.startsWith('site/')) {
          const pageName = name.replace('site/', '')
          modulePath = `../site/pages/${pageName}.tsx`
          module = sitePages[modulePath]
        } else if (name.startsWith('admin/')) {
          const pageName = name.replace('admin/', '')
          modulePath = `../admin/pages/${pageName}.tsx`
          module = adminPages[modulePath]
        } else {
          // Fallback: try both locations
          modulePath = `../site/pages/${name}.tsx`
          module = sitePages[modulePath] ?? adminPages[`../admin/pages/${name}.tsx`]
        }

        if (!module) {
          throw new Error(`Page not found: ${name} (looking for: ${modulePath})`)
        }

        return (module as any).default
      },
      setup: ({ App, props }) => {
        const initialIsDark = (props as any)?.isDark
        return (
          <ThemeProvider initialIsDark={initialIsDark}>
            <App {...props} />
          </ThemeProvider>
        )
      },
    })

    // Cache the rendered HTML for 1 hour
    await redis.setex(cacheKey, 3600, html)

    return html
  } catch (err) {
    console.error('SSR Error:', err)
    return ''
  }
}
