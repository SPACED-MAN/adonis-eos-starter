import { useEffect, useState } from 'react'
import { ThemeToggle } from '../../components/ThemeToggle'
import type { MenuItem } from './menu/types'
import { MenuItemLink } from './menu/MenuItemLink'

export function SiteFooter() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [siteTitle, setSiteTitle] = useState<string>('Site')

  useEffect(() => {
    ; (async () => {
      try {
        const res = await fetch('/api/menus/by-slug/footer?locale=en', { credentials: 'same-origin' })
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
            {/* Simple gradient logo inspired by Flowbite */}
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-standout text-on-standout">
              <span className="text-sm font-bold">AE</span>
            </span>
            <span>{siteTitle}</span>
          </a>
        </div>
        <p className="my-4 text-sm text-neutral-medium max-w-xl mx-auto">
          Build and manage rich marketing pages with reusable content blocks, media, and navigation—powered
          by the Adonis EOS starter.
        </p>
        {items.length > 0 && (
          <ul className="flex flex-wrap justify-center items-center mb-4 text-sm text-neutral-high gap-x-4 gap-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <MenuItemLink
                  item={item}
                  className="hover:underline text-sm text-neutral-high hover:text-standout"
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
            <span className="text-xs text-neutral-low">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  )
}

