import { Link, usePage } from '@inertiajs/react'
import { SidebarProvider, SidebarTrigger } from '~/components/ui/sidebar'
import { AdminSidebar } from './AdminSidebar'
import { GlobalAgentButton } from './agents/GlobalAgentButton'

export function AdminHeader({ title = 'Admin' }: { title?: string }) {
	const page = usePage()
	const role: string | undefined =
		(page.props as any)?.currentUser?.role ??
		(page.props as any)?.auth?.user?.role
	const isAdminShared: boolean | undefined = (page.props as any)?.isAdmin
	const isAdmin = isAdminShared === true || role === 'admin'
	// Fallback: if auth context is present but role not shared, still show links.
	const isAuthenticated = !!((page.props as any)?.auth?.user || (page.props as any)?.currentUser)
	const showAdminLinks = isAdmin
	return (
		<SidebarProvider>
			<AdminSidebar />
			<header className="bg-backdrop-low border-b border-line-low">
				<div className="h-18 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							{showAdminLinks && <SidebarTrigger />}
							<h1 className="text-2xl font-bold text-neutral-high">{title}</h1>
						</div>
						<div className="flex items-center gap-3">
							<a
								href="/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-neutral-low hover:text-standout-high cursor-pointer"
							>
								View Site
							</a>
							<Link
								href="/admin/logout"
								method="post"
								as="button"
								className="px-3 py-1.5 border border-line-low rounded-lg text-sm text-neutral-medium hover:bg-backdrop-medium cursor-pointer"
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


