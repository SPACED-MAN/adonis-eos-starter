import { useEffect, useState } from 'react'
import { ThemeToggle } from '../../components/ThemeToggle'
import type { MenuItem } from './menu/types'
import { MenuItemLink } from './menu/MenuItemLink'
import { FontAwesomeIcon, getIconProp } from '../lib/icons'
import { type MediaVariant } from '../../lib/media'
import { useMediaUrl } from '../../utils/useMediaUrl'

export function SiteFooter() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [siteTitle, setSiteTitle] = useState<string>('Site')
  const [description, setDescription] = useState<string | null>(null)
  const [logoMedia, setLogoMedia] = useState<any | null>(null)
  const [socialProfiles, setSocialProfiles] = useState<Array<{ network: string; label: string; icon: string; url: string; enabled: boolean }>>([])

  const logoUrl = useMediaUrl(logoMedia)

  useEffect(() => {
    ; (async () => {
      try {
        const res = await fetch('/api/menus/by-slug/footer?locale=en', {
          credentials: 'same-origin',
        })
        if (!res.ok) return
        const j = await res.json().catch(() => ({}))
        const rawItems: MenuItem[] = Array.isArray(j?.data?.items) ? j.data.items : []
        // Only top-level, non-section items
        const topLevel = rawItems.filter((it) => !it.parentId && (it.kind === 'item' || !it.kind))
        setItems(topLevel)
      } catch {
        setItems([])
      }
    })()
  }, [])

  useEffect(() => {
    ; (async () => {
      try {
        const res = await fetch('/api/site-settings', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        const data: any = j?.data || j
        if (data?.siteTitle) {
          setSiteTitle(String(data.siteTitle))
        }
        if (data?.defaultMetaDescription) {
          setDescription(String(data.defaultMetaDescription))
        }
        if (data?.socialSettings?.profiles) {
          setSocialProfiles(data.socialSettings.profiles.filter((p: any) => p.enabled && p.url))
        }

        // Logo media is now pre-resolved on the server and passed directly
        if (data?.logoMedia) {
          setLogoMedia(data.logoMedia)
        }
      } catch {
        // ignore
      }
    })()
  }, [])

  return (
    <footer className="mt-12 border-t border-line-low bg-backdrop-input">
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-8 lg:py-10 text-center">
        <div className="flex justify-center mb-4">
          <a
            href="/"
            className="flex items-center justify-center text-2xl font-semibold text-neutral-high gap-2"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={siteTitle}
                className="h-8 w-auto"
              />
            ) : (
              <span>{siteTitle}</span>
            )}
          </a>
        </div>
        {description && (
          <p className="my-4 text-sm text-neutral-medium max-w-xl mx-auto">
            {description}
          </p>
        )}

        {socialProfiles.length > 0 && (
          <div className="flex justify-center items-center gap-4 mb-6">
            {socialProfiles.map((profile) => (
              <a
                key={profile.network}
                href={profile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-low hover:text-standout-high transition-colors"
                title={profile.label}
              >
                <FontAwesomeIcon icon={getIconProp(profile.icon)} className="w-5 h-5" />
              </a>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <ul className="flex flex-wrap justify-center items-center mb-4 text-sm text-neutral-high gap-x-4 gap-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <MenuItemLink
                  item={item}
                  className="hover:underline text-sm text-neutral-high hover:text-standout-high"
                />
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between max-w-3xl mx-auto">
          <span className="text-xs text-neutral-low">
            © {new Date().getFullYear()} {siteTitle}. All rights reserved.
          </span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  )
}
