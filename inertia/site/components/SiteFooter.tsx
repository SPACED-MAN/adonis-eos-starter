import { ThemeToggle } from '../../components/ThemeToggle'

export function SiteFooter() {
	return (
		<footer className="border-t border-neutral-200 mt-12">
			<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
				<p className="text-sm text-neutral-600">
					Public Site
				</p>
				<ThemeToggle />
			</div>
		</footer>
	)
}


