import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetHeader,
  SheetDescription,
} from '~/components/ui/sheet'
import { type TreeNode } from './types'
import { MenuItemLink } from './MenuItemLink'
import { ThemeToggle } from '../../../components/ThemeToggle'
import { SearchModal } from '../SearchModal'
import { cn } from '../../../components/ui/utils'
import * as React from 'react'

export function MobileNav({
  primaryNodes,
  showSearch = true,
  isScrolled = false,
}: {
  primaryNodes: TreeNode[]
  currentUser?: any
  showSearch?: boolean
  isScrolled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="lg:hidden flex items-center">
        <button
          className={cn(
            'flex items-center justify-center rounded-md border border-line-medium bg-backdrop text-neutral-high hover:bg-backdrop-medium outline-none focus:ring-2 focus:ring-standout-high/30 transition-all duration-300',
            isScrolled ? 'h-8 w-8' : 'h-10 w-10'
          )}
        >
          <Menu className={isScrolled ? 'h-5 w-5' : 'h-6 w-6'} />
          <span className="sr-only">Toggle menu</span>
        </button>
      </div>
    )
  }

  return (
    <div className="lg:hidden flex items-center">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            className={cn(
              'flex items-center justify-center rounded-md border border-line-medium bg-backdrop text-neutral-high hover:bg-backdrop-medium outline-none focus:ring-2 focus:ring-standout-high/30 transition-all duration-300',
              isScrolled ? 'h-8 w-8' : 'h-10 w-10'
            )}
          >
            <Menu className={isScrolled ? 'h-5 w-5' : 'h-6 w-6'} />
            <span className="sr-only">Toggle menu</span>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[400px] border-line-low">
          <SheetHeader>
            <SheetTitle className="text-left text-neutral-high">Menu</SheetTitle>
            <SheetDescription className="sr-only">
              Browse site pages and documentation.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-6 py-8">
            {showSearch && (
              <div className="px-2">
                <SearchModal placeholder="Search site..." variant="navbar" />
              </div>
            )}
            <nav className="flex flex-col gap-1">
              {primaryNodes.map((node) => (
                <div key={node.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between px-2 py-2">
                    <MenuItemLink
                      item={node}
                      className="text-lg font-medium text-neutral-high hover:text-standout-high transition-colors"
                    />
                  </div>
                  {node.children.length > 0 && (
                    <div className="ml-4 flex flex-col gap-1 border-l border-line-low pl-4 mb-2">
                      {node.children.map((child) => (
                        <MenuItemLink
                          key={child.id}
                          item={child}
                          className="px-2 py-1.5 text-base text-neutral-medium hover:text-standout-high transition-colors"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            <div className="mt-auto pt-6 border-t border-line-low">
              <div className="flex items-center justify-between px-2">
                <span className="text-sm font-medium text-neutral-medium">Appearance</span>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

