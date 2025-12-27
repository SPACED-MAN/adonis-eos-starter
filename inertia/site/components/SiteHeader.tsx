import { useMemo } from 'react'
import type { TreeNode } from './menu/types'
import { NavBar } from './menu/NavBar'
import { usePage } from '@inertiajs/react'
import { type MediaVariant } from '../../lib/media'
import { AnnouncementBanner } from './AnnouncementBanner'
import { CookieConsent } from './CookieConsent'

export function SiteHeader() {
  const { props } = usePage<any>()
  const currentUser = props.currentUser
  const siteSettings = props.siteSettings
  const primaryMenu = props.primaryMenu

  const primaryNodes = useMemo(() => {
    if (!primaryMenu?.tree) return []
    return primaryMenu.tree as TreeNode[]
  }, [primaryMenu])

  const menuMeta = primaryMenu?.meta ?? null
  const siteTitle = siteSettings?.siteTitle || ''
  const showSearch =
    siteSettings?.customFields?.show_search !== false &&
    siteSettings?.customFields?.show_search !== 'false' &&
    menuMeta?.showSearch !== false &&
    menuMeta?.showSearch !== 'false'

  const logoMedia = useMemo(() => {
    const logo = siteSettings?.logoMedia
    if (!logo) return undefined

    if (typeof logo === 'object' && logo.url) {
      const meta = logo.metadata || {}
      return {
        url: String(logo.url),
        metadata: {
          variants: (Array.isArray(meta?.variants) ? meta.variants : []) as MediaVariant[],
          darkSourceUrl:
            typeof meta.darkSourceUrl === 'string' ? (meta.darkSourceUrl as string) : null,
        },
      }
    } else if (typeof logo === 'string') {
      return {
        url: logo,
        metadata: { variants: [], darkSourceUrl: null },
      }
    }
    return undefined
  }, [siteSettings?.logoMedia])

  return (
    <>
      <AnnouncementBanner />
      <CookieConsent />
      <NavBar
        primaryNodes={primaryNodes}
        menuMeta={menuMeta || undefined}
        menuName={siteTitle}
        logo={logoMedia}
        currentUser={currentUser || undefined}
        showSearch={showSearch}
      />
    </>
  )
}
