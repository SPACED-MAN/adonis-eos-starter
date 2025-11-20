import { Head, Link } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'

export default function Forbidden({ message = 'Access denied.' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-backdrop-low">
      <Head title="Forbidden" />
      <AdminHeader title="Forbidden" />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="border border-line rounded-lg bg-backdrop-low p-8">
          <h2 className="text-2xl font-semibold text-neutral-high mb-2">You don’t have permission</h2>
          <p className="text-neutral-medium mb-6">{message}</p>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="px-3 py-2 text-sm border border-line rounded hover:bg-backdrop-medium text-neutral-medium">
              Back to Dashboard
            </Link>
            <Link href="/admin/logout" method="post" as="button" className="px-3 py-2 text-sm rounded bg-standout text-on-standout">
              Switch Account
            </Link>
          </div>
        </div>
      </main>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}


