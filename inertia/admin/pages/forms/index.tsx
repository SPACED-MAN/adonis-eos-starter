import { useMemo, useState } from 'react'
import { Head, Link } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { Input } from '../../../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table'

interface FormSubmissionSummary {
  id: string
  formSlug: string
  createdAt: string | null
  name?: string | null
  email?: string | null
}

interface FormDefinition {
  id: string
  slug: string
  title: string
  description: string
  fields: any[]
  subscriptions: string[]
  successMessage: string
  thankYouPostId: string
  createdAt: string | null
  updatedAt: string | null
}

interface FormsIndexProps {
  forms: FormDefinition[]
  submissions: FormSubmissionSummary[]
}

export default function FormsIndex({ forms: initialForms, submissions }: FormsIndexProps) {
  const [activeTab, setActiveTab] = useState<'builder' | 'submissions'>('submissions')
  const [formsFilter, setFormsFilter] = useState('')
  const sortedForms = useMemo(
    () => (initialForms || []).slice().sort((a, b) => (a.slug || '').localeCompare(b.slug || '')),
    [initialForms]
  )

  const visibleForms = useMemo(() => {
    const q = formsFilter.trim().toLowerCase()
    const base = sortedForms
    if (!q) return base
    return base.filter((f) => {
      const title = String(f.title || '').toLowerCase()
      const slug = String(f.slug || '').toLowerCase()
      return title.includes(q) || slug.includes(q)
    })
  }, [sortedForms, formsFilter])

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Forms" />
      <AdminHeader title="Forms" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6 border-b border-line-low flex items-center gap-2 text-sm md:text-base">
          <button
            type="button"
            className={`px-4 py-2 font-medium rounded-t-md border-b-2 transition-colors ${activeTab === 'submissions'
              ? 'border-standout-medium text-neutral-high bg-backdrop-medium'
              : 'border-transparent text-neutral-medium hover:text-neutral-high hover:bg-backdrop-medium/60'
              }`}
            onClick={() => setActiveTab('submissions')}
          >
            Submissions
          </button>
          <button
            type="button"
            className={`px-4 py-2 font-medium rounded-t-md border-b-2 transition-colors ${activeTab === 'builder'
              ? 'border-standout-medium text-neutral-high bg-backdrop-medium'
              : 'border-transparent text-neutral-medium hover:text-neutral-high hover:bg-backdrop-medium/60'
              }`}
            onClick={() => setActiveTab('builder')}
          >
            Forms
          </button>
        </div>

        {/* Form definitions */}
        {activeTab === 'builder' && (
          <div className="bg-backdrop-low border border-line-low rounded-lg mb-8">
            <div className="px-6 py-4 border-b border-line-low flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-high">Form Definitions</h2>
                <p className="text-xs text-neutral-low">
                  Create and manage forms that can be embedded via the <code>Form</code> and{' '}
                  <code>Prose with Form</code> modules.
                </p>
              </div>
              <Link
                href="/admin/forms/new"
                className="px-3 py-1.5 text-xs rounded border border-line-low bg-backdrop-medium hover:bg-backdrop-medium/80 text-neutral-high"
              >
                New Form
              </Link>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-neutral-medium">Forms</div>
                  <Input
                    value={formsFilter}
                    onChange={(e) => setFormsFilter(e.target.value)}
                    placeholder="Filter forms…"
                    className="h-8 max-w-xs"
                  />
                </div>

                {sortedForms.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-neutral-low border border-line-low rounded bg-backdrop-medium/40">
                    No forms yet. Click “New Form” above to create one.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Fields</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleForms.map((f) => (
                        <TableRow
                          key={f.id}
                          className="cursor-pointer"
                          onClick={() => (window.location.href = `/admin/forms/${encodeURIComponent(f.id)}/edit`)}
                        >
                          <TableCell className="font-medium text-neutral-high">{f.title || '—'}</TableCell>
                          <TableCell className="font-mono text-xs text-neutral-medium">/{f.slug}</TableCell>
                          <TableCell className="text-neutral-medium">
                            {Array.isArray(f.fields) ? f.fields.length : 0}
                          </TableCell>
                          <TableCell className="text-xs text-neutral-low">
                            {f.updatedAt ? new Date(f.updatedAt).toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Link
                              href={`/admin/forms/${encodeURIComponent(f.id)}/edit`}
                              className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
                            >
                              Edit
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                      {visibleForms.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-neutral-low">
                            No forms match your filter.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submissions */}
        {activeTab === 'submissions' && (
          <div className="bg-backdrop-low border border-line-low rounded-lg">
            <div className="px-6 py-4 border-b border-line-low flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-high">Form Submissions</h2>
              <span className="text-xs text-neutral-low">
                Showing latest {submissions.length} submissions
              </span>
            </div>
            <div className="p-6">
              {submissions.length === 0 ? (
                <p className="text-sm text-neutral-medium">
                  No submissions yet. Add a <code>Form</code> or <code>Prose with Form</code> module
                  to a page and submit it to see entries here.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Form</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((s) => (
                      <TableRow key={s.id}>
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
                          {s.createdAt ? (
                            new Date(s.createdAt).toLocaleString()
                          ) : (
                            <span className="text-neutral-low">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}
