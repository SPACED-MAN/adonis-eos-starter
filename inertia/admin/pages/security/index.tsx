import { useEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { useAdminPath } from '../../../utils/adminPath'
import { Badge } from '../../../components/ui/badge'
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
  const adminPath = useAdminPath()
  const [posture, setPosture] = useState<SecurityPosture | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('posture')

  useEffect(() => {
    loadPosture()
    loadSessions()
    if (activeTab === 'audit') {
      loadAuditLogs()
    }
  }, [activeTab])

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

  async function loadAuditLogs() {
    try {
      const res = await fetch('/api/security/audit-logs?limit=50', { credentials: 'same-origin' })
      const data = await res.json()
      setAuditLogs(data.data || [])
    } catch (err) {
      console.error('Failed to load audit logs', err)
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
              }`}
            >
              Active Sessions
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'audit'
                  ? 'border-standout-medium text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              }`}
            >
              Audit Logs
            </button>
          </nav>
        </div>

        {/* Posture Tab */}
        {activeTab === 'posture' && (
          <div className="space-y-6">
            {loading ? (
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
              <div className="text-center py-8 text-neutral-medium">Failed to load security posture</div>
            )}
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
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
                        {session.current && (
                          <Badge className="bg-blue-500">Current Session</Badge>
                        )}
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
        {activeTab === 'audit' && (
          <div className="bg-backdrop-low rounded-lg border border-line-low p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-neutral-high mb-2">Audit Logs</h2>
                <p className="text-sm text-neutral-medium">View system activity and security events</p>
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
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-neutral-medium">No audit logs found</div>
            ) : (
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 border border-line-low rounded-lg bg-backdrop text-sm"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-high">{log.action}</span>
                        {log.entityType && (
                          <Badge variant="outline">
                            {log.entityType}
                            {log.entityId && ` #${log.entityId}`}
                          </Badge>
                        )}
                      </div>
                      <span className="text-neutral-low text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-neutral-medium space-y-1">
                      {log.userEmail && <div>User: {log.userEmail}</div>}
                      {log.ip && <div>IP: {log.ip}</div>}
                      {log.userAgent && <div>User Agent: {log.userAgent}</div>}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-2">
                          <details>
                            <summary className="cursor-pointer text-neutral-high">Metadata</summary>
                            <pre className="mt-2 text-xs bg-backdrop-low p-2 rounded overflow-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
