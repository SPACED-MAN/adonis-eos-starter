import { Head } from '@inertiajs/react'
import { SiteFooter } from '../components/SiteFooter'

export default function Home() {
	return (
		<>
			<div className="min-h-screen w-full bg-backdrop-low flex flex-col">
				<Head title="Home" />
				<main className="flex grow items-center justify-center">
					<div className="p-8 rounded-xl border border-border bg-backdrop-low shadow-sm space-y-4">
						<h1 className="text-2xl font-bold text-neutral-high">AdonisJS x Inertia x React</h1>
						<p className="text-neutral-medium">This is the site entry.</p>
						<div className="flex gap-4">
							<a href="/admin/login" className="text-standout underline hover:no-underline">
								Admin login
							</a>
						</div>
					</div>
				</main>
				<SiteFooter />
			</div>
		</>
	)
}


