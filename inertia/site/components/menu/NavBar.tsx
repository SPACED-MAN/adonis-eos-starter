import type { TreeNode } from './types'
import { NavItem } from './NavItem'
import { MediaRenderer } from '../../../components/MediaRenderer'
import { type MediaObject } from '../../../utils/useMediaUrl'
import { LocaleSwitcher } from '../LocaleSwitcher'
import { MobileNav } from './MobileNav'
import { ThemeToggle } from '../../../components/ThemeToggle'
import * as React from 'react'
import { cn } from '../../../components/ui/utils'

const SearchModal = React.lazy(() =>
  import('../SearchModal').then((m) => ({ default: m.SearchModal }))
)

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
  const [isScrolled, setIsScrolled] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-line-low bg-backdrop/80 backdrop-blur transition-all duration-300',
        isScrolled ? 'bg-backdrop/95 shadow-sm' : 'bg-backdrop/80'
      )}
    >
      <div
        className={cn(
          'container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 transition-all duration-300',
          isScrolled ? 'py-1' : 'py-3'
        )}
      >
        <a href="/" className="flex items-center gap-2 text-neutral-high font-semibold">
          {logo ? (
            <span
              className={cn(
                'inline-flex items-center w-auto transition-all duration-300',
                isScrolled ? 'h-8' : 'h-11'
              )}
            >
              {/* Logo image: if menuName exists, use empty alt since it's decorative (menuName is in link text via sr-only) */}
              {/* If no menuName, use generic alt text */}
              <MediaRenderer
                image={logo}
                alt={menuName ? '' : 'Site logo'}
                className="h-full w-auto object-contain"
                width="132"
                height="44"
              />
              {/* Keep site title accessible but visually hidden when logo is present */}
              {menuName && <span className="sr-only">{menuName}</span>}
            </span>
          ) : (
            <span
              className={cn(
                'whitespace-nowrap transition-all duration-300',
                isScrolled ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
              )}
            >
              {menuName || ''}
            </span>
          )}
        </a>
        <div className="flex-1 flex items-center justify-end gap-6">
          {/* Public search (Autocomplete Modal) */}
          {showSearch && (
            <div className="hidden lg:block">
              <React.Suspense
                fallback={
                  <div className={cn('w-10 transition-all duration-300', isScrolled ? 'h-8' : 'h-10')} />
                }
              >
                <SearchModal variant="icon" placeholder="Search..." />
              </React.Suspense>
            </div>
          )}
          <nav className="hidden lg:flex items-center gap-6">
            {primaryNodes.map((n) => (
              <NavItem key={n.id} node={n} menuMeta={menuMeta} />
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center">
              <ThemeToggle />
            </div>
            <LocaleSwitcher />

            <MobileNav
              primaryNodes={primaryNodes}
              currentUser={currentUser}
              showSearch={showSearch}
              isScrolled={isScrolled}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
