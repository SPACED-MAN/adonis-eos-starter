import { ThemeToggle } from '../../components/ThemeToggle'

export function SiteFooter() {
	return (
		<footer className="border-t border-neutral-300 dark:border-neutral-500 mt-12">
			<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
				<p className="text-sm text-neutral-600 dark:text-neutral-500">
					Public Site
				</p>
				<ThemeToggle />
			</div>
		</footer>
	)
}


