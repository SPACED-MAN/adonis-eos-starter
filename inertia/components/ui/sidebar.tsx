import React, { createContext, useContext, useEffect, useState } from 'react'
import { cn } from '~/components/ui/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBarsProgress } from '@fortawesome/free-solid-svg-icons'

type SidebarContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    // Push content when sidebar is open (simple body padding strategy)
    try {
      if (open) {
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
  }, [open])
  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>
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
    <button
      type="button"
      aria-expanded={open}
      aria-controls="admin-sidebar"
      onClick={() => setOpen(!open)}
      className={cn(
        'inline-flex items-center rounded p-2 hover:bg-backdrop-medium text-standout-medium',
        className
      )}
    >
      {children ?? <FontAwesomeIcon icon={faBarsProgress} className="w-14 h-14" size="lg" />}
    </button>
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
  const Tag: any = href ? 'a' : 'button'
  return (
    <Tag
      href={href}
      onClick={onClick}
      className={cn(
        'block w-full text-left px-3 py-1 rounded text-sm',
        active
          ? 'bg-backdrop-medium text-neutral-high'
          : 'text-neutral-medium hover:bg-backdrop-medium'
      )}
    >
      {children}
    </Tag>
  )
}
