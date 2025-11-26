import { useEffect, useState } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'

type Row = {
  postType: string
  autoRedirectOnSlugChange: boolean
  hierarchyEnabled: boolean
}

export default function PostTypesSettings() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  // CSRF token from cookie (matches other admin pages)
  const xsrfFromCookie: string | undefined = (() => {
    if (typeof document === 'undefined') return undefined
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : undefined
  })()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/post-types/settings', { credentials: 'same-origin' })
        const json = await res.json().catch(() => ({}))
        const list: Row[] = Array.isArray(json?.data) ? json.data : []
        if (alive) setRows(list)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  async function updateRow(type: string, patch: Partial<Row>) {
    setSaving((prev) => ({ ...prev, [type]: true }))
    try {
      const body: any = {}
      if (patch.autoRedirectOnSlugChange !== undefined) body.autoRedirectOnSlugChange = patch.autoRedirectOnSlugChange
      if (patch.hierarchyEnabled !== undefined) body.hierarchyEnabled = patch.hierarchyEnabled
      const res = await fetch(`/api/post-types/${encodeURIComponent(type)}/settings`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        // surface error
        console.error('Failed to update post type settings')
        return
      }
      // Re-fetch to ensure persistence
      try {
        const fresh = await fetch('/api/post-types/settings', { credentials: 'same-origin' })
        const j = await fresh.json().catch(() => ({}))
        const list: Row[] = Array.isArray(j?.data) ? j.data : []
        setRows(list)
      } catch {
        // fallback optimistic
        setRows((prev) =>
          prev.map((r) => (r.postType === type ? { ...r, ...patch } as Row : r))
        )
      }
    } finally {
      setSaving((prev) => ({ ...prev, [type]: false }))
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-low">
      <AdminHeader title="Post Types" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Post Types' }]} />
        <div className="bg-backdrop-low rounded-lg shadow border border-line">
          <div className="px-6 py-4 border-b border-line">
            <h2 className="text-lg font-semibold text-neutral-high">Post Types</h2>
            <p className="text-sm text-neutral-low mt-1">Manage settings per post type.</p>
          </div>
          <div className="px-6 py-4">
            {loading ? (
              <div className="text-sm text-neutral-medium">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-neutral-low">No post types found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-medium">
                    <th className="py-2">Post Type</th>
                    <th className="py-2">Hierarchy</th>
                    <th className="py-2">Auto Redirect on Slug Change</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.postType} className="border-t border-line">
                      <td className="py-2 text-neutral-high">{r.postType}</td>
                      <td className="py-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={r.hierarchyEnabled}
                            onChange={(e) => updateRow(r.postType, { hierarchyEnabled: e.target.checked })}
                            disabled={!!saving[r.postType]}
                          />
                          <span>Enabled</span>
                        </label>
                      </td>
                      <td className="py-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={r.autoRedirectOnSlugChange}
                            onChange={(e) => updateRow(r.postType, { autoRedirectOnSlugChange: e.target.checked })}
                            disabled={!!saving[r.postType]}
                          />
                          <span>Enabled</span>
                        </label>
                      </td>
                      <td className="py-2 text-right">
                        {saving[r.postType] && <span className="text-xs text-neutral-low">Saving…</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}


