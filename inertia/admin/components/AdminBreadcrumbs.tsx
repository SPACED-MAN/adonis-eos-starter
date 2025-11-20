import { Link } from '@inertiajs/react'

export function AdminBreadcrumbs({
	items = [],
	rightLink,
}: {
	items?: Array<{ label: string; href?: string }>
	rightLink?: { label: string; href: string }
}) {
	return (
		<div className="mb-4 flex items-center justify-between">
			<nav className="text-sm text-neutral-medium">
				<ol className="flex items-center gap-2">
					{items.map((item, idx) => (
						<li key={idx} className="flex items-center gap-2">
							{item.href ? (
								<Link href={item.href} className="hover:text-standout">
									{item.label}
								</Link>
							) : (
								<span className="text-neutral-high">{item.label}</span>
							)}
							{idx < items.length - 1 && <span className="text-neutral-low">/</span>}
						</li>
					))}
				</ol>
			</nav>
			{rightLink && (
				<Link
					href={rightLink.href}
					className="px-3 py-2 text-sm border border-line rounded bg-backdrop-low hover:bg-backdrop-medium text-neutral-high"
				>
					{rightLink.label}
				</Link>
			)}
		</div>
	)
}


