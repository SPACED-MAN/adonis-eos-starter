import { Link, usePage } from '@inertiajs/react'

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
		<header className="bg-backdrop-low border-b border-line">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-neutral-high">{title}</h1>
					<div className="flex items-center gap-3">
						{showAdminLinks && (
							<>
								<Link
									href="/admin/settings/url-patterns"
									className="text-sm text-neutral-low hover:text-standout"
								>
									URL Patterns
								</Link>
								<Link
									href="/admin/settings/locales"
									className="text-sm text-neutral-low hover:text-standout"
								>
									Locales
								</Link>
								<Link
									href="/admin/settings/redirects"
									className="text-sm text-neutral-low hover:text-standout"
								>
									Redirects
								</Link>
								<Link
									href="/admin/templates"
									className="text-sm text-neutral-low hover:text-standout"
								>
									Templates
								</Link>
								<Link
									href="/admin/settings/post-types"
									className="text-sm text-neutral-low hover:text-standout"
								>
									Post Types
								</Link>
							</>
						)}
						<Link
							href="/"
							className="text-sm text-neutral-low hover:text-standout"
						>
							View Site
						</Link>
						<Link
							href="/admin/logout"
							method="post"
							as="button"
							className="px-4 py-2 bg-standout text-on-standout rounded-lg font-medium"
						>
							Logout
						</Link>
					</div>
				</div>
			</div>
		</header>
	)
}


