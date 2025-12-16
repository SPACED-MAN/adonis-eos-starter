import { useEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { toast } from 'sonner'

type SitemapStatus = {
  sitemapUrl: string
  lastBuiltAt: string | null
  cacheTtlSeconds: number
}

export default function SeoSettingsPage() {
  const [status, setStatus] = useState<SitemapStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
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
    loadStatus()
  }, [])

  return (
    <>
      <Head title="SEO Settings" />
      <AdminHeader title="SEO Settings" description="Manage XML sitemap." />
      <main className="container mx-auto px-4 pb-16 space-y-6">
        <section className="rounded-lg border border-line-low bg-backdrop-low">
          <div className="px-4 py-3 border-b border-line-low">
            <div className="text-sm font-semibold text-neutral-high">XML Sitemap</div>
            <div className="text-xs text-neutral-medium">
              Public sitemap endpoint for search engines.
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm text-neutral-high">Sitemap URL</div>
                <div className="text-sm text-neutral-medium break-all">
                  {status?.sitemapUrl ||
                    (typeof window !== 'undefined' ? `${window.location.origin}/sitemap.xml` : '—')}
                </div>
              </div>
              <a
                className="inline-flex h-9 items-center rounded-md border border-line-medium bg-backdrop-low px-3 text-sm text-neutral-high hover:bg-backdrop-medium"
                href={
                  status?.sitemapUrl ||
                  (typeof window !== 'undefined'
                    ? `${window.location.origin}/sitemap.xml`
                    : '/sitemap.xml')
                }
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            </div>
            <div className="h-px bg-line-low" />
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm text-neutral-high">Last generated</div>
                <div className="text-sm text-neutral-medium">
                  {status?.lastBuiltAt
                    ? new Date(status.lastBuiltAt).toLocaleString()
                    : 'Not yet generated'}
                </div>
                <div className="text-xs text-neutral-low">
                  Cache TTL: {status?.cacheTtlSeconds ?? 300}s
                </div>
              </div>
              <button
                onClick={rebuild}
                disabled={rebuilding}
                className="inline-flex h-9 items-center rounded-md bg-standout-medium px-3 text-sm text-white hover:bg-standout-medium/90 disabled:opacity-60"
              >
                {rebuilding ? 'Rebuilding…' : 'Rebuild sitemap'}
              </button>
            </div>
            {loading && <div className="text-xs text-neutral-low">Loading status…</div>}
          </div>
        </section>
      </main>
      <AdminFooter />
    </>
  )
}
