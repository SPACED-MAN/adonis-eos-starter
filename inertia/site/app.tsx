/// <reference path="../../adonisrc.ts" />
/// <reference path="../../config/inertia.ts" />

import '../css/app.css'
import './lib/icons'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'

import { initAnalytics } from './utils/analytics'
import { ThemeProvider } from '../utils/ThemeContext'
import { useState, useEffect } from 'react'

function AdminBarWrapper({
  isAuthenticated,
  initialPageProps,
}: {
  isAuthenticated: boolean
  initialPageProps: any
}) {
  const [Component, setComponent] = useState<any>(null)

  useEffect(() => {
    if (isAuthenticated) {
      import('./components/AdminBarWrapper').then((m) => setComponent(() => m.AdminBarWrapper))
    }
  }, [isAuthenticated])

  if (!Component) return null

  return <Component isAuthenticated={isAuthenticated} initialPageProps={initialPageProps} />
}

let appName = import.meta.env.VITE_APP_NAME || 'Adonis EOS'

createInertiaApp({
  progress: {
    color: '#5468FF',
    // Delay showing progress bar to avoid flicker on fast navigations
    delay: 250,
  },

  title: (title) => (title ? `${title} - ${appName}` : appName),

  resolve: (name) => {
    // Strip "site/" prefix if present
    const pageName = name.startsWith('site/') ? name.replace('site/', '') : name
    return resolvePageComponent(`./pages/${pageName}.tsx`, import.meta.glob('./pages/**/*.tsx'))
  },

  setup({ el, App, props }) {
    initAnalytics(props.initialPage)
    // Prefer the DB-backed site title when available (shared via Inertia props)
    const initialSiteTitle = (props.initialPage?.props as any)?.siteTitle
    if (initialSiteTitle) {
      appName = String(initialSiteTitle)
    }

    const initialIsDark = (props.initialPage?.props as any)?.isDark
    const currentUser = (props.initialPage?.props as any)?.currentUser
    const isAuthenticated =
      !!currentUser && ['admin', 'editor_admin', 'editor', 'translator'].includes(String(currentUser.role || ''))

    const p = props as any
    const { key, ref, ...restProps } = p
    const app = (
      <ThemeProvider initialIsDark={initialIsDark}>
        <App key={key} {...restProps} />
        {isAuthenticated && (
          <AdminBarWrapper
            isAuthenticated={isAuthenticated}
            initialPageProps={props.initialPage.props}
          />
        )}
      </ThemeProvider>
    )

    if (el.hasChildNodes()) {
      hydrateRoot(el, app)
    } else {
      createRoot(el).render(app)
    }
  },
})
