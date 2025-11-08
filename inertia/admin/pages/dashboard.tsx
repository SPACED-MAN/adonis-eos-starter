import { Head, Link } from '@inertiajs/react'

export default function Dashboard() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-sand-2">
      <Head title="Admin" />
      <div className="p-8 rounded-xl border border-sand-6 bg-white shadow-sm space-y-4">
        <h1 className="text-2xl font-bold text-sand-12">Admin Dashboard</h1>
        <p className="text-sand-11">Welcome to the admin area.</p>
        <div className="flex gap-4">
          <Link 
            href="/admin/logout" 
            method="post" 
            as="button" 
            className="px-4 py-2 rounded bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            Logout
          </Link>
          <a href="/" className="text-primary underline hover:no-underline">
            View site
          </a>
        </div>
      </div>
    </div>
  )
}


