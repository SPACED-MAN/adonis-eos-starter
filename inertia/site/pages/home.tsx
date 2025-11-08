import { Head } from '@inertiajs/react'

export default function Home() {
	return (
		<div className="min-h-screen w-full flex items-center justify-center bg-sand-2">
			<Head title="Home" />
			<div className="p-8 rounded-xl border border-sand-6 bg-white shadow-sm space-y-4">
				<h1 className="text-2xl font-bold text-sand-12">AdonisJS x Inertia x React</h1>
				<p className="text-sand-11">This is the site entry.</p>
				<div className="flex gap-4">
					<a href="/admin/login" className="text-primary underline hover:no-underline">
						Admin login
					</a>
				</div>
			</div>
		</div>
	)
}


