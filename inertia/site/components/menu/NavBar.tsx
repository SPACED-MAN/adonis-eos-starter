import type { TreeNode } from './types'
import { NavItem } from './NavItem'

export function NavBar({
  primaryNodes,
  supportNodes,
  menuMeta,
  menuName,
  logoLightUrl,
  logoDarkUrl,
}: {
  primaryNodes: TreeNode[]
  supportNodes?: TreeNode[]
  menuMeta?: Record<string, any> | null
  menuName?: string
  logoLightUrl?: string
  logoDarkUrl?: string
}) {
  const hasSupport = Array.isArray(supportNodes) && supportNodes.length > 0

  return (
    <header className="border-b border-line bg-backdrop-low/80 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2 text-neutral-high font-semibold">
          {logoLightUrl || logoDarkUrl ? (
            <span className="inline-flex items-center">
              <img
                src={logoLightUrl || logoDarkUrl}
                alt={menuName || 'Site'}
                className="h-7 w-auto"
              />
            </span>
          ) : null}
          <span className="text-base sm:text-lg whitespace-nowrap">
            {menuName || ''}
          </span>
        </a>
        <div className="flex-1 flex items-center justify-end gap-6">
          <nav className="hidden md:flex items-center gap-6">
            {primaryNodes.map((n) => (
              <NavItem key={n.id} node={n} menuMeta={menuMeta} />
            ))}
          </nav>
          {hasSupport && (
            <nav className="hidden md:flex items-center gap-4 text-sm">
              {supportNodes!.map((n) => (
                <NavItem key={n.id} node={n} menuMeta={menuMeta} />
              ))}
            </nav>
          )}
        </div>
      </div>
    </header>
  )
}

