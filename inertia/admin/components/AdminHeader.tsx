import { Link, usePage } from '@inertiajs/react'
import { SidebarProvider, SidebarTrigger } from '~/components/ui/sidebar'
import { AdminSidebar } from './AdminSidebar'
import { GlobalAgentButton } from './agents/GlobalAgentButton'
import { useAdminPath } from '~/utils/adminPath'
import { ThemeToggle } from '~/components/ThemeToggle'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSquareArrowUpRight } from '@fortawesome/free-solid-svg-icons'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'

export function AdminHeader({ title = 'Admin' }: { title?: string }) {
  const page = usePage()
  const adminPath = useAdminPath()
  const role: string | undefined =
    (page.props as any)?.currentUser?.role ?? (page.props as any)?.auth?.user?.role
  const isAdminShared: boolean | undefined = (page.props as any)?.isAdmin
  const isAdmin = isAdminShared === true || role === 'admin'
  // Fallback: if auth context is present but role not shared, still show links.
  const showAdminLinks = isAdmin
  return (
    <SidebarProvider>
      <AdminSidebar />
      <header className="bg-backdrop-low border-b border-line-low">
        <div className="h-18 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-3 items-center">
            <div className="flex items-center gap-1">
              {showAdminLinks && <SidebarTrigger />}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href="/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-9 h-9 rounded-lg text-neutral-low hover:text-standout-high hover:bg-backdrop-medium transition-all cursor-pointer"
                    >
                      <FontAwesomeIcon icon={faSquareArrowUpRight} size="lg" />
                      <span className="sr-only">View Site</span>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View site</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex justify-center">
              {title && title !== 'Admin' && (
                <>
                  <h1 className="text-lg font-semibold text-neutral-high">{title}</h1>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-4">
              <ThemeToggle />
              <Link
                href={adminPath('logout')}
                method="post"
                as="button"
                className="px-2 py-0.5 border border-line-low rounded-lg text-sm text-neutral-medium hover:bg-backdrop-medium cursor-pointer"
              >
                Logout
              </Link>
            </div>
          </div>
        </div>
      </header>
      <GlobalAgentButton />
    </SidebarProvider>
  )
}
