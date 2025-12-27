import { useEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { toast } from 'sonner'
import { Badge } from '~/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '~/components/ui/chart'
import { CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMousePointer,
  faEye,
  faExternalLinkAlt,
  faSitemap,
  faFire,
} from '@fortawesome/free-solid-svg-icons'
import { HeatmapModal } from '../../components/analytics/HeatmapModal'

type SitemapStatus = {
  sitemapUrl: string
  lastBuiltAt: string | null
  cacheTtlSeconds: number
}

type AnalyticsPost = {
  id: string
  title: string
  slug: string
  views: number
  publicPath: string
}

type AnalyticsDay = {
  date: string
  views: number
  clicks: number
}

type AnalyticsSummary = {
  summary: {
    totalViews: number
    totalClicks: number
  }
  topPosts: AnalyticsPost[]
  statsOverTime: AnalyticsDay[]
}

const chartConfig = {
  views: {
    label: 'Views',
    color: '#3b82f6',
  },
  clicks: {
    label: 'Interactions',
    color: '#f97316',
  },
} satisfies ChartConfig

export default function SeoSettingsPage() {
  const [activeTab, setActiveTab] = useState<'sitemap' | 'analytics'>('analytics')
  const [status, setStatus] = useState<SitemapStatus | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [selectedPostForHeatmap, setSelectedPostForHeatmap] = useState<AnalyticsPost | null>(null)
  const [heatmapOpen, setHeatmapOpen] = useState(false)

  const xsrfFromCookie: string | undefined = (() => {
    if (typeof document === 'undefined') return undefined
    const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : undefined
  })()

  async function loadStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/seo/sitemap/status', { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      setStatus(j?.data ?? null)
    } catch {
      toast.error('Failed to load sitemap status')
    } finally {
      setLoading(false)
    }
  }

  async function loadAnalytics() {
    setLoadingAnalytics(true)
    try {
      const res = await fetch('/api/analytics/summary', { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      setAnalytics(j)
    } catch {
      toast.error('Failed to load analytics')
    } finally {
      setLoadingAnalytics(false)
    }
  }

  async function rebuild() {
    setRebuilding(true)
    try {
      const res = await fetch('/api/seo/sitemap/rebuild', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
        },
      })
      if (!res.ok) throw new Error('rebuild failed')
      await loadStatus()
      toast.success('Sitemap rebuilt')
    } catch {
      toast.error('Failed to rebuild sitemap')
    } finally {
      setRebuilding(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'sitemap') loadStatus()
    if (activeTab === 'analytics') loadAnalytics()
  }, [activeTab])

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Analytics" />
      <AdminHeader
        title="Analytics"
        description="Manage your search engine presence and track user interactions."
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-line-low mb-6">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'analytics'
                  ? 'border-standout-medium text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              }`}
            >
              <FontAwesomeIcon icon={faFire} className="w-3.5 h-3.5" />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('sitemap')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'sitemap'
                  ? 'border-standout-medium text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              }`}
            >
              <FontAwesomeIcon icon={faSitemap} className="w-3.5 h-3.5" />
              XML Sitemap
            </button>
          </nav>
        </div>

        {activeTab === 'sitemap' && (
          <section className="rounded-lg border border-line-low bg-backdrop-low overflow-hidden">
            <div className="px-6 py-4 border-b border-line-low bg-backdrop">
              <h3 className="text-base font-semibold text-neutral-high">XML Sitemap</h3>
              <p className="text-sm text-neutral-medium">
                Public sitemap endpoint for search engines.
              </p>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-neutral-high">Sitemap URL</div>
                  <div className="text-sm text-neutral-medium font-mono break-all">
                    {status?.sitemapUrl ||
                      (typeof window !== 'undefined'
                        ? `${window.location.origin}/sitemap.xml`
                        : '—')}
                  </div>
                </div>
                <a
                  className="inline-flex h-9 items-center rounded-md border border-line-medium bg-backdrop-low px-4 text-sm font-medium text-neutral-high hover:bg-backdrop-medium transition-colors gap-2"
                  href={
                    status?.sitemapUrl ||
                    (typeof window !== 'undefined'
                      ? `${window.location.origin}/sitemap.xml`
                      : '/sitemap.xml')
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} className="w-3 h-3" />
                  Open
                </a>
              </div>

              <div className="h-px bg-line-low" />

              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-neutral-high">Last generated</div>
                  <div className="text-sm text-neutral-medium">
                    {status?.lastBuiltAt
                      ? new Date(status.lastBuiltAt).toLocaleString()
                      : 'Not yet generated'}
                  </div>
                  <div className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500 uppercase tracking-tight">
                    Cache TTL: {status?.cacheTtlSeconds ?? 300}s
                  </div>
                </div>
                <button
                  onClick={rebuild}
                  disabled={rebuilding}
                  className="inline-flex h-9 items-center rounded-md bg-standout-medium px-4 text-sm font-medium text-white hover:bg-standout-medium/90 disabled:opacity-60 transition-colors"
                >
                  {rebuilding ? 'Rebuilding…' : 'Rebuild sitemap'}
                </button>
              </div>
              {loading && (
                <div className="text-xs text-neutral-low animate-pulse">Loading status…</div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-backdrop-low rounded-lg border border-line-low p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <FontAwesomeIcon icon={faEye} />
                  </div>
                  <div>
                    <div className="text-sm text-neutral-medium">Total Page Views</div>
                    <div className="text-2xl font-bold text-neutral-high">
                      {analytics?.summary.totalViews.toLocaleString() ?? '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-backdrop-low rounded-lg border border-line-low p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <FontAwesomeIcon icon={faMousePointer} />
                  </div>
                  <div>
                    <div className="text-sm text-neutral-medium">Total Interactions</div>
                    <div className="text-2xl font-bold text-neutral-high">
                      {analytics?.summary.totalClicks.toLocaleString() ?? '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <section className="bg-backdrop-low rounded-lg border border-line-low overflow-hidden p-6">
              <h3 className="text-base font-semibold text-neutral-high mb-6">Traffic Over Time</h3>
              <div className="h-[300px] w-full">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <LineChart
                    data={analytics?.statsOverTime || []}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickFormatter={(value) => {
                        const date = new Date(value)
                        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="var(--color-views)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="clicks"
                      stroke="var(--color-clicks)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </section>

            {/* Top Posts Table */}
            <section className="bg-backdrop-low rounded-lg border border-line-low overflow-hidden">
              <div className="px-6 py-4 border-b border-line-low bg-backdrop">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-high">Popular Pages</h3>
                    <p className="text-sm text-neutral-medium">
                      Most visited content and interaction hotspots.
                    </p>
                  </div>
                  {loadingAnalytics && (
                    <span className="text-xs text-neutral-low animate-pulse">Updating…</span>
                  )}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page Title</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!analytics || analytics.topPosts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-neutral-low">
                        {loadingAnalytics
                          ? 'Loading analytics...'
                          : 'No data collected yet. Interactions are tracked on the public site.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    analytics.topPosts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="font-medium text-neutral-high">
                          {post.title}
                        </TableCell>
                        <TableCell className="text-neutral-medium font-mono text-xs">
                          {post.publicPath || `/${post.slug}`}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="font-mono">
                            {post.views.toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={() => {
                              setSelectedPostForHeatmap(post)
                              setHeatmapOpen(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium border border-line-medium rounded hover:bg-backdrop-medium text-neutral-high transition-colors"
                          >
                            <FontAwesomeIcon icon={faFire} className="text-orange-500" />
                            View Heatmap
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </section>
          </div>
        )}
      </main>

      <HeatmapModal
        post={selectedPostForHeatmap}
        open={heatmapOpen}
        onOpenChange={setHeatmapOpen}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}
