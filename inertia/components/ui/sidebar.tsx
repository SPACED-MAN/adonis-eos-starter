import React, { createContext, useContext, useEffect, useState } from 'react'
import { Link } from '@inertiajs/react'
import { cn } from '~/components/ui/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBarsProgress } from '@fortawesome/free-solid-svg-icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'

type SidebarContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
  isMobile: boolean
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    // If we transition to mobile, close the sidebar by default
    if (isMobile) {
      setOpen(false)
    } else {
      setOpen(true)
    }
  }, [isMobile])

  useEffect(() => {
    // Push content when sidebar is open (only on desktop)
    try {
      if (open && !isMobile) {
        document.body.style.paddingLeft = '16rem'
      } else {
        document.body.style.paddingLeft = ''
      }
    } catch { }
    return () => {
      try {
        document.body.style.paddingLeft = ''
      } catch { }
    }
  }, [open, isMobile])

  return (
    <SidebarContext.Provider value={{ open, setOpen, isMobile }}>
      {children}
      {isMobile && open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}
    </SidebarContext.Provider>
  )
}

function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('Sidebar components must be used within <SidebarProvider>')
  return ctx
}

export function Sidebar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { open, setOpen } = useSidebar()
  return (
    <>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-full w-64 bg-backdrop-low border-r border-line-low',
          'transition-transform',
          open ? 'translate-x-0' : '-translate-x-full',
          className
        )}
        aria-hidden={!open}
      >
        {children}
      </aside>
    </>
  )
}

export function SidebarTrigger({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  const { open, setOpen } = useSidebar()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => setOpen(!open)}
          className={cn(
            'inline-flex items-center rounded p-2 hover:bg-backdrop-medium text-standout-high',
            className
          )}
        >
          {children ?? <FontAwesomeIcon icon={faBarsProgress} size="lg" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{open ? 'Collapse Sidebar' : 'Expand Sidebar'}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function SidebarContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      id="admin-sidebar"
      className={cn(
        'h-full overflow-y-auto',
        '[scrollbar-width:thin] [scrollbar-color:var(--color-line-low)_transparent]',
        '[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-line-low [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-line-medium',
        className
      )}
    >
      {children}
    </div>
  )
}

export function SidebarHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('h-18 px-4 py-4', className)}>{children}</div>
}

export function SidebarGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="px-2 py-4 border-t border-line-low">
      {title && (
        <div className="px-2 text-xs font-semibold text-neutral-medium uppercase tracking-wide mb-2">
          {title}
        </div>
      )}
      <nav className="space-y-1">{children}</nav>
    </div>
  )
}

export function SidebarMenuItem({
  children,
  href,
  active,
  onClick,
}: {
  children: React.ReactNode
  href?: string
  active?: boolean
  onClick?: () => void
}) {
  const { isMobile, setOpen } = useSidebar()

  const handleClick = (e: React.MouseEvent) => {
    if (isMobile) {
      setOpen(false)
    }
    if (onClick) {
      onClick()
    }
  }

  if (href) {
    return (
      <Link
        href={href}
        onClick={handleClick}
        className={cn(
          'block w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors',
          active
            ? 'bg-standout-high text-on-high shadow-sm'
            : 'text-neutral-medium hover:bg-backdrop-medium hover:text-neutral-high'
        )}
      >
        {children}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'block w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors',
        active
          ? 'bg-standout-high text-on-high shadow-sm'
          : 'text-neutral-medium hover:bg-backdrop-medium hover:text-neutral-high'
      )}
    >
      {children}
    </button>
  )
}
