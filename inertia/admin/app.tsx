/// <reference path="../../adonisrc.ts" />
/// <reference path="../../config/inertia.ts" />

import '../css/app.css'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { Toaster } from '../components/ui/sonner'
import { ThemeProvider } from '../utils/ThemeContext'
import { TooltipProvider } from '~/components/ui/tooltip'
import { ConfirmDialogProvider } from '~/components/ConfirmDialogProvider'

let appName = import.meta.env.VITE_APP_NAME || 'EOS'

createInertiaApp({
  progress: {
    color: '#5468FF',
    // Delay showing progress bar to avoid flicker on fast navigations
    delay: 250,
  },

  title: (title) => (title ? `${title} - ${appName}` : appName),

  resolve: (name) => {
    // Strip "admin/" prefix if present
    const pageName = name.startsWith('admin/') ? name.replace('admin/', '') : name
    return resolvePageComponent(`./pages/${pageName}.tsx`, import.meta.glob('./pages/**/*.tsx'))
  },

  setup({ el, App, props }) {
    // Prefer the DB-backed site title when available (shared via Inertia props)
    const initialSiteTitle = (props.initialPage?.props as any)?.siteTitle
    if (initialSiteTitle) {
      appName = String(initialSiteTitle)
    }

    const initialIsDark = (props.initialPage?.props as any)?.isDark

    // If there is no server-rendered markup, do a client render to avoid hydration mismatch
    const hasSSRContent = el.hasChildNodes()
    const app = (
      <ThemeProvider initialIsDark={initialIsDark}>
        <TooltipProvider>
          <ConfirmDialogProvider>
            <App {...props} />
            <Toaster />
          </ConfirmDialogProvider>
        </TooltipProvider>
      </ThemeProvider>
    )
    if (hasSSRContent) {
      hydrateRoot(el, app)
    } else {
      createRoot(el).render(app)
    }
  },
})
