import { useEffect, useState } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { Input } from '../../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { formatDateTime } from '~/utils/format'

type LogRow = {
  id: string
  action: string
  entityType?: string | null
  entityId?: string | null
  metadata?: any
  ip?: string | null
  userAgent?: string | null
  createdAt: string
  userEmail?: string | null
  userId?: number | null
}

export default function ActivityLogPage() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (userFilter) params.set('userId', userFilter)
      if (actionFilter) params.set('action', actionFilter)
      const res = await fetch(`/api/activity-logs?${params.toString()}`, { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      const list: LogRow[] = Array.isArray(j?.data) ? j.data : []
      setRows(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen bg-backdrop-low">
      <AdminHeader title="Activity Log" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Users', href: '/admin/users' }, { label: 'Activity Log' }]} />
        <div className="bg-backdrop-low rounded border border-line p-6">
          <div className="flex items-center gap-3 mb-4">
            <Input placeholder="Filter by user ID" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="w-48" />
            <Input placeholder="Filter by action" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="w-48" />
            <button
              className="px-3 py-2 text-sm border border-line rounded hover:bg-backdrop-medium text-neutral-high"
              onClick={load}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Apply'}
            </button>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-neutral-medium">
                  <th className="text-left py-2 pr-2">When</th>
                  <th className="text-left py-2 pr-2">User</th>
                  <th className="text-left py-2 pr-2">Action</th>
                  <th className="text-left py-2 pr-2">Entity</th>
                  <th className="text-left py-2 pr-2">Details</th>
                  <th className="text-left py-2 pr-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                    <td className="py-2 pr-2">{r.userEmail || (r.userId ? `User ${r.userId}` : '—')}</td>
                    <td className="py-2 pr-2 font-mono">{r.action}</td>
                    <td className="py-2 pr-2">{r.entityType ? `${r.entityType}#${r.entityId || ''}` : '—'}</td>
                    <td className="py-2 pr-2">
                      {r.metadata ? <code className="text-xs">{JSON.stringify(r.metadata)}</code> : '—'}
                    </td>
                    <td className="py-2 pr-2">{r.ip || '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-low">No activity yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}


