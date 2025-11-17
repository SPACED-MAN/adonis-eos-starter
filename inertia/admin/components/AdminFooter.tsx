import { ThemeToggle } from '../../components/ThemeToggle'

export function AdminFooter() {
	return (
		<footer className="border-t border-border mt-12">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
				<p className="text-sm text-neutral-low">
					Admin Panel
				</p>
				<ThemeToggle />
			</div>
		</footer>
	)
}


