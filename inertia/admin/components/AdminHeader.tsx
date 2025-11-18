import { Link } from '@inertiajs/react'

export function AdminHeader({ title = 'Admin' }: { title?: string }) {
	return (
		<header className="bg-backdrop-low border-b border-line">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-neutral-high">{title}</h1>
					<div className="flex items-center gap-3">
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


