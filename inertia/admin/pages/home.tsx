import { useEffect, useState } from 'react'
import { Head, router, Link } from '@inertiajs/react'
import { AdminHeader } from '../components/AdminHeader'
import { AdminFooter } from '../components/AdminFooter'
import { toast } from 'sonner'
import { DashboardWidget } from '../components/DashboardWidget'
import { Clock, FileText, ChevronRight } from 'lucide-react'
import { useAdminPath } from '~/utils/adminPath'

function getXsrf(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

interface Post {
  id: string
  title: string
  slug: string
  status: string
  locale: string
  updatedAt: string
}

interface Widget {
  type: 'seo' | 'analytics' | 'security' | 'media' | 'forms'
  title: string
  data: any
}

interface Props {
  recentPosts: Post[]
  widgets: Widget[]
}

export default function Home({ recentPosts = [], widgets = [] }: Props) {
  const adminPath = useAdminPath()
  const [profileEnabled, setProfileEnabled] = useState<boolean>(false)
  const [hasProfile, setHasProfile] = useState<boolean>(false)
  const [profilePostId, setProfilePostId] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/profile/status', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        if (j?.data) {
          setProfileEnabled(!!j.data.enabledForRole)
          setHasProfile(!!j.data.hasProfile)
          setProfilePostId(j.data.profilePostId || null)
        }
      } catch {
        /* ignore */
      }
    })()
  }, [])

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Dashboard" />
      <AdminHeader title="Dashboard" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="bg-gradient-to-r from-standout-low to-backdrop-low rounded-2xl border border-line-low p-6 sm:p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-neutral-high mb-2">Welcome back!</h1>
            <p className="text-neutral-medium max-w-2xl">
              Here is what's happening with your site today. You can manage your content,
              view analytics, and monitor site health from this dashboard.
            </p>
          </div>
        </div>

        {profileEnabled && !hasProfile && (
          <div className="mb-8 bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-neutral-high mb-1">
                Complete your Profile
              </h3>
              <p className="text-sm text-neutral-medium">
                Create your author profile to manage your bio and social links displayed on your posts.
              </p>
            </div>
            <button
              className="px-4 py-2 text-sm font-medium border border-line-low rounded-lg bg-standout-high text-on-high hover:bg-standout-medium transition-colors whitespace-nowrap"
              onClick={async () => {
                const res = await fetch('/api/users/me/profile', {
                  method: 'POST',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
                  },
                  credentials: 'same-origin',
                })
                const j = await res.json().catch(() => ({}))
                if (res.ok && j?.id) {
                  router.visit(adminPath(`posts/${j.id}/edit`))
                } else if (res.ok && profilePostId) {
                  router.visit(adminPath(`posts/${profilePostId}/edit`))
                } else {
                  toast.error(j?.error || 'Failed to create profile')
                }
              }}
            >
              Create Profile
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area - Widgets */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-neutral-high mb-4 flex items-center gap-2">
                Insights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {widgets.map((widget, i) => (
                  <DashboardWidget key={i} {...widget} />
                ))}
                {widgets.length === 0 && (
                  <div className="col-span-2 py-12 text-center bg-backdrop-low rounded-xl border border-dashed border-line-low">
                    <p className="text-neutral-low">No insights available for your role.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar - Recent Activity */}
          <div className="space-y-8">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-high flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Recent Activity
                </h2>
                <Link 
                  href={adminPath('posts')} 
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  View All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="bg-backdrop-low rounded-xl border border-line-low overflow-hidden">
                {recentPosts.length > 0 ? (
                  <div className="divide-y divide-line-low">
                    {recentPosts.map((post) => (
                      <Link
                        key={post.id}
                        href={adminPath(`posts/${post.id}/edit`)}
                        className="block p-4 hover:bg-backdrop-medium transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 p-1.5 bg-backdrop-medium rounded border border-line-low group-hover:border-line-medium transition-colors">
                            <FileText className="w-4 h-4 text-neutral-medium" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-medium text-neutral-high truncate group-hover:text-standout-high transition-colors">
                              {post.title || 'Untitled'}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider ${
                                post.status === 'published' 
                                  ? 'bg-emerald-500/10 text-emerald-500' 
                                  : 'bg-amber-500/10 text-amber-500'
                              }`}>
                                {post.status}
                              </span>
                              <span className="text-[11px] text-neutral-low italic">
                                Updated {new Date(post.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-neutral-low text-sm">No recent activity.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}
