import { useMemo, useState, useEffect } from 'react'
import { Head, router } from '@inertiajs/react'
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
import { Input } from '../../../components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { Checkbox } from '../../../components/ui/checkbox'
import { toast } from 'sonner'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faTrash, faSpinner, faSearch } from '@fortawesome/free-solid-svg-icons'

interface FormSubmissionSummary {
  id: string
  formSlug: string
  createdAt: string | null
  name?: string | null
  email?: string | null
  payload: Record<string, any>
  abVariation?: string | null
}

interface FormDefinition {
  slug: string
  title: string
}

interface FormsIndexProps {
  forms: FormDefinition[]
  submissions: FormSubmissionSummary[]
  meta: {
    total: number
    page: number
    limit: number
    q: string
    formSlug: string
  }
}

export default function FormsIndex({ forms, submissions, meta }: FormsIndexProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmissionSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | boolean>(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [q, setQ] = useState(meta.q || '')
  const [formSlug, setFormSlug] = useState(meta.formSlug || 'all')
  const [isExporting, setIsExporting] = useState(false)

  // CSRF token for API calls
  const xsrfFromCookie: string | undefined = (() => {
    if (typeof document === 'undefined') return undefined
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : undefined
  })()

  const handleSearch = () => {
    router.get(
      '/admin/forms',
      { q, form_slug: formSlug === 'all' ? '' : formSlug, page: 1 },
      { preserveState: true }
    )
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (q !== meta.q) handleSearch()
    }, 500)
    return () => clearTimeout(timeout)
  }, [q])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this submission?')) return
    setIsDeleting(id)
    try {
      await router.delete(`/api/forms-submissions/${id}`, {
        onSuccess: () => {
          toast.success('Submission deleted')
          setSelectedSubmission(null)
          setSelectedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
        onError: () => toast.error('Failed to delete submission'),
        onFinish: () => setIsDeleting(false),
      })
    } catch {
      setIsDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} submissions?`)) return

    setIsDeleting(true)
    try {
      const res = await fetch('/api/forms-submissions/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })

      if (res.ok) {
        toast.success(`Deleted ${selectedIds.size} submissions`)
        setSelectedIds(new Set())
        router.reload()
      } else {
        toast.error('Failed to delete submissions')
      }
    } catch {
      toast.error('Failed to delete submissions')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      if (meta.q) params.set('q', meta.q)
      if (meta.formSlug) params.set('form_slug', meta.formSlug)

      window.location.href = `/api/forms-submissions/export?${params.toString()}`
      toast.success('Export started')
    } catch {
      toast.error('Export failed')
    } finally {
      setTimeout(() => setIsExporting(false), 2000)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === submissions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(submissions.map((s) => s.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Forms" />
      <AdminHeader title="Forms" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low border border-line-low rounded-lg">
          <div className="px-6 py-4 border-b border-line-low">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search submissions..."
                    className="pl-9 w-64 h-9 text-sm"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-low">
                    <FontAwesomeIcon icon={faSearch} size="xs" />
                  </div>
                </div>

                <Select
                  value={formSlug}
                  onValueChange={(val) => {
                    setFormSlug(val)
                    router.get(
                      '/admin/forms',
                      { q, form_slug: val === 'all' ? '' : val, page: 1 },
                      { preserveState: true }
                    )
                  }}
                >
                  <SelectTrigger className="w-48 h-9 text-sm">
                    <SelectValue placeholder="All Forms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Forms</SelectItem>
                    {forms.map((f) => (
                      <SelectItem key={f.slug} value={f.slug}>
                        {f.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedIds.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={Boolean(isDeleting)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-danger/10 text-danger hover:bg-danger/20 rounded-md transition-colors"
                  >
                    <FontAwesomeIcon icon={faTrash} size="xs" />
                    Delete {selectedIds.size}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-standout-medium text-on-standout rounded-md hover:bg-standout-medium/90 transition-colors disabled:opacity-50"
                >
                  {isExporting ? (
                    <FontAwesomeIcon icon={faSpinner} spin size="sm" />
                  ) : (
                    <FontAwesomeIcon icon={faDownload} size="sm" />
                  )}
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {submissions.length === 0 ? (
              <div className="py-12 text-center">
              <p className="text-sm text-neutral-medium italic">
                  No submissions found. Try adjusting your filters.
              </p>
              </div>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.size === submissions.length && submissions.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                      <TableHead>Var</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {submissions.map((s) => (
                    <TableRow 
                      key={s.id} 
                      className="cursor-pointer hover:bg-backdrop-medium/40"
                      onClick={() => setSelectedSubmission(s)}
                    >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(s.id)}
                            onCheckedChange={() => toggleSelect(s.id)}
                          />
                        </TableCell>
                      <TableCell className="text-neutral-high">
                        <span className="inline-flex items-center rounded-full bg-backdrop-medium px-2 py-0.5 text-xs font-mono">
                          {s.formSlug}
                        </span>
                      </TableCell>
                      <TableCell className="text-neutral-medium">
                        {s.name || <span className="text-neutral-low">—</span>}
                      </TableCell>
                      <TableCell className="text-neutral-medium">
                        {s.email || <span className="text-neutral-low">—</span>}
                      </TableCell>
                        <TableCell className="text-neutral-medium">
                          {s.abVariation ? (
                            <span className="inline-flex items-center rounded-full bg-standout-medium/10 text-standout-medium px-2 py-0.5 text-xs font-bold">
                              {s.abVariation}
                            </span>
                          ) : (
                            <span className="text-neutral-low">—</span>
                          )}
                        </TableCell>
                      <TableCell className="text-neutral-medium text-xs">
                        {s.createdAt ? (
                          new Date(s.createdAt).toLocaleString()
                        ) : (
                          <span className="text-neutral-low">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="px-2 py-1 text-xs text-neutral-low hover:text-danger disabled:opacity-50"
                          onClick={() => handleDelete(s.id)}
                          disabled={isDeleting === s.id}
                        >
                          Delete
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

                {/* Pagination */}
                <div className="mt-6 flex items-center justify-between text-sm">
                  <div className="text-neutral-medium">
                    Showing {(meta.page - 1) * meta.limit + 1} to{' '}
                    {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} submissions
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1.5 border border-line-low rounded-md disabled:opacity-50 hover:bg-backdrop-medium"
                      onClick={() =>
                        router.get(
                          '/admin/forms',
                          { ...meta, page: meta.page - 1 },
                          { preserveState: true }
                        )
                      }
                      disabled={meta.page <= 1}
                    >
                      Previous
                    </button>
                    <span className="px-4 py-1.5 bg-backdrop-medium rounded-md font-medium">
                      {meta.page}
                    </span>
                    <button
                      className="px-3 py-1.5 border border-line-low rounded-md disabled:opacity-50 hover:bg-backdrop-medium"
                      onClick={() =>
                        router.get(
                          '/admin/forms',
                          { ...meta, page: meta.page + 1 },
                          { preserveState: true }
                        )
                      }
                      disabled={meta.page * meta.limit >= meta.total}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <Dialog
        open={!!selectedSubmission}
        onOpenChange={(open) => !open && setSelectedSubmission(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>
              Form: <span className="font-mono">{selectedSubmission?.formSlug}</span> •{' '}
              {selectedSubmission?.createdAt &&
                new Date(selectedSubmission.createdAt).toLocaleString()}
              {selectedSubmission?.abVariation && (
                <span className="ml-2 inline-flex items-center rounded-full bg-standout-medium/10 text-standout-medium px-2 py-0.5 text-xs font-bold">
                  Var {selectedSubmission.abVariation}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 overflow-auto max-h-[60vh] p-1">
              {selectedSubmission &&
                Object.entries(selectedSubmission.payload).map(([key, value]) => (
                <div key={key} className="border-b border-line-low pb-2 last:border-0">
                    <div className="text-[10px] font-bold text-neutral-low uppercase tracking-wider mb-1">
                      {key}
                    </div>
                  <div className="text-sm text-neutral-high whitespace-pre-wrap">
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-4 border-t border-line-low">
              <button
                type="button"
                className="px-4 py-2 text-sm rounded border border-line-medium text-neutral-high hover:bg-backdrop-medium transition-colors"
                onClick={() => setSelectedSubmission(null)}
              >
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}
