import { useEffect, useState } from 'react'
import { Head, usePage } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { useAdminPath } from '../../../utils/adminPath'
import { Badge } from '../../../components/ui/badge'
import { Input } from '../../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShield,
  faCheckCircle,
  faExclamationTriangle,
  faTimesCircle,
  faInfoCircle,
  faClock,
  faTrash,
  faDownload,
  faSearch,
  faLock,
} from '@fortawesome/free-solid-svg-icons'

interface SecurityPosture {
  checks: Record<
    string,
    {
      label: string
      status: 'pass' | 'fail' | 'warn' | 'info'
      message: string
      recommendation: string | null
    }
  >
  summary: {
    passed: number
    total: number
    overallStatus: 'pass' | 'warn' | 'fail'
  }
}

interface AuditLog {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  metadata: any
  ip: string | null
  userAgent: string | null
  createdAt: string
  userEmail: string | null
  userId: number | null
}

interface Session {
  id: string
  userId: number
  email: string
  current: boolean
  ip: string
  userAgent: string
  lastActivity: string
}

export default function SecurityIndex() {
  const { props } = usePage<any>()
  const features = props.features || {}
  const adminPath = useAdminPath()
  const [posture, setPosture] = useState<SecurityPosture | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('posture')

  // Audit filters state
  const [q, setQ] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityTypeFilter, setEntityTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [auditMeta, setAuditMeta] = useState<{ actions: string[]; entityTypes: string[] }>({
    actions: [],
    entityTypes: [],
  })

  useEffect(() => {
    loadPosture()
    if (features.activeSessions !== false) {
      loadSessions()
    }
    if (features.auditLogs !== false) {
      loadAuditMeta()
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'audit' && features.auditLogs !== false) {
      loadAuditLogs()
    }
  }, [activeTab, q, actionFilter, entityTypeFilter, page, limit])

  async function loadPosture() {
    try {
      const res = await fetch('/api/security/posture', { credentials: 'same-origin' })
      const data = await res.json()
      setPosture(data)
    } catch (err) {
      console.error('Failed to load security posture', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadSessions() {
    try {
      const res = await fetch('/api/security/sessions', { credentials: 'same-origin' })
      const data = await res.json()
      setSessions(data.data || [])
    } catch (err) {
      console.error('Failed to load sessions', err)
    }
  }

  async function loadAuditMeta() {
    try {
      const res = await fetch('/api/security/audit-logs/meta', { credentials: 'same-origin' })
      const data = await res.json()
      setAuditMeta(data)
    } catch (err) {
      console.error('Failed to load audit meta', err)
    }
  }

  async function loadAuditLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (actionFilter !== 'all') params.set('action', actionFilter)
      if (entityTypeFilter !== 'all') params.set('entityType', entityTypeFilter)
      params.set('page', String(page))
      params.set('limit', String(limit))

      const res = await fetch(`/api/security/audit-logs?${params.toString()}`, {
        credentials: 'same-origin',
      })
      const data = await res.json()
      setAuditLogs(data.data || [])
      setTotal(data.pagination?.total || 0)
    } catch (err) {
      console.error('Failed to load audit logs', err)
    } finally {
      setLoading(false)
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'pass':
        return <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
      case 'fail':
        return <FontAwesomeIcon icon={faTimesCircle} className="text-red-500" />
      case 'warn':
        return <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-500" />
      default:
        return <FontAwesomeIcon icon={faInfoCircle} className="text-blue-500" />
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-500">Pass</Badge>
      case 'fail':
        return <Badge className="bg-red-500">Fail</Badge>
      case 'warn':
        return <Badge className="bg-yellow-500">Warning</Badge>
      default:
        return <Badge className="bg-blue-500">Info</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Security" />
      <AdminHeader title="Security Center" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-line-low mb-6">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('posture')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'posture'
                  ? 'border-standout-medium text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              }`}
            >
              Security Posture
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'sessions'
                  ? 'border-standout-medium text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              } ${features.activeSessions === false ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              title={features.activeSessions === false ? 'This feature is disabled' : ''}
              disabled={features.activeSessions === false}
            >
              Active Sessions
              {features.activeSessions === false && (
                <FontAwesomeIcon icon={faLock} className="ml-2 w-3 h-3" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'audit'
                  ? 'border-standout-medium text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              } ${features.auditLogs === false ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              title={features.auditLogs === false ? 'This feature is disabled' : ''}
              disabled={features.auditLogs === false}
            >
              Audit Logs
              {features.auditLogs === false && (
                <FontAwesomeIcon icon={faLock} className="ml-2 w-3 h-3" />
              )}
            </button>
          </nav>
        </div>

        {/* Posture Tab */}
        {activeTab === 'posture' && (
          <div className="space-y-6">
            {loading && !posture ? (
              <div className="text-center py-8 text-neutral-medium">Loading...</div>
            ) : posture ? (
              <div className="bg-backdrop-low rounded-lg border border-line-low p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-neutral-high mb-2 flex items-center gap-2">
                    <FontAwesomeIcon icon={faShield} />
                    Security Posture Overview
                  </h2>
                  <p className="text-sm text-neutral-medium">
                    {posture.summary.passed} of {posture.summary.total} checks passed
                  </p>
                </div>
                <div className="space-y-4">
                  {Object.entries(posture.checks).map(([key, check]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between p-4 border border-line-low rounded-lg bg-backdrop"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">{getStatusIcon(check.status)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-neutral-high">{check.label}</span>
                            {getStatusBadge(check.status)}
                          </div>
                          <p className="text-sm text-neutral-medium">{check.message}</p>
                          {check.recommendation && (
                            <p className="text-sm text-yellow-600 mt-1">
                              Recommendation: {check.recommendation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-neutral-medium">
                Failed to load security posture
              </div>
            )}
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && features.activeSessions !== false && (
          <div className="bg-backdrop-low rounded-lg border border-line-low p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-neutral-high mb-2">Active Sessions</h2>
              <p className="text-sm text-neutral-medium">Manage your active login sessions</p>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-neutral-medium">No active sessions found</div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 border border-line-low rounded-lg bg-backdrop"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-neutral-high">{session.email}</span>
                        {session.current && <Badge className="bg-blue-500">Current Session</Badge>}
                      </div>
                      <div className="text-sm text-neutral-medium space-y-1">
                        <div>IP: {session.ip || 'N/A'}</div>
                        <div>User Agent: {session.userAgent || 'N/A'}</div>
                        <div className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
                          Last activity: {new Date(session.lastActivity).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {!session.current && (
                      <button
                        className="px-3 py-2 text-sm border border-red-500 text-red-500 rounded hover:bg-red-50 transition-colors"
                        onClick={async () => {
                          try {
                            await fetch(`/api/security/sessions/${session.id}`, {
                              method: 'DELETE',
                              credentials: 'same-origin',
                            })
                            loadSessions()
                          } catch (err) {
                            console.error('Failed to revoke session', err)
                          }
                        }}
                      >
                        <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'audit' && features.auditLogs !== false && (
          <div className="bg-backdrop-low rounded-lg border border-line-low overflow-hidden">
            <div className="p-6 border-b border-line-low">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-high mb-2">Audit Logs</h2>
                  <p className="text-sm text-neutral-medium">
                    View system activity and security events
                  </p>
                </div>
                <button
                  className="px-4 py-2 text-sm border border-line-low rounded hover:bg-backdrop-medium text-neutral-high transition-colors flex items-center gap-2"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/security/audit-logs?limit=1000', {
                        credentials: 'same-origin',
                      })
                      const data = await res.json()
                      const blob = new Blob([JSON.stringify(data.data, null, 2)], {
                        type: 'application/json',
                      })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `audit-logs-${new Date().toISOString()}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                    } catch (err) {
                      console.error('Failed to export audit logs', err)
                    }
                  }}
                >
                  <FontAwesomeIcon icon={faDownload} className="w-4 h-4" />
                  Export
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative max-w-sm flex-1">
                  <Input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value)
                      setPage(1)
                    }}
                    placeholder="Search logs..."
                    className="pl-9"
                  />
                  <FontAwesomeIcon
                    icon={faSearch}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-low w-3.5 h-3.5"
                  />
                </div>

                <Select
                  value={actionFilter}
                  onValueChange={(val) => {
                    setActionFilter(val)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {auditMeta.actions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={entityTypeFilter}
                  onValueChange={(val) => {
                    setEntityTypeFilter(val)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All entity types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entity types</SelectItem>
                    {auditMeta.entityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={String(limit)}
                  onValueChange={(val) => {
                    setLimit(Number(val))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                    <SelectItem value="100">100 / page</SelectItem>
                  </SelectContent>
                </Select>

                {loading && (
                  <span className="text-xs text-neutral-low animate-pulse">Loading...</span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-neutral-medium">
                        {loading
                          ? 'Loading audit logs...'
                          : 'No audit logs found matching your filters.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-neutral-medium whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString(undefined, {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-neutral-high">{log.action}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm text-neutral-high">
                              {log.userEmail || 'System'}
                            </span>
                            {log.userId && (
                              <span className="text-xs text-neutral-low">ID: {log.userId}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.entityType ? (
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase tracking-wider font-semibold"
                              >
                                {log.entityType}
                              </Badge>
                              {log.entityId && (
                                <span className="text-xs text-neutral-low font-mono">
                                  #{log.entityId}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-neutral-low text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-neutral-medium">
                          {log.ip || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.metadata && Object.keys(log.metadata).length > 0 ? (
                            <details className="inline-block text-left">
                              <summary className="cursor-pointer text-xs text-standout-medium hover:underline list-none">
                                View JSON
                              </summary>
                              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm pointer-events-none">
                                <div className="bg-backdrop-low border border-line-low rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col pointer-events-auto">
                                  <div className="px-4 py-3 border-b border-line-low flex items-center justify-between bg-backdrop">
                                    <h3 className="font-semibold text-neutral-high">
                                      Log Metadata
                                    </h3>
                                    <button
                                      onClick={(e) => {
                                        const details = (e.target as HTMLElement).closest('details')
                                        if (details) details.open = false
                                      }}
                                      className="text-neutral-medium hover:text-neutral-high p-1"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <div className="p-4 overflow-auto bg-backdrop-low font-mono text-xs leading-relaxed">
                                    <pre className="text-neutral-high">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            </details>
                          ) : (
                            <span className="text-neutral-low text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="px-6 py-4 border-t border-line-low flex items-center justify-between bg-backdrop">
                <div className="text-sm text-neutral-medium">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}{' '}
                  results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 text-sm border border-line-low rounded bg-backdrop hover:bg-backdrop-medium text-neutral-high disabled:opacity-50 transition-colors"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="px-3 py-1.5 text-sm font-medium bg-standout-medium text-on-standout rounded">
                      {page}
                    </span>
                    <span className="text-sm text-neutral-low px-2">
                      of {Math.ceil(total / limit)}
                    </span>
                  </div>
                  <button
                    disabled={page >= Math.ceil(total / limit) || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 text-sm border border-line-low rounded bg-backdrop hover:bg-backdrop-medium text-neutral-high disabled:opacity-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
