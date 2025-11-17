import { Link } from '@inertiajs/react'

export function AdminHeader({ title = 'Admin' }: { title?: string }) {
	return (
		<header className="bg-bg-100 border-b border-neutral-200">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
					<div className="flex items-center gap-3">
						<Link
							href="/admin/settings/url-patterns"
							className="text-sm text-neutral-600 hover:text-neutral-900"
						>
							URL Patterns
						</Link>
						<Link
							href="/admin/settings/redirects"
							className="text-sm text-neutral-600 hover:text-neutral-900"
						>
							Redirects
						</Link>
						<Link
							href="/"
							className="text-sm text-neutral-600 hover:text-neutral-900"
						>
							View Site
						</Link>
						<Link
							href="/admin/logout"
							method="post"
							as="button"
							className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
						>
							Logout
						</Link>
					</div>
				</div>
			</div>
		</header>
	)
}


