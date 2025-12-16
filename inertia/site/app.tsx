/// <reference path="../../adonisrc.ts" />
/// <reference path="../../config/inertia.ts" />

import '../css/app.css'
import { hydrateRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { SiteAdminBar } from './components/SiteAdminBar'

let appName = import.meta.env.VITE_APP_NAME || 'EOS'

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
    // Prefer the DB-backed site title when available (shared via Inertia props)
    const initialSiteTitle = (props.initialPage?.props as any)?.siteTitle
    if (initialSiteTitle) {
      appName = String(initialSiteTitle)
    }
    hydrateRoot(
      el,
      <>
        <App {...props} />
        <SiteAdminBar />
      </>
    )
  },
})
