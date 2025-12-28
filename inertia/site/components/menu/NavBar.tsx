import type { TreeNode } from './types'
import { NavItem } from './NavItem'
import { MediaRenderer } from '../../../components/MediaRenderer'
import { type MediaObject } from '../../../utils/useMediaUrl'
import { LocaleSwitcher } from '../LocaleSwitcher'
import { MobileNav } from './MobileNav'

export function NavBar({
  primaryNodes,
  menuMeta,
  menuName,
  logo,
  currentUser,
  showSearch = true,
}: {
  primaryNodes: TreeNode[]
  menuMeta?: Record<string, any> | null
  menuName?: string
  logo?: MediaObject | string
  currentUser?: any
  showSearch?: boolean
}) {
  return (
    <header className="border-b border-line-low bg-backdrop/80 backdrop-blur">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2 text-neutral-high font-semibold">
          {logo ? (
            <span className="inline-flex items-center h-11 w-auto">
              {/* Logo image: if menuName exists, use empty alt since it's decorative (menuName is in link text via sr-only) */}
              {/* If no menuName, use generic alt text */}
              <MediaRenderer
                image={logo}
                alt={menuName ? '' : 'Site logo'}
                className="h-11 w-auto object-contain"
                width="132"
                height="44"
              />
              {/* Keep site title accessible but visually hidden when logo is present */}
              {menuName && <span className="sr-only">{menuName}</span>}
            </span>
          ) : (
            <span className="text-base sm:text-lg whitespace-nowrap">{menuName || ''}</span>
          )}
        </a>
        <div className="flex-1 flex items-center justify-end gap-6">
          {/* Public search (GET -> /search) */}
          {showSearch && (
            <form action="/search" method="get" className="hidden lg:flex items-center gap-2">
              <input
                type="search"
                name="q"
                placeholder="Search…"
                className="w-64 rounded-md border border-line-medium bg-backdrop px-3 py-2 text-sm text-neutral-high placeholder:text-neutral-low outline-none focus:ring-2 focus:ring-standout-medium/30 focus:border-standout-medium/40"
              />
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-line-medium bg-backdrop px-3 py-2 text-sm font-medium text-neutral-high hover:bg-backdrop-medium hover:text-standout-high"
              >
                Search
              </button>
            </form>
          )}
          <nav className="hidden md:flex items-center gap-6">
            {primaryNodes.map((n) => (
              <NavItem key={n.id} node={n} menuMeta={menuMeta} />
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <LocaleSwitcher />

            <MobileNav primaryNodes={primaryNodes} currentUser={currentUser} />

            {/* Auth-aware login/logout shortcut */}
            <div className="hidden md:flex items-center">
              {currentUser ? (
                <a
                  href="/admin"
                  className="inline-flex items-center rounded-md border border-line-high bg-backdrop px-4 py-3 text-xs sm:text-sm font-medium text-neutral-high hover:bg-backdrop-medium hover:text-standout-high min-h-[48px]"
                >
                  Dashboard
                </a>
              ) : (
                <a
                  href="/admin/login"
                  className="inline-flex items-center rounded-md border border-line-high bg-backdrop px-4 py-3 text-xs sm:text-sm font-medium text-neutral-high hover:bg-backdrop-medium hover:text-standout-high min-h-[48px]"
                >
                  Login
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
