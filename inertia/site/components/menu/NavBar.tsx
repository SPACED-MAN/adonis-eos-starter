import type { TreeNode } from './types'
import { NavItem } from './NavItem'

export function NavBar({
  primaryNodes,
  menuMeta,
  menuName,
  logoLightUrl,
  logoDarkUrl,
  currentUser,
}: {
  primaryNodes: TreeNode[]
  menuMeta?: Record<string, any> | null
  menuName?: string
  logoLightUrl?: string
  logoDarkUrl?: string
  currentUser?: any
}) {

  return (
    <header className="border-b border-line-low bg-backdrop-input/80 backdrop-blur">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2 text-neutral-high font-semibold">
          {logoLightUrl || logoDarkUrl ? (
            <span className="inline-flex items-center">
              {/* Logo image: if menuName exists, use empty alt since it's decorative (menuName is in link text via sr-only) */}
              {/* If no menuName, use generic alt text */}
              <img
                src={logoLightUrl || logoDarkUrl}
                alt={menuName ? '' : 'Site logo'}
                className="h-11 w-auto"
              />
              {/* Keep site title accessible but visually hidden when logo is present */}
              {menuName && <span className="sr-only">{menuName}</span>}
            </span>
          ) : (
            <span className="text-base sm:text-lg whitespace-nowrap">
              {menuName || ''}
            </span>
          )}
        </a>
        <div className="flex-1 flex items-center justify-end gap-6">
          <nav className="hidden md:flex items-center gap-6">
            {primaryNodes.map((n) => (
              <NavItem key={n.id} node={n} menuMeta={menuMeta} />
            ))}
          </nav>

          {/* Auth-aware login/logout shortcut */}
          <div className="hidden md:flex items-center">
            {currentUser ? (
              <a
                href="/admin"
                className="inline-flex items-center rounded-md border border-line-high bg-backdrop px-4 py-3 text-xs sm:text-sm font-medium text-neutral-high hover:bg-backdrop-input hover:text-standout-high min-h-[48px]"
              >
                Dashboard
              </a>
            ) : (
              <a
                href="/admin/login"
                className="inline-flex items-center rounded-md border border-line-high bg-backdrop px-4 py-3 text-xs sm:text-sm font-medium text-neutral-high hover:bg-backdrop-input hover:text-standout-high min-h-[48px]"
              >
                Login
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

