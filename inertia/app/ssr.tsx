import '../css/app.css'
import { renderToPipeableStream } from 'react-dom/server'
import { createInertiaApp } from '@inertiajs/react'
import redis from '@adonisjs/redis/services/main'
import crypto from 'node:crypto'
import cmsConfig from '#config/cms'
import { ThemeProvider } from '../utils/ThemeContext'
import { TooltipProvider } from '../components/ui/tooltip'
import { PassThrough } from 'node:stream'

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
  const cacheEnabled = cmsConfig.cache.enabled
  if (!isAdminPage && cacheEnabled) {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return cached
    }
  }

  // Render if not cached
  try {
    const html = await createInertiaApp({
      page,
      render: (element) => {
        return new Promise((resolve, reject) => {
          let buffer = ''
          const stream = new PassThrough()
          stream.on('data', (chunk) => {
            buffer += chunk
          })
          stream.on('end', () => {
            resolve(buffer)
          })
          stream.on('error', (err) => {
            reject(err)
          })

          const { pipe } = renderToPipeableStream(element, {
            onAllReady() {
              pipe(stream)
            },
            onShellError(err) {
              reject(err)
            },
            onError(err) {
              console.error('SSR Render Error:', err)
            },
          })
        })
      },
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
            <TooltipProvider>
              <App {...props} />
            </TooltipProvider>
          </ThemeProvider>
        )
      },
    })

    // Cache the rendered HTML if enabled
    if (cacheEnabled) {
      const ttl = cmsConfig.cache.ssrTtl || 3600
      await redis.setex(cacheKey, ttl, html)
    }

    return html
  } catch (err) {
    console.error('SSR Error:', err)
    return ''
  }
}
