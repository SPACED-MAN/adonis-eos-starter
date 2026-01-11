import { useEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { Badge } from '../../../components/ui/badge'
import { toast } from 'sonner'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheckCircle,
  faExclamationTriangle,
  faTimesCircle,
  faInfoCircle,
  faGaugeHigh,
  faMemory,
  faMicrochip,
  faBroom,
  faRefresh,
  faServer,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'

interface PerformancePosture {
  checks: Record<
    string,
    {
      label: string
      status: 'pass' | 'fail' | 'warn' | 'info'
      message: string
      recommendation: string | null
    }
  >
  systemStats: {
    memory: {
      free: number
      total: number
      usagePercent: number
    }
    containerMemory: {
      usage: number
      limit: number | null
      usagePercent: number | null
    } | null
    cpuLoad: number[]
    uptime: number
    nodeMemory: {
      rss: number
      heapTotal: number
      heapUsed: number
      external: number
    }
    storage: {
      isR2: boolean
      tempSize: number
    }
  }
  summary: {
    passed: number
    total: number
    overallStatus: 'pass' | 'warn' | 'fail'
  }
}

function getXsrf(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

export default function PerformanceIndex() {
  const [posture, setPosture] = useState<PerformancePosture | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearingCache, setClearingCache] = useState(false)
  const [purgingTemp, setPurgingTemp] = useState(false)

  useEffect(() => {
    loadPosture()
  }, [])

  async function loadPosture() {
    setLoading(true)
    try {
      const res = await fetch('/api/performance/posture', { credentials: 'same-origin' })
      const data = await res.json()
      setPosture(data)
    } catch (err) {
      console.error('Failed to load performance posture', err)
      toast.error('Failed to load performance data')
    } finally {
      setLoading(false)
    }
  }

  async function clearCache() {
    if (!confirm('Are you sure you want to clear the Redis cache? This might temporarily slow down the site.')) {
      return
    }

    setClearingCache(true)
    try {
      const res = await fetch('/api/performance/cache/clear', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
      })

      if (res.ok) {
        toast.success('Redis cache cleared successfully')
        loadPosture()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to clear cache')
      }
    } catch (err) {
      toast.error('Error clearing cache')
    } finally {
      setClearingCache(false)
    }
  }

  async function purgeTemp() {
    if (!confirm('Are you sure you want to purge the local temp cache? This will delete all local copies of media files. They will be re-downloaded from R2 if needed.')) {
      return
    }

    setPurgingTemp(true)
    try {
      const res = await fetch('/api/performance/temp/purge', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
      })

      if (res.ok) {
        toast.success('Local temp cache purged successfully')
        loadPosture()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to purge temp cache')
      }
    } catch (err) {
      toast.error('Error purging temp cache')
    } finally {
      setPurgingTemp(false)
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

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  function formatUptime(seconds: number) {
    const days = Math.floor(seconds / (3600 * 24))
    const hours = Math.floor((seconds % (3600 * 24)) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Performance" />
      <AdminHeader title="Performance Center" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-neutral-high flex items-center gap-3">
              <FontAwesomeIcon icon={faGaugeHigh} className="text-standout-high" />
              System Performance
            </h2>
            <p className="text-neutral-medium mt-1">
              Monitor and optimize your site's performance and resource usage.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadPosture}
              disabled={loading}
              className="px-4 py-2 bg-backdrop-high border border-line-low rounded-lg text-neutral-high hover:bg-backdrop-light transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faRefresh} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={clearCache}
              disabled={clearingCache}
              className="px-4 py-2 bg-standout-high text-white rounded-lg hover:bg-standout-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faBroom} />
              Clear Redis Cache
            </button>
          </div>
        </div>

        {loading && !posture ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-standout-high"></div>
          </div>
        ) : posture ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Posture Checks */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-backdrop-high border border-line-low rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-line-low bg-backdrop-light flex justify-between items-center">
                  <h3 className="font-semibold text-neutral-high">Performance Health Checks</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-medium">
                      {posture.summary.passed} / {posture.summary.total} Passed
                    </span>
                    <Badge className={
                      posture.summary.overallStatus === 'pass' ? 'bg-green-500' :
                        posture.summary.overallStatus === 'warn' ? 'bg-yellow-500' : 'bg-red-500'
                    }>
                      {posture.summary.overallStatus.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div className="divide-y divide-line-low">
                  {Object.entries(posture.checks).map(([key, check]) => (
                    <div key={key} className="px-6 py-4 flex items-start gap-4">
                      <div className="mt-1">{getStatusIcon(check.status)}</div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-neutral-high">{check.label}</h4>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {check.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-neutral-medium mt-1">{check.message}</p>
                        {check.recommendation && (
                          <div className="mt-2 text-xs text-standout-high bg-standout-high/5 p-2 rounded border border-standout-high/20">
                            <strong>Recommendation:</strong> {check.recommendation}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: System Stats */}
            <div className="space-y-6">
              {posture.systemStats.containerMemory ? (
                <div className="bg-backdrop-high border border-line-low rounded-xl overflow-hidden shadow-sm p-6">
                  <h3 className="font-semibold text-neutral-high mb-4 flex items-center gap-2">
                    <FontAwesomeIcon icon={faServer} className="text-standout-high" />
                    Container Memory (App)
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-neutral-medium">Usage</span>
                        <span className="font-medium text-neutral-high">
                          {posture.systemStats.containerMemory.usagePercent !== null
                            ? `${posture.systemStats.containerMemory.usagePercent}%`
                            : 'N/A'}
                        </span>
                      </div>
                      {posture.systemStats.containerMemory.usagePercent !== null && (
                        <div className="w-full bg-line-low rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${posture.systemStats.containerMemory.usagePercent > 90 ? 'bg-red-500' :
                              posture.systemStats.containerMemory.usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                            style={{ width: `${posture.systemStats.containerMemory.usagePercent}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-neutral-medium block">Used</span>
                        <span className="font-medium text-neutral-high">{formatBytes(posture.systemStats.containerMemory.usage)}</span>
                      </div>
                      <div>
                        <span className="text-neutral-medium block">Limit</span>
                        <span className="font-medium text-neutral-high">
                          {posture.systemStats.containerMemory.limit
                            ? formatBytes(posture.systemStats.containerMemory.limit)
                            : 'Unlimited'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-neutral-medium mt-4 italic">
                    This represents the memory limit of your container/virtual machine.
                  </p>
                </div>
              ) : null}

              <div className="bg-backdrop-high border border-line-low rounded-xl overflow-hidden shadow-sm p-6">
                <h3 className="font-semibold text-neutral-high mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faMemory} className="text-blue-500" />
                  Host Server Memory
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-neutral-medium">Overall Host Usage</span>
                      <span className="font-medium text-neutral-high">{posture.systemStats.memory.usagePercent}%</span>
                    </div>
                    <div className="w-full bg-line-low rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${posture.systemStats.memory.usagePercent > 90 ? 'bg-red-500' :
                          posture.systemStats.memory.usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                        style={{ width: `${posture.systemStats.memory.usagePercent}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-neutral-medium block">Free</span>
                      <span className="font-medium text-neutral-high">{formatBytes(posture.systemStats.memory.free)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-medium block">Total</span>
                      <span className="font-medium text-neutral-high">{formatBytes(posture.systemStats.memory.total)}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-neutral-medium mt-4 italic">
                  Note: In shared or containerized environments, this shows the total memory of the underlying physical host.
                </p>
              </div>

              <div className="bg-backdrop-high border border-line-low rounded-xl overflow-hidden shadow-sm p-6">
                <h3 className="font-semibold text-neutral-high mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faMicrochip} className="text-purple-500" />
                  Node.js Process
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-medium">RSS Memory</span>
                    <span className="font-medium text-neutral-high">{formatBytes(posture.systemStats.nodeMemory.rss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-medium">Heap Used</span>
                    <span className="font-medium text-neutral-high">{formatBytes(posture.systemStats.nodeMemory.heapUsed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-medium">CPU Load (1m)</span>
                    <span className="font-medium text-neutral-high">{posture.systemStats.cpuLoad[0].toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-medium">System Uptime</span>
                    <span className="font-medium text-neutral-high">{formatUptime(posture.systemStats.uptime)}</span>
                  </div>
                </div>
              </div>

              {posture.systemStats.storage.isR2 && (
                <div className="bg-backdrop-high border border-line-low rounded-xl overflow-hidden shadow-sm p-6">
                  <h3 className="font-semibold text-neutral-high mb-2 flex items-center gap-2">
                    <FontAwesomeIcon icon={faServer} className="text-orange-500" />
                    Local Storage Cache
                  </h3>
                  <p className="text-xs text-neutral-medium mb-4">
                    Since you are using R2, local files in the <code>tmp/</code> directory are only transient workspaces.
                  </p>
                  <div className="flex justify-between items-center bg-backdrop-light p-3 rounded-lg border border-line-low">
                    <div>
                      <span className="text-xs text-neutral-medium block uppercase tracking-wider font-semibold">Current Size</span>
                      <span className="text-lg font-bold text-neutral-high">{formatBytes(posture.systemStats.storage.tempSize)}</span>
                    </div>
                    <button
                      onClick={purgeTemp}
                      disabled={purgingTemp || posture.systemStats.storage.tempSize === 0}
                      className="px-3 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm font-medium"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                      Purge
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6">
                <h3 className="font-semibold text-blue-700 mb-2">Performance Tip</h3>
                <p className="text-sm text-blue-600">
                  Regularly clearing your Redis cache can help free up memory, but it will also cause
                  a temporary increase in database load as the cache is rebuilt.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

