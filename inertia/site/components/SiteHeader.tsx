import { useEffect, useState } from 'react'
import type { MenuItem, TreeNode } from './menu/types'
import { NavBar } from './menu/NavBar'
import { usePage } from '@inertiajs/react'
import { pickMediaVariantUrl, type MediaVariant } from '../../lib/media'
import { AnnouncementBanner } from './AnnouncementBanner'
import { CookieConsent } from './CookieConsent'

function buildTree(items: MenuItem[]): TreeNode[] {
  const idToNode = new Map<string, TreeNode>()
  const roots: TreeNode[] = []
  items.forEach((it) => idToNode.set(it.id, { ...it, children: [] }))
  items.forEach((it) => {
    const node = idToNode.get(it.id)!
    if (it.parentId && idToNode.has(it.parentId)) idToNode.get(it.parentId)!.children.push(node)
    else roots.push(node)
  })
  const sortChildren = (arr: TreeNode[]) => {
    arr.forEach((n) => sortChildren(n.children))
  }
  sortChildren(roots)
  return roots
}

export function SiteHeader() {
  const [primaryNodes, setPrimaryNodes] = useState<TreeNode[]>([])
  const [menuMeta, setMenuMeta] = useState<Record<string, any> | null>(null)
  const [siteTitle, setSiteTitle] = useState<string>('')
  const [logoBaseUrl, setLogoBaseUrl] = useState<string | null>(null)
  const [logoVariants, setLogoVariants] = useState<MediaVariant[] | null>(null)
  const [logoDarkSourceUrl, setLogoDarkSourceUrl] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState<boolean>(true)

  const page = usePage()
  const currentUser = (page.props as any)?.currentUser

  useEffect(() => {
    ;(async () => {
      try {
        // Primary menu
        const res = await fetch('/api/menus/by-slug/primary?locale=en', {
          credentials: 'same-origin',
        })
        const j = await res.json().catch(() => ({}))
        const items: MenuItem[] = Array.isArray(j?.data?.items) ? j.data.items : []
        setPrimaryNodes(buildTree(items))
        setMenuMeta((j?.data?.meta as any) ?? null)
      } catch {
        setPrimaryNodes([])
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/site-settings', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        const data: any = j?.data || j
        if (data?.siteTitle) {
          setSiteTitle(String(data.siteTitle))
        }
        
        const customFields = data?.customFields || {}
        if ('show_search' in customFields) {
          setShowSearch(customFields.show_search !== false && customFields.show_search !== 'false')
        }

        const logoMediaId: string | null = data?.logoMediaId || null

        if (logoMediaId) {
          try {
            const resLogo = await fetch(`/public/media/${encodeURIComponent(logoMediaId)}`, {
              credentials: 'same-origin',
            })
            const jm = await resLogo.json().catch(() => ({}))
            const media = jm?.data as any
            if (media && media.url) {
              const meta = (media as any).metadata || {}
              const variants: MediaVariant[] = Array.isArray(meta?.variants)
                ? (meta.variants as MediaVariant[])
                : []
              const darkSourceUrl =
                typeof meta.darkSourceUrl === 'string' ? (meta.darkSourceUrl as string) : null
              setLogoBaseUrl(String(media.url))
              setLogoVariants(variants)
              setLogoDarkSourceUrl(darkSourceUrl)
            }
          } catch {
            // ignore logo load errors
          }
        }
      } catch {
        // ignore
      }
    })()
  }, [])

  const resolvedLogoUrl =
    logoBaseUrl && logoVariants
      ? pickMediaVariantUrl(logoBaseUrl, logoVariants, undefined, {
          darkSourceUrl: logoDarkSourceUrl ?? undefined,
        })
      : logoBaseUrl

  return (
    <>
      <AnnouncementBanner />
      <CookieConsent />
      <NavBar
        primaryNodes={primaryNodes}
        menuMeta={menuMeta || undefined}
        menuName={siteTitle}
        logoLightUrl={resolvedLogoUrl || undefined}
        logoDarkUrl={undefined}
        currentUser={currentUser || undefined}
        showSearch={showSearch}
      />
    </>
  )
}
