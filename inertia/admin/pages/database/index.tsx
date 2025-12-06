import { Head } from '@inertiajs/react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faDownload,
  faUpload,
  faDatabase,
  faCheckCircle,
  faExclamationTriangle,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'

interface ExportStats {
  tables: Array<{ name: string; rowCount: number; contentType?: string }>
  totalRows: number
  estimatedSize: string
  contentTypes?: Record<string, { tables: string[]; rowCount: number }>
}

interface ImportResult {
  tablesImported: number
  rowsImported: number
  skippedTables: string[]
  errors: Array<{ table: string; error: string }>
}

type ContentType = 'media' | 'posts' | 'modules' | 'forms' | 'menus' | 'categories' | 'templates'

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  media: 'Media Assets',
  posts: 'Posts & Translations',
  modules: 'Modules (Global & Instances)',
  forms: 'Forms & Submissions',
  menus: 'Menus',
  categories: 'Categories',
  templates: 'Templates',
}

export default function DatabaseIndex() {
  const [exportStats, setExportStats] = useState<ExportStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [validating, setValidating] = useState(false)
  const [importStrategy, setImportStrategy] = useState<'replace' | 'merge' | 'skip' | 'overwrite'>('merge')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [validationResult, setValidationResult] = useState<any>(null)
  
  // Export options
  const [selectedContentTypes, setSelectedContentTypes] = useState<ContentType[]>([
    'media',
    'posts',
    'modules',
    'forms',
    'menus',
    'categories',
    'templates',
  ])
  const [preserveIds, setPreserveIds] = useState(true)
  
  // Import options
  const [importPreserveIds, setImportPreserveIds] = useState(true)

  // Load export stats on mount
  useEffect(() => {
    loadExportStats()
  }, [])

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
      setSelectedContentTypes(['media', 'posts', 'modules', 'forms', 'menus', 'categories', 'templates'])
    }
  }

  // Export database
  const handleExport = async () => {
    if (selectedContentTypes.length === 0) {
      toast.error('Please select at least one content type to export')
      return
    }

    setExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('contentTypes', selectedContentTypes.join(','))
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

  // Import database
  const handleImport = async (file: File) => {
    if (!confirm(`Are you sure you want to import this database with strategy "${importStrategy}"?\n\nThis operation cannot be undone.`)) {
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
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
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Database Export/Import" />
      <AdminHeader title="Database Export/Import" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="bg-backdrop-low rounded-lg shadow border border-line-low p-6">
          <div className="mb-6">
            <p className="text-neutral-medium">
              Export your database for backup or migration, or import from a previous export.
              Select which content types to include and configure ID preservation options.
            </p>
          </div>

          {/* Export Section */}
          <div className="bg-backdrop-medium border border-line-low rounded-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FontAwesomeIcon icon={faDownload} className="text-standout" />
              <h2 className="text-xl font-semibold text-neutral-dark">Export Database</h2>
            </div>

            <p className="text-neutral-medium mb-4">
              Download a backup of your database as a JSON file. Select which content types to include.
            </p>

            {/* Content Type Selection */}
            <div className="mb-4 p-4 bg-backdrop-high rounded border border-line-medium">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-neutral-dark">Content Types to Export</h3>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-standout hover:underline"
                >
                  {selectedContentTypes.length === 7 ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((type) => {
                  const stats = exportStats?.contentTypes?.[type]
                  const isSelected = selectedContentTypes.includes(type)
                  return (
                    <label
                      key={type}
                      className={`flex items-center gap-2 p-3 rounded border cursor-pointer transition ${
                        isSelected
                          ? 'border-standout bg-standout/10'
                          : 'border-line-medium hover:border-line-high'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleContentType(type)}
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
                  <span className="text-sm font-medium text-neutral-dark">Preserve Original IDs</span>
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
                disabled={exporting || selectedContentTypes.length === 0}
                className="px-4 py-2 bg-standout text-on-standout rounded-lg hover:opacity-90 transition disabled:opacity-50 font-medium"
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
                    <div className="text-lg font-semibold">{exportStats.totalRows.toLocaleString()}</div>
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
                        <span className="text-neutral-medium">{table.rowCount.toLocaleString()} rows</span>
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
              <FontAwesomeIcon icon={faUpload} className="text-standout" />
              <h2 className="text-xl font-semibold text-neutral-dark">Import Database</h2>
            </div>

            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-600 mt-1" />
                <div className="text-sm">
                  <p className="font-semibold text-yellow-800 mb-1">Warning: This is a destructive operation</p>
                  <p className="text-yellow-700">
                    Importing a database will modify your existing data. Always create a backup before importing.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-dark mb-2">Import Strategy</label>
              <select
                value={importStrategy}
                onChange={(e) => setImportStrategy(e.target.value as any)}
                className="w-full px-3 py-2 border border-line-medium rounded-lg bg-backdrop-low"
              >
                <option value="merge">Merge - Add new records, skip conflicts (safest)</option>
                <option value="overwrite">Overwrite - Update existing records with matching IDs, insert new</option>
                <option value="skip">Skip - Only import to empty tables</option>
                <option value="replace">Replace - Clear and replace all data (destructive)</option>
              </select>
              <p className="text-xs text-neutral-medium mt-1">
                {importStrategy === 'merge' && 'Recommended: Adds new records without removing existing data'}
                {importStrategy === 'overwrite' && 'Updates existing records if IDs match, inserts new ones otherwise'}
                {importStrategy === 'skip' && 'Only imports data into tables that are currently empty'}
                {importStrategy === 'replace' && 'WARNING: Deletes all existing data before importing'}
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
                  <span className="text-sm font-medium text-neutral-dark">Preserve IDs from Export</span>
                  <p className="text-xs text-neutral-medium">
                    Use the original IDs from the export file. Disable to generate new IDs on import.
                  </p>
                </div>
              </label>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-dark mb-2">Select Import File</label>
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleValidateFile(file)
                  }
                }}
                className="w-full px-3 py-2 border border-line-medium rounded-lg bg-backdrop-low file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-standout file:text-on-standout hover:file:opacity-90"
              />
            </div>

            {validating && (
              <div className="p-4 bg-backdrop-high rounded border border-line-low mb-4">
                <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                Validating file...
              </div>
            )}

            {validationResult && (
              <div className={`p-4 rounded border mb-4 ${validationResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
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
                        <p>Content types: {validationResult.metadata.contentTypes.join(', ')}</p>
                      )}
                      {validationResult.metadata?.preserveIds !== undefined && (
                        <p>Preserves IDs: {validationResult.metadata.preserveIds ? 'Yes' : 'No'}</p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
                        const file = fileInput?.files?.[0]
                        if (file) handleImport(file)
                      }}
                      disabled={importing}
                      className="mt-3 px-4 py-2 bg-standout text-on-standout rounded-lg hover:opacity-90 transition disabled:opacity-50 font-medium"
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
              <div className="p-4 bg-backdrop-high rounded border border-line-medium">
                <h3 className="font-semibold text-neutral-dark mb-2">Import Results</h3>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <div className="text-sm text-neutral-medium">Tables Imported</div>
                    <div className="text-lg font-semibold">{importResult.tablesImported}</div>
                  </div>
                  <div>
                    <div className="text-sm text-neutral-medium">Rows Imported</div>
                    <div className="text-lg font-semibold">{importResult.rowsImported.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-neutral-medium">Tables Skipped</div>
                    <div className="text-lg font-semibold">{importResult.skippedTables.length}</div>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="font-semibold text-red-800 mb-2">Errors:</p>
                    <div className="space-y-1 text-sm text-red-700">
                      {importResult.errors.map((err, i) => (
                        <div key={i}>
                          <span className="font-mono">{err.table}</span>: {err.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <AdminFooter />
    </div>
  )
}
