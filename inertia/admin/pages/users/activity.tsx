import { useEffect, useState } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { Input } from '../../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { formatDateTime } from '~/utils/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'

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
      const res = await fetch(`/api/activity-logs?${params.toString()}`, {
        credentials: 'same-origin',
      })
      const j = await res.json().catch(() => ({}))
      const list: LogRow[] = Array.isArray(j?.data) ? j.data : []
      setRows(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <AdminHeader title="Activity Log" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low rounded border border-line-low p-6">
          <div className="flex items-center gap-3 mb-4">
            <Input
              placeholder="Filter by user ID"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-48"
            />
            <Input
              placeholder="Filter by action"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-48"
            />
            <button
              className="px-3 py-2 text-sm border border-line-low rounded hover:bg-backdrop-medium text-neutral-high"
              onClick={load}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Apply'}
            </button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell>{r.userEmail || (r.userId ? `User ${r.userId}` : '—')}</TableCell>
                  <TableCell className="font-mono">{r.action}</TableCell>
                  <TableCell>{r.entityType ? `${r.entityType}#${r.entityId || ''}` : '—'}</TableCell>
                  <TableCell>
                    {r.metadata ? <code className="text-xs">{JSON.stringify(r.metadata)}</code> : '—'}
                  </TableCell>
                  <TableCell>{r.ip || '—'}</TableCell>
                </TableRow>
                ))}
                {rows.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-neutral-low">
                      No activity yet.
                  </TableCell>
                </TableRow>
                )}
            </TableBody>
          </Table>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}
