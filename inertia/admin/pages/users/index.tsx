import { AdminHeader } from '../../components/AdminHeader'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'

export default function UsersIndex() {
	return (
		<div className="min-h-screen bg-backdrop-low">
			<AdminHeader title="User Management" />
			<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Users' }]} />
				<div className="bg-backdrop-low rounded-lg border border-line p-6">
					<h2 className="text-lg font-semibold text-neutral-high mb-2">User Management</h2>
					<p className="text-sm text-neutral-medium">This section will allow admins to manage users, roles, and passwords. (Coming soon)</p>
				</div>
			</main>
		</div>
	)
}


