import { Head } from '@inertiajs/react'
import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faDownload,
  faUpload,
  faDatabase,
  faCheckCircle,
  faExclamationTriangle,
  faSpinner,
  faTrash,
  faBroom,
  faRefresh,
  faSearch,
  faExchangeAlt,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog'

interface ExportStats {
  tables: Array<{ name: string; rowCount: number; contentType?: string }>
  totalRows: number
  estimatedSize: string
  contentTypes?: Record<string, { tables: string[]; rowCount: number }>
}

/**
 * Tiny pie chart for summary
 */
function PieSummary({ data }: { data: { imported: number; skipped: number; errors: number } }) {
  const total = Math.max(data.imported + data.skipped + data.errors, 1)
  const toDeg = (val: number) => (val / total) * 360

  const importedDeg = toDeg(data.imported)
  const skippedDeg = toDeg(data.skipped)
  const errorsDeg = toDeg(data.errors)

  const arcs = [
    { deg: importedDeg, color: '#22c55e', label: 'Imported' },
    { deg: skippedDeg, color: '#f59e0b', label: 'Skipped' },
    { deg: errorsDeg, color: '#ef4444', label: 'Errors' },
  ]

  let offset = 0

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="w-32 h-32 mx-auto sm:mx-0 relative">
        <svg viewBox="0 0 32 32" role="img" aria-label="Import summary pie chart">
          {arcs.map((arc, idx) => {
            const start = offset
            const end = offset + arc.deg
            const large = arc.deg > 180 ? 1 : 0
            const x1 = 16 + 16 * Math.cos((Math.PI * start) / 180)
            const y1 = 16 + 16 * Math.sin((Math.PI * start) / 180)
            const x2 = 16 + 16 * Math.cos((Math.PI * end) / 180)
            const y2 = 16 + 16 * Math.sin((Math.PI * end) / 180)
            const d = `M16,16 L${x1},${y1} A16,16 0 ${large} 1 ${x2},${y2} Z`
            offset = end
            return <path key={idx} d={d} fill={arc.color} />
          })}
        </svg>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
        {arcs.map((arc) => (
          <div
            key={arc.label}
            className="flex items-center gap-2 px-3 py-2 rounded border border-line-low bg-backdrop-medium"
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: arc.color }} />
            <div>
              <div className="text-xs text-neutral-medium">{arc.label}</div>
              <div className="text-sm font-semibold text-neutral-dark">
                {arc.label === 'Imported'
                  ? data.imported.toLocaleString()
                  : arc.label === 'Skipped'
                    ? data.skipped.toLocaleString()
                    : data.errors.toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
interface ImportResult {
  tablesImported: number
  rowsImported: number
  skippedTables: string[]
  errors: Array<{ table: string; error: string }>
}

type ContentType =
  | 'media'
  | 'posts'
  | 'modules'
  | 'forms'
  | 'menus'
  | 'categories'
  | 'module_groups'

type StatusRow = { table: string; status: 'skipped' | 'error'; message?: string }

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  media: 'Media Assets',
  posts: 'Posts & Translations',
  modules: 'Modules (Global & Instances)',
  forms: 'Forms & Submissions',
  menus: 'Menus',
  categories: 'Categories',
  module_groups: 'Module Groups',
}

export default function DatabaseIndex() {
  const [activeTab, setActiveTab] = useState<'export' | 'optimize' | 'search-replace'>('export')

  // Export/Import state
  const [exportStats, setExportStats] = useState<ExportStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [validating, setValidating] = useState(false)
  const [importStrategy, setImportStrategy] = useState<'replace' | 'merge' | 'skip' | 'overwrite'>(
    'merge'
  )
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [validationResult, setValidationResult] = useState<any>(null)

  // Optimize state
  const [optimizeStats, setOptimizeStats] = useState<{
    orphanedModuleInstances: number
    invalidPostReferences: number
    invalidModuleReferences: number
    staleRenderCache: number
    totalIssues: number
  } | null>(null)
  const [loadingOptimizeStats, setLoadingOptimizeStats] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeResults, setOptimizeResults] = useState<{
    orphanedModulesDeleted: number
    invalidPostRefsDeleted: number
    invalidModuleRefsDeleted: number
    renderCacheCleared: number
  } | null>(null)
  const [confirmOptimizeOpen, setConfirmOptimizeOpen] = useState(false)
  const [optimizeOptions, setOptimizeOptions] = useState({
    cleanOrphanedModules: true,
    cleanInvalidRefs: true,
    clearRenderCache: false,
  })

  // Export options
  const [selectedContentTypes, setSelectedContentTypes] = useState<ContentType[]>([
    'media',
    'posts',
    'modules',
    'forms',
    'menus',
    'categories',
    'module_groups',
  ])
  const [exportAllTables, setExportAllTables] = useState(false)
  const [preserveIds, setPreserveIds] = useState(true)

  // Import options
  const [importPreserveIds, setImportPreserveIds] = useState(true)
  const [confirmImportOpen, setConfirmImportOpen] = useState(false)
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const [resultFilter, setResultFilter] = useState('')

  // Find and Replace state
  const [frSearch, setFrSearch] = useState('')
  const [frReplace, setFrReplace] = useState('')
  const [frSelectedTables, setFrReplaceSelectedTables] = useState<string[]>([])
  const [frDryRun, setFrDryRun] = useState(true)
  const [frLoadingTables, setFrLoadingTables] = useState(false)
  const [frRunning, setFrRunning] = useState(false)
  const [frTables, setFrTables] = useState<Array<{ name: string; columns: string[] }>>([])
  const [frResult, setFrResult] = useState<{
    summary: Array<{ table: string; column: string; matches: number; replacements: number }>
    totalMatches: number
    totalReplacements: number
  } | null>(null)
  const [confirmFrOpen, setConfirmFrOpen] = useState(false)

  // Build rows for the status table (skipped + errors), with filter
  const getStatusRows = (result: ImportResult, filter: string): StatusRow[] => {
    const rows: StatusRow[] = []
    result.skippedTables.forEach((table) => rows.push({ table, status: 'skipped' }))
    result.errors.forEach((err) =>
      rows.push({ table: err.table, status: 'error', message: err.error })
    )
    const f = filter.trim().toLowerCase()
    return f ? rows.filter((r) => r.table.toLowerCase().includes(f)) : rows
  }

  // Pie data
  const pieData = useMemo(() => {
    if (!importResult) return { imported: 0, skipped: 0, errors: 0 }
    return {
      imported: importResult.rowsImported,
      skipped: importResult.skippedTables.length,
      errors: importResult.errors.length,
    }
  }, [importResult])

  // Load export stats on mount
  useEffect(() => {
    if (activeTab === 'export') {
      loadExportStats()
    } else if (activeTab === 'optimize') {
      loadOptimizeStats()
    } else if (activeTab === 'search-replace') {
      loadFrTables()
    }
  }, [activeTab])

  // Load Find and Replace tables
  const loadFrTables = async () => {
    setFrLoadingTables(true)
    try {
      const res = await fetch('/api/database/find-replace/tables', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const json = await res.json()
        setFrTables(json.data)
        // Select all tables by default
        setFrReplaceSelectedTables(json.data.map((t: any) => t.name))
      } else {
        toast.error('Failed to load database tables')
      }
    } catch (error) {
      toast.error('Failed to load database tables')
    } finally {
      setFrLoadingTables(false)
    }
  }

  const handleFrExecute = async () => {
    if (!frSearch) {
      toast.error('Please enter a search string')
      return
    }
    if (frSelectedTables.length === 0) {
      toast.error('Please select at least one table')
      return
    }

    setFrRunning(true)
    setFrResult(null)
    setConfirmFrOpen(false)

    try {
      const csrf = (() => {
        if (typeof document === 'undefined') return undefined
        const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
        return m ? decodeURIComponent(m[1]) : undefined
      })()

      const res = await fetch('/api/database/find-replace', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {}),
        },
        body: JSON.stringify({
          search: frSearch,
          replace: frReplace,
          tables: frSelectedTables,
          dryRun: frDryRun,
        }),
      })

      const json = await res.json()

      if (res.ok) {
        setFrResult(json.result)
        toast.success(json.message || 'Find and replace completed')
      } else {
        toast.error(json.error || 'Find and replace failed')
      }
    } catch (error) {
      toast.error('Find and replace failed')
    } finally {
      setFrRunning(false)
    }
  }

  // Load optimize stats
  const loadOptimizeStats = async () => {
    setLoadingOptimizeStats(true)
    try {
      const res = await fetch('/api/database/optimize/stats', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        setOptimizeStats(data)
      } else {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error || 'Failed to load optimization statistics')
      }
    } catch (error) {
      toast.error('Failed to load optimization statistics')
    } finally {
      setLoadingOptimizeStats(false)
    }
  }

  const handleOptimize = async () => {
    setOptimizing(true)
    setOptimizeResults(null)
    setConfirmOptimizeOpen(false)

    try {
      const csrf = (() => {
        if (typeof document === 'undefined') return undefined
        const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
        return m ? decodeURIComponent(m[1]) : undefined
      })()

      const res = await fetch('/api/database/optimize', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {}),
        },
        body: JSON.stringify(optimizeOptions),
      })

      const json = await res.json()

      if (res.ok) {
        setOptimizeResults(json.results)
        toast.success(json.message || 'Database optimization completed')
        loadOptimizeStats()
      } else {
        toast.error(json.error || 'Optimization failed')
      }
    } catch (error) {
      toast.error('Optimization failed')
    } finally {
      setOptimizing(false)
    }
  }

  const canOptimize =
    optimizeOptions.cleanOrphanedModules ||
    optimizeOptions.cleanInvalidRefs ||
    optimizeOptions.clearRenderCache

  // Load export stats
  const loadExportStats = async () => {
    setLoadingStats(true)
    try {
      const res = await fetch('/api/database/export/stats', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        setExportStats(data)
      } else {
        toast.error('Failed to load export statistics')
      }
    } catch (error) {
      toast.error('Failed to load export statistics')
    } finally {
      setLoadingStats(false)
    }
  }

  // Toggle content type selection
  const toggleContentType = (type: ContentType) => {
    setSelectedContentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  // Select/deselect all content types
  const toggleAll = () => {
    if (selectedContentTypes.length === 7) {
      setSelectedContentTypes([])
    } else {
      setSelectedContentTypes([
        'media',
        'posts',
        'modules',
        'forms',
        'menus',
        'categories',
        'module_groups',
      ])
    }
  }

  // Export database
  const handleExport = async () => {
    if (!exportAllTables && selectedContentTypes.length === 0) {
      toast.error('Please select at least one content type to export')
      return
    }

    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (!exportAllTables) {
        params.set('contentTypes', selectedContentTypes.join(','))
      }
      params.set('preserveIds', preserveIds.toString())

      const res = await fetch(`/api/database/export?${params.toString()}`, {
        credentials: 'same-origin',
      })

      if (res.ok) {
        // Get filename from Content-Disposition header
        const contentDisposition = res.headers.get('Content-Disposition')
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
        const filename = filenameMatch ? filenameMatch[1] : 'database-export.json'

        // Download file
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast.success('Database exported successfully')
      } else {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error || 'Export failed')
      }
    } catch (error) {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  // Validate import file
  const handleValidateFile = async (file: File) => {
    setValidating(true)
    setValidationResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const csrf = (() => {
        if (typeof document === 'undefined') return undefined
        const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
        return m ? decodeURIComponent(m[1]) : undefined
      })()

      const res = await fetch('/api/database/validate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrf ? { 'X-XSRF-TOKEN': csrf } : {},
        body: formData,
      })

      const json = await res.json()

      if (res.ok) {
        setValidationResult(json)
        if (json.valid) {
          toast.success('File is valid and ready to import')
        } else {
          toast.error(json.error || 'File validation failed')
        }
      } else {
        toast.error(json.error || 'Validation failed')
      }
    } catch (error) {
      toast.error('Validation failed')
    } finally {
      setValidating(false)
    }
  }

  // Import database (initiate confirm)
  const handleImport = (file: File) => {
    setPendingImportFile(file)
    setConfirmImportOpen(true)
  }

  // Execute confirmed import
  const executeImport = async () => {
    if (!pendingImportFile) return

    setImporting(true)
    setImportResult(null)
    setConfirmImportOpen(false)

    try {
      const formData = new FormData()
      formData.append('file', pendingImportFile)
      formData.append('strategy', importStrategy)
      formData.append('preserveIds', importPreserveIds.toString())

      const csrf = (() => {
        if (typeof document === 'undefined') return undefined
        const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
        return m ? decodeURIComponent(m[1]) : undefined
      })()

      const res = await fetch('/api/database/import', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrf ? { 'X-XSRF-TOKEN': csrf } : {},
        body: formData,
      })

      const json = await res.json()

      if (res.ok) {
        setImportResult(json.result)
        toast.success('Database imported successfully')
        // Reload stats after import
        loadExportStats()
      } else {
        setImportResult(json.result)
        toast.error(json.error || 'Import failed')
      }
    } catch (error) {
      toast.error('Import failed')
    } finally {
      setImporting(false)
      setPendingImportFile(null)
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Database" />
      <AdminHeader title="Database" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="border-b border-line-low mb-6">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('export')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'export'
                  ? 'border-standout-medium text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              }`}
            >
              Export/Import
            </button>
            <button
              onClick={() => setActiveTab('optimize')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'optimize'
                  ? 'border-standout-medium text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              }`}
            >
              Optimize
            </button>
            <button
              onClick={() => setActiveTab('search-replace')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'search-replace'
                  ? 'border-standout-medium text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              }`}
            >
              Find and Replace
            </button>
          </nav>
        </div>

        <div className="bg-backdrop-low rounded-lg shadow border border-line-low p-6 space-y-6">
          {activeTab === 'export' && (
            <>
              <div className="mb-6">
                <p className="text-neutral-medium">
                  Export your database for backup or migration, or import from a previous export.
                  Select which content types to include and configure ID preservation options.
                </p>
              </div>

              {/* Export Section */}
              <div className="bg-backdrop-medium border border-line-low rounded-lg p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <FontAwesomeIcon icon={faDownload} className="text-standout-medium" />
                  <h2 className="text-xl font-semibold text-neutral-dark">Export Database</h2>
                </div>

                <p className="text-neutral-medium mb-4">
                  Download a backup of your database as a JSON file. Select which content types to
                  include.
                </p>

                {/* Content Type Selection */}
                <div className="mb-4 p-4 bg-backdrop-high rounded border border-line-medium">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-neutral-dark">Content Types to Export</h3>
                    <button
                      type="button"
                      onClick={toggleAll}
                      disabled={exportAllTables}
                      className="text-xs text-standout-high hover:underline"
                    >
                      {selectedContentTypes.length === 7 ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <label className="flex items-start gap-2 mb-3 p-3 rounded border border-line-medium bg-backdrop">
                    <input
                      type="checkbox"
                      checked={exportAllTables}
                      onChange={(e) => setExportAllTables(e.target.checked)}
                      className="rounded mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-neutral-dark">Export all tables</div>
                      <p className="text-xs text-neutral-medium">
                        Exports every table in the database (excluding system schema tables). Use this for
                        full backups. Content type selection is ignored while enabled.
                      </p>
                    </div>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((type) => {
                      const stats = exportStats?.contentTypes?.[type]
                      const isSelected = selectedContentTypes.includes(type)
                      return (
                        <label
                          key={type}
                          className={`flex items-center gap-2 p-3 rounded border cursor-pointer transition ${
                            isSelected
                              ? 'border-standout-medium bg-standout-medium/10'
                              : 'border-line-medium hover:border-line-high'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleContentType(type)}
                            disabled={exportAllTables}
                            className="rounded"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-neutral-dark">
                              {CONTENT_TYPE_LABELS[type]}
                            </div>
                            {stats && (
                              <div className="text-xs text-neutral-medium">
                                {stats.rowCount.toLocaleString()} rows
                              </div>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Export Options */}
                <div className="mb-4 p-4 bg-backdrop-high rounded border border-line-medium">
                  <h3 className="font-semibold text-neutral-dark mb-3">Export Options</h3>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={preserveIds}
                      onChange={(e) => setPreserveIds(e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <span className="text-sm font-medium text-neutral-dark">
                        Preserve Original IDs
                      </span>
                      <p className="text-xs text-neutral-medium">
                        Keep the original database IDs. Recommended for migrations and backups.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={loadExportStats}
                    disabled={loadingStats}
                    className="px-4 py-2 bg-backdrop-high text-neutral-dark rounded-lg hover:bg-backdrop-medium transition disabled:opacity-50"
                  >
                    {loadingStats ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faDatabase} className="mr-2" />
                        Refresh Stats
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleExport}
                    disabled={exporting || (!exportAllTables && selectedContentTypes.length === 0)}
                    className="px-4 py-2 bg-standout-medium text-on-standout rounded-lg hover:opacity-90 transition disabled:opacity-50 font-medium"
                  >
                    {exporting ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faDownload} className="mr-2" />
                        Export Database
                      </>
                    )}
                  </button>
                </div>

                {exportStats && (
                  <div className="mt-4 p-4 bg-backdrop-high rounded border border-line-medium">
                    <h3 className="font-semibold text-neutral-dark mb-2">Export Statistics</h3>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <div className="text-sm text-neutral-medium">Tables</div>
                        <div className="text-lg font-semibold">{exportStats.tables.length}</div>
                      </div>
                      <div>
                        <div className="text-sm text-neutral-medium">Total Rows</div>
                        <div className="text-lg font-semibold">
                          {exportStats.totalRows.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-neutral-medium">Estimated Size</div>
                        <div className="text-lg font-semibold">{exportStats.estimatedSize}</div>
                      </div>
                    </div>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-neutral-medium hover:text-neutral-dark">
                        View table breakdown
                      </summary>
                      <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                        {exportStats.tables.map((table) => (
                          <div key={table.name} className="flex justify-between py-1">
                            <span className="font-mono text-xs">
                              {table.name}
                              {table.contentType && (
                                <span className="ml-2 text-neutral-low">({table.contentType})</span>
                              )}
                            </span>
                            <span className="text-neutral-medium">
                              {table.rowCount.toLocaleString()} rows
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>

              {/* Import Section */}
              <div className="bg-backdrop-medium border border-line-low rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FontAwesomeIcon icon={faUpload} className="text-standout-medium" />
                  <h2 className="text-xl font-semibold text-neutral-dark">Import Database</h2>
                </div>

                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      className="text-yellow-600 mt-1"
                    />
                    <div className="text-sm">
                      <p className="font-semibold text-yellow-800 mb-1">
                        Warning: This is a destructive operation
                      </p>
                      <p className="text-yellow-700">
                        Importing a database will modify your existing data. Always create a backup
                        before importing.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-dark mb-2">
                    Import Strategy
                  </label>
                  <select
                    value={importStrategy}
                    onChange={(e) => setImportStrategy(e.target.value as any)}
                    className="w-full px-3 py-2 border border-line-medium rounded-lg bg-backdrop-low"
                  >
                    <option value="merge">Merge - Add new records, skip conflicts (safest)</option>
                    <option value="overwrite">
                      Overwrite - Update existing records with matching IDs, insert new
                    </option>
                    <option value="skip">Skip - Only import to empty tables</option>
                    <option value="replace">
                      Replace - Clear and replace all data (destructive)
                    </option>
                  </select>
                  <p className="text-xs text-neutral-medium mt-1">
                    {importStrategy === 'merge' &&
                      'Recommended: Adds new records without removing existing data'}
                    {importStrategy === 'overwrite' &&
                      'Updates existing records if IDs match, inserts new ones otherwise'}
                    {importStrategy === 'skip' &&
                      'Only imports data into tables that are currently empty'}
                    {importStrategy === 'replace' &&
                      'WARNING: Deletes all existing data before importing'}
                  </p>
                </div>

                <div className="mb-4 p-4 bg-backdrop-high rounded border border-line-medium">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={importPreserveIds}
                      onChange={(e) => setImportPreserveIds(e.target.checked)}
                      className="rounded"
                    />
                    <div>
                      <span className="text-sm font-medium text-neutral-dark">
                        Preserve IDs from Export
                      </span>
                      <p className="text-xs text-neutral-medium">
                        Use the original IDs from the export file. Disable to generate new IDs on
                        import.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-dark mb-2">
                    Select Import File
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleValidateFile(file)
                      }
                    }}
                    className="w-full px-3 py-2 border border-line-medium rounded-lg bg-backdrop-low file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-standout-medium file:text-on-standout hover:file:opacity-90"
                  />
                </div>

                {validating && (
                  <div className="p-4 bg-backdrop-high rounded border border-line-low mb-4">
                    <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                    Validating file...
                  </div>
                )}

                {validationResult && (
                  <div
                    className={`p-4 rounded border mb-4 ${validationResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                  >
                    {validationResult.valid ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                          <span className="font-semibold text-green-800">File is valid</span>
                        </div>
                        <div className="text-sm text-green-700 space-y-1">
                          <p>Version: {validationResult.metadata?.version}</p>
                          <p>Tables: {validationResult.stats?.tables}</p>
                          <p>Total rows: {validationResult.stats?.totalRows.toLocaleString()}</p>
                          {validationResult.metadata?.contentTypes && (
                            <p>
                              Content types: {validationResult.metadata.contentTypes.join(', ')}
                            </p>
                          )}
                          {validationResult.metadata?.preserveIds !== undefined && (
                            <p>
                              Preserves IDs: {validationResult.metadata.preserveIds ? 'Yes' : 'No'}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            const fileInput = document.querySelector(
                              'input[type="file"]'
                            ) as HTMLInputElement
                            const file = fileInput?.files?.[0]
                            if (file) handleImport(file)
                          }}
                          disabled={importing}
                          className="mt-3 px-4 py-2 bg-standout-medium text-on-standout rounded-lg hover:opacity-90 transition disabled:opacity-50 font-medium"
                        >
                          {importing ? (
                            <>
                              <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faUpload} className="mr-2" />
                              Import Database
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600" />
                          <span className="font-semibold text-red-800">Invalid file</span>
                        </div>
                        <p className="text-sm text-red-700">{validationResult.error}</p>
                      </>
                    )}
                  </div>
                )}

                {importResult && (
                  <div className="p-4 bg-backdrop-high rounded border border-line-medium space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-neutral-dark">Import Results</h3>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${
                          importResult.errors.length === 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {importResult.errors.length === 0 ? 'Success' : 'Completed with warnings'}
                      </span>
                    </div>

                    {/* Pie chart summary */}
                    <PieSummary data={pieData} />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-3 rounded bg-backdrop-medium border border-line-low">
                        <div className="text-xs text-neutral-medium">Tables Imported</div>
                        <div className="text-lg font-semibold text-neutral-dark">
                          {importResult.tablesImported}
                        </div>
                      </div>
                      <div className="p-3 rounded bg-backdrop-medium border border-line-low">
                        <div className="text-xs text-neutral-medium">Rows Imported</div>
                        <div className="text-lg font-semibold text-neutral-dark">
                          {importResult.rowsImported.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-3 rounded bg-backdrop-medium border border-line-low">
                        <div className="text-xs text-neutral-medium">Tables Skipped</div>
                        <div className="text-lg font-semibold text-neutral-dark">
                          {importResult.skippedTables.length}
                        </div>
                      </div>
                      <div className="p-3 rounded bg-backdrop-medium border border-line-low">
                        <div className="text-xs text-neutral-medium">Errors</div>
                        <div className="text-lg font-semibold text-neutral-dark">
                          {importResult.errors.length}
                        </div>
                      </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-neutral-dark">Details</div>
                        <p className="text-xs text-neutral-medium">
                          Filter by table name for skipped or errors
                        </p>
                      </div>
                      <input
                        type="text"
                        value={resultFilter}
                        onChange={(e) => setResultFilter(e.target.value)}
                        placeholder="Filter tables..."
                        className="w-full sm:w-64 px-3 py-2 border border-line-medium rounded bg-backdrop-low text-sm"
                      />
                    </div>

                    {/* Skipped and Errors table */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Table</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                          {getStatusRows(importResult, resultFilter).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs text-neutral-dark">
                                {row.table}
                            </TableCell>
                            <TableCell>
                                <span
                                  className={`px-2 py-1 text-xs font-semibold rounded ${
                                    row.status === 'skipped'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {row.status === 'skipped' ? 'Skipped' : 'Error'}
                                </span>
                            </TableCell>
                            <TableCell className="text-neutral-medium">
                                {row.message ? row.message : '—'}
                            </TableCell>
                          </TableRow>
                          ))}
                          {getStatusRows(importResult, resultFilter).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-neutral-medium text-center">
                                No rows match your filter.
                            </TableCell>
                          </TableRow>
                          )}
                      </TableBody>
                    </Table>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: 'Posts', href: '/admin/posts' },
                        { label: 'Media', href: '/admin/media' },
                        { label: 'Modules', href: '/admin/modules' },
                        { label: 'Menus', href: '/admin/menus' },
                      ].map((item) => (
                        <a
                          key={item.label}
                          href={item.href}
                          className="block p-3 rounded border border-line-low bg-backdrop-medium hover:border-standout-medium hover:bg-standout-medium/5 transition"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <div className="text-sm font-semibold text-neutral-dark">
                            {item.label}
                          </div>
                          <div className="text-xs text-neutral-medium">
                            Open to spot-check imported records
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'search-replace' && (
            <>
              <div className="mb-6">
                <p className="text-neutral-medium">
                  Search the entire database for a string and replace it with another. This is
                  extremely useful for updating domain names, fixing broken links, or mass-renaming
                  content.
                </p>
              </div>

              {/* Search and Replace Section */}
              <div className="bg-backdrop-medium border border-line-low rounded-lg p-6 mb-6">
                <div className="flex items-center gap-2 mb-6">
                  <FontAwesomeIcon icon={faExchangeAlt} className="text-standout-medium" />
                  <h2 className="text-xl font-semibold text-neutral-dark">Find and Replace</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-dark mb-2">
                      Find String
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-medium">
                        <FontAwesomeIcon icon={faSearch} />
                      </div>
                      <input
                        type="text"
                        value={frSearch}
                        onChange={(e) => setFrSearch(e.target.value)}
                        placeholder="Search for..."
                        className="w-full pl-10 pr-3 py-2 border border-line-medium rounded-lg bg-backdrop-low focus:ring-standout-medium focus:border-standout-medium"
                      />
                    </div>
                    <p className="text-xs text-neutral-medium mt-1">
                      The exact string you want to find in the database.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-dark mb-2">
                      Replace with
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-medium">
                        <FontAwesomeIcon icon={faExchangeAlt} />
                      </div>
                      <input
                        type="text"
                        value={frReplace}
                        onChange={(e) => setFrReplace(e.target.value)}
                        placeholder="Replace with..."
                        className="w-full pl-10 pr-3 py-2 border border-line-medium rounded-lg bg-backdrop-low focus:ring-standout-medium focus:border-standout-medium"
                      />
                    </div>
                    <p className="text-xs text-neutral-medium mt-1">
                      The string that will replace the searched string.
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-neutral-dark">
                      Select Tables
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setFrReplaceSelectedTables(frTables.map((t) => t.name))}
                        className="text-xs text-standout-high hover:underline"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setFrReplaceSelectedTables([])}
                        className="text-xs text-neutral-medium hover:underline"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className="bg-backdrop-high border border-line-medium rounded-lg p-4 max-h-64 overflow-y-auto">
                    {frLoadingTables ? (
                      <div className="text-center py-4">
                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                        Loading tables...
                      </div>
                    ) : frTables.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {frTables.map((table) => {
                          const isSelected = frSelectedTables.includes(table.name)
                          return (
                            <label
                              key={table.name}
                              className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition ${
                                isSelected
                                  ? 'border-standout-medium bg-standout-medium/10'
                                  : 'border-line-low hover:border-line-medium bg-backdrop-low'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setFrReplaceSelectedTables((prev) =>
                                    prev.includes(table.name)
                                      ? prev.filter((t) => t !== table.name)
                                      : [...prev, table.name]
                                  )
                                }}
                                className="rounded"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-mono truncate text-neutral-dark">
                                  {table.name}
                                </div>
                                <div className="text-[10px] text-neutral-medium">
                                  {table.columns.length} columns
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-neutral-medium">No tables found</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
                  <div className="flex items-start gap-3">
                    <FontAwesomeIcon icon={faInfoCircle} className="text-yellow-600 mt-1" />
                    <div>
                      <div className="text-sm font-semibold text-yellow-800">Dry Run Mode</div>
                      <p className="text-xs text-yellow-700">
                        When enabled, the tool will only count matches without making any actual
                        changes to your database. Recommended to keep this enabled first.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={frDryRun}
                      onChange={(e) => setFrDryRun(e.target.checked)}
                      className="rounded text-standout-medium focus:ring-standout-medium h-5 w-5"
                    />
                    <span className="text-sm font-bold text-yellow-800">Enabled</span>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (frDryRun) {
                        handleFrExecute()
                      } else {
                        setConfirmFrOpen(true)
                      }
                    }}
                    disabled={frRunning || !frSearch || frSelectedTables.length === 0}
                    className={`px-6 py-2 rounded-lg transition disabled:opacity-50 font-bold ${
                      frDryRun
                        ? 'bg-standout-medium text-on-standout hover:opacity-90'
                        : 'bg-rose-600 text-white hover:bg-rose-700'
                    }`}
                  >
                    {frRunning ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={frDryRun ? faSearch : faExchangeAlt} className="mr-2" />
                        {frDryRun ? 'Dry Run' : 'Execute Replace'}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Find and Replace Results */}
              {frResult && (
                <div className="bg-backdrop-medium border border-line-low rounded-lg p-6 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={frDryRun ? faInfoCircle : faCheckCircle}
                        className={frDryRun ? 'text-blue-500' : 'text-green-500'}
                      />
                      <h2 className="text-xl font-semibold text-neutral-dark">
                        {frDryRun ? 'Dry Run Results' : 'Replacement Summary'}
                      </h2>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <div className="text-xs text-neutral-medium uppercase tracking-wider">
                          Matches Found
                        </div>
                        <div className="text-2xl font-bold text-neutral-dark">
                          {frResult.totalMatches.toLocaleString()}
                        </div>
                      </div>
                      {!frDryRun && (
                        <div className="text-center border-l border-line-medium pl-4">
                          <div className="text-xs text-neutral-medium uppercase tracking-wider">
                            Actual Replaced
                          </div>
                          <div className="text-2xl font-bold text-green-600">
                            {frResult.totalReplacements.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {frResult.summary.length > 0 ? (
                    <div className="overflow-x-auto rounded border border-line-low">
                      <Table>
                        <TableHeader className="bg-backdrop-high">
                          <TableRow>
                            <TableHead>Table</TableHead>
                            <TableHead>Column</TableHead>
                            <TableHead className="text-right">Matches</TableHead>
                            {!frDryRun && <TableHead className="text-right">Replaced</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {frResult.summary.map((row, i) => (
                            <TableRow key={i} className="hover:bg-backdrop-low transition-colors">
                              <TableCell className="font-mono text-xs font-semibold text-neutral-dark">
                                {row.table}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-neutral-medium">
                                {row.column}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {row.matches.toLocaleString()}
                              </TableCell>
                              {!frDryRun && (
                                <TableCell className="text-right font-bold text-green-600">
                                  {row.replacements.toLocaleString()}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="p-12 text-center bg-backdrop-high rounded border border-dashed border-line-medium">
                      <FontAwesomeIcon
                        icon={faSearch}
                        className="text-4xl text-neutral-low mb-4 opacity-20"
                      />
                      <p className="text-neutral-medium">No matches found for "{frSearch}"</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'optimize' && (
            <>
              <div className="mb-6">
                <p className="text-neutral-medium">
                  Clean up orphaned data and optimize your database. This tool identifies and
                  removes unused module instances, invalid references, and optionally clears stale
                  render cache.
                </p>
              </div>

              {/* Statistics Section */}
              <div className="bg-backdrop-medium border border-line-low rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faDatabase} className="text-standout-medium" />
                    <h2 className="text-xl font-semibold text-neutral-dark">Database Statistics</h2>
                  </div>
                  <button
                    onClick={loadOptimizeStats}
                    disabled={loadingOptimizeStats}
                    className="px-3 py-2 bg-backdrop-high text-neutral-dark rounded-lg hover:bg-backdrop-medium transition disabled:opacity-50 text-sm"
                  >
                    {loadingOptimizeStats ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faRefresh} className="mr-2" />
                        Refresh
                      </>
                    )}
                  </button>
                </div>

                {loadingOptimizeStats ? (
                  <div className="text-center py-8">
                    <FontAwesomeIcon
                      icon={faSpinner}
                      spin
                      className="text-2xl text-neutral-medium"
                    />
                    <p className="mt-2 text-neutral-medium">Loading statistics...</p>
                  </div>
                ) : optimizeStats ? (
                  <>
                    {optimizeStats.totalIssues > 0 ? (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                        <div className="flex items-start gap-2">
                          <FontAwesomeIcon
                            icon={faExclamationTriangle}
                            className="text-yellow-600 mt-1"
                          />
                          <div>
                            <p className="font-semibold text-yellow-800 mb-1">Issues Found</p>
                            <p className="text-sm text-yellow-700">
                              Your database has {optimizeStats.totalIssues} issue
                              {optimizeStats.totalIssues !== 1 ? 's' : ''} that can be cleaned up.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                        <div className="flex items-start gap-2">
                          <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 mt-1" />
                          <div>
                            <p className="font-semibold text-green-800 mb-1">Database is Clean</p>
                            <p className="text-sm text-green-700">
                              No orphaned data or invalid references found.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded bg-backdrop-high border border-line-medium">
                        <div className="text-sm text-neutral-medium mb-1">Orphaned Modules</div>
                        <div className="text-2xl font-semibold text-neutral-dark">
                          {optimizeStats.orphanedModuleInstances.toLocaleString()}
                        </div>
                        <div className="text-xs text-neutral-medium mt-1">
                          Module instances not referenced by any post
                        </div>
                      </div>
                      <div className="p-4 rounded bg-backdrop-high border border-line-medium">
                        <div className="text-sm text-neutral-medium mb-1">Invalid Post Refs</div>
                        <div className="text-2xl font-semibold text-neutral-dark">
                          {optimizeStats.invalidPostReferences.toLocaleString()}
                        </div>
                        <div className="text-xs text-neutral-medium mt-1">
                          Modules referencing non-existent posts
                        </div>
                      </div>
                      <div className="p-4 rounded bg-backdrop-high border border-line-medium">
                        <div className="text-sm text-neutral-medium mb-1">Invalid Module Refs</div>
                        <div className="text-2xl font-semibold text-neutral-dark">
                          {optimizeStats.invalidModuleReferences.toLocaleString()}
                        </div>
                        <div className="text-xs text-neutral-medium mt-1">
                          Post modules referencing non-existent instances
                        </div>
                      </div>
                      <div className="p-4 rounded bg-backdrop-high border border-line-medium">
                        <div className="text-sm text-neutral-medium mb-1">Stale Cache Entries</div>
                        <div className="text-2xl font-semibold text-neutral-dark">
                          {optimizeStats.staleRenderCache.toLocaleString()}
                        </div>
                        <div className="text-xs text-neutral-medium mt-1">
                          Cached render HTML (can be regenerated)
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-neutral-medium">
                    Failed to load statistics. Click Refresh to try again.
                  </div>
                )}
              </div>

              {/* Optimization Options */}
              <div className="bg-backdrop-medium border border-line-low rounded-lg p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <FontAwesomeIcon icon={faBroom} className="text-standout-medium" />
                  <h2 className="text-xl font-semibold text-neutral-dark">Optimization Options</h2>
                </div>

                <div className="space-y-4">
                  <label className="flex items-start gap-3 p-4 rounded border border-line-medium hover:border-line-high transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optimizeOptions.cleanOrphanedModules}
                      onChange={(e) =>
                        setOptimizeOptions({
                          ...optimizeOptions,
                          cleanOrphanedModules: e.target.checked,
                        })
                      }
                      className="mt-1 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-neutral-dark mb-1">
                        Clean Orphaned Module Instances
                      </div>
                      <p className="text-sm text-neutral-medium">
                        Remove module instances with scope='post' that are not referenced by any
                        post_modules entries. These are safe to delete as they're not being used.
                      </p>
                      {optimizeStats && optimizeStats.orphanedModuleInstances > 0 && (
                        <p className="text-xs text-standout-medium mt-1">
                          {optimizeStats.orphanedModuleInstances} orphaned module
                          {optimizeStats.orphanedModuleInstances !== 1 ? 's' : ''} will be deleted
                        </p>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 rounded border border-line-medium hover:border-line-high transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optimizeOptions.cleanInvalidRefs}
                      onChange={(e) =>
                        setOptimizeOptions({
                          ...optimizeOptions,
                          cleanInvalidRefs: e.target.checked,
                        })
                      }
                      className="mt-1 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-neutral-dark mb-1">
                        Clean Invalid References
                      </div>
                      <p className="text-sm text-neutral-medium">
                        Remove module instances referencing non-existent posts, and post_modules
                        entries referencing non-existent module instances. These can cause errors
                        and should be cleaned up.
                      </p>
                      {optimizeStats &&
                        (optimizeStats.invalidPostReferences > 0 ||
                          optimizeStats.invalidModuleReferences > 0) && (
                          <p className="text-xs text-standout-medium mt-1">
                            {optimizeStats.invalidPostReferences +
                              optimizeStats.invalidModuleReferences}{' '}
                            invalid reference
                            {optimizeStats.invalidPostReferences +
                              optimizeStats.invalidModuleReferences !==
                            1
                              ? 's'
                              : ''}{' '}
                            will be deleted
                          </p>
                        )}
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 rounded border border-line-medium hover:border-line-high transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optimizeOptions.clearRenderCache}
                      onChange={(e) =>
                        setOptimizeOptions({
                          ...optimizeOptions,
                          clearRenderCache: e.target.checked,
                        })
                      }
                      className="mt-1 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-neutral-dark mb-1">Clear Render Cache</div>
                      <p className="text-sm text-neutral-medium">
                        Clear all cached render HTML from module instances. This can free up space,
                        but cached HTML will be regenerated on next render (may slightly slow down
                        initial page loads temporarily).
                      </p>
                      {optimizeStats && optimizeStats.staleRenderCache > 0 && (
                        <p className="text-xs text-standout-medium mt-1">
                          Render cache for {optimizeStats.staleRenderCache} module
                          {optimizeStats.staleRenderCache !== 1 ? 's' : ''} will be cleared
                        </p>
                      )}
                    </div>
                  </label>
                </div>

                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      className="text-yellow-600 mt-1"
                    />
                    <div className="text-sm">
                      <p className="font-semibold text-yellow-800 mb-1">Warning</p>
                      <p className="text-yellow-700">
                        Database optimization is a destructive operation. Make sure you have a
                        backup before proceeding. The changes cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setConfirmOptimizeOpen(true)}
                    disabled={
                      !canOptimize ||
                      optimizing ||
                      !optimizeStats ||
                      optimizeStats.totalIssues === 0
                    }
                    className="px-4 py-2 bg-standout-medium text-on-standout rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {optimizing ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                        Optimizing...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faTrash} className="mr-2" />
                        Optimize Database
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Results Section */}
              {optimizeResults && (
                <div className="bg-backdrop-medium border border-line-low rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                    <h2 className="text-xl font-semibold text-neutral-dark">
                      Optimization Results
                    </h2>
                  </div>

                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                    <p className="text-sm text-green-800">
                      Database optimization completed successfully. The following items were
                      cleaned:
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {optimizeResults.orphanedModulesDeleted > 0 && (
                      <div className="p-4 rounded bg-backdrop-high border border-line-medium">
                        <div className="text-sm text-neutral-medium mb-1">
                          Orphaned Modules Deleted
                        </div>
                        <div className="text-2xl font-semibold text-neutral-dark">
                          {optimizeResults.orphanedModulesDeleted.toLocaleString()}
                        </div>
                      </div>
                    )}
                    {optimizeResults.invalidPostRefsDeleted > 0 && (
                      <div className="p-4 rounded bg-backdrop-high border border-line-medium">
                        <div className="text-sm text-neutral-medium mb-1">
                          Invalid Post Refs Deleted
                        </div>
                        <div className="text-2xl font-semibold text-neutral-dark">
                          {optimizeResults.invalidPostRefsDeleted.toLocaleString()}
                        </div>
                      </div>
                    )}
                    {optimizeResults.invalidModuleRefsDeleted > 0 && (
                      <div className="p-4 rounded bg-backdrop-high border border-line-medium">
                        <div className="text-sm text-neutral-medium mb-1">
                          Invalid Module Refs Deleted
                        </div>
                        <div className="text-2xl font-semibold text-neutral-dark">
                          {optimizeResults.invalidModuleRefsDeleted.toLocaleString()}
                        </div>
                      </div>
                    )}
                    {optimizeResults.renderCacheCleared > 0 && (
                      <div className="p-4 rounded bg-backdrop-high border border-line-medium">
                        <div className="text-sm text-neutral-medium mb-1">Render Cache Cleared</div>
                        <div className="text-2xl font-semibold text-neutral-dark">
                          {optimizeResults.renderCacheCleared.toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <AdminFooter />

      <AlertDialog
        open={confirmImportOpen}
        onOpenChange={(open) => {
          if (!open && !importing) {
            setConfirmImportOpen(false)
            setPendingImportFile(null)
          } else {
            setConfirmImportOpen(open)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import database?</AlertDialogTitle>
            <AlertDialogDescription>
              Strategy: <span className="font-semibold">{importStrategy}</span> · Preserve IDs:{' '}
              {importPreserveIds ? 'Yes' : 'No'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm text-neutral-medium space-y-2">
            <p>This operation will overwrite existing content. Make sure you have a backup.</p>
            <p className="text-neutral-dark">Proceed with the import now?</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={importing}
              onClick={executeImport}
              className="bg-standout-medium text-on-standout hover:opacity-90"
            >
              {importing ? 'Importing...' : 'Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmOptimizeOpen}
        onOpenChange={(open) => {
          if (!open && !optimizing) {
            setConfirmOptimizeOpen(false)
          } else {
            setConfirmOptimizeOpen(open)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Optimize database?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete orphaned data and invalid references. Make sure you have
              a backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm text-neutral-medium space-y-2">
            <p>Selected optimizations:</p>
            <ul className="list-disc list-inside space-y-1">
              {optimizeOptions.cleanOrphanedModules && (
                <li>
                  Clean orphaned module instances ({optimizeStats?.orphanedModuleInstances || 0})
                </li>
              )}
              {optimizeOptions.cleanInvalidRefs && (
                <li>
                  Clean invalid references (
                  {optimizeStats
                    ? optimizeStats.invalidPostReferences + optimizeStats.invalidModuleReferences
                    : 0}
                  )
                </li>
              )}
              {optimizeOptions.clearRenderCache && (
                <li>Clear render cache ({optimizeStats?.staleRenderCache || 0})</li>
              )}
            </ul>
            <p className="text-neutral-dark font-semibold mt-4">Proceed with optimization?</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={optimizing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={optimizing}
              onClick={handleOptimize}
              className="bg-standout-medium text-on-standout hover:opacity-90"
            >
              {optimizing ? 'Optimizing...' : 'Optimize'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmFrOpen}
        onOpenChange={(open) => {
          if (!open && !frRunning) {
            setConfirmFrOpen(false)
          } else {
            setConfirmFrOpen(open)
          }
        }}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600 flex items-center gap-2">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              Execute Find and Replace?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-dark font-medium">
              This will permanently modify your database. This action CANNOT be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm text-neutral-medium space-y-4 p-4 bg-backdrop-high rounded-lg border border-line-low">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase text-neutral-low mb-1">Finding</div>
                <div className="font-mono text-xs bg-backdrop p-2 rounded border border-line-low break-all">
                  {frSearch}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-neutral-low mb-1"> Replacing with</div>
                <div className="font-mono text-xs bg-backdrop p-2 rounded border border-line-low break-all">
                  {frReplace || <span className="italic opacity-50">(empty string)</span>}
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-neutral-low mb-1">Target Tables</div>
              <div className="text-xs">
                {frSelectedTables.length === frTables.length
                  ? 'All tables'
                  : `${frSelectedTables.length} selected tables`}
              </div>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-100 rounded text-rose-800 text-xs font-semibold">
              Warning: It is highly recommended to perform a Dry Run and have a full database backup before proceeding.
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={frRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={frRunning}
              onClick={handleFrExecute}
              className="bg-rose-600 text-white hover:bg-rose-700 font-bold"
            >
              {frRunning ? 'Processing...' : 'I understand, execute replacement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
