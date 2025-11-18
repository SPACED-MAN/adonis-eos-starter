import { Head, Link } from '@inertiajs/react'
import { AdminHeader } from '../components/AdminHeader'
import { AdminFooter } from '../components/AdminFooter'

interface DashboardProps {
  posts: Array<{
    id: string
    title: string
    slug: string
    status: string
    locale: string
    updatedAt: string
  }>
}

export default function Dashboard({ posts }: DashboardProps) {
  return (
    <div className="min-h-screen bg-backdrop-low">
      <Head title="Admin Dashboard" />

      <AdminHeader title="Admin Dashboard" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low rounded-lg shadow border border-line">
          {/* Posts Header */}
          <div className="px-6 py-4 border-b border-line">
            <h2 className="text-lg font-semibold text-neutral-high">
              Recent Posts
            </h2>
          </div>

          {/* Posts List */}
          <div className="divide-y divide-line">
            {posts.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-neutral-low">No posts yet.</p>
                <p className="text-sm text-neutral-low mt-2">
                  Run the seeder to create test posts.
                </p>
              </div>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="px-6 py-4 hover:bg-backdrop-medium transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-medium text-neutral-high">
                        {post.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-neutral-low">
                        <span className="font-mono">{post.slug}</span>
                        <span>•</span>
                        <span>{post.locale}</span>
                        <span>•</span>
                        <span className="capitalize">{post.status}</span>
                        <span>•</span>
                        <span>{new Date(post.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Link
                      href={`/admin/posts/${post.id}/edit`}
                  className="ml-4 px-4 py-2 text-sm border border-line rounded-lg hover:bg-backdrop-medium text-neutral-medium font-medium"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      <AdminFooter />
    </div>
  )
}


