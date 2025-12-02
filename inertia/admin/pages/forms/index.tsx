import { useEffect, useMemo, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'
import { Checkbox } from '../../../components/ui/checkbox'
import { toast } from 'sonner'

interface FormSubmissionSummary {
  id: string
  formSlug: string
  createdAt: string | null
  name?: string | null
  email?: string | null
}

type FormFieldType = 'text' | 'email' | 'textarea' | 'checkbox'

interface FormField {
  slug: string
  label: string
  type: FormFieldType
  required?: boolean
}

interface FormDefinition {
  id: string
  slug: string
  title: string
  description: string
  fields: FormField[]
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

function getXsrf(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

export default function FormsIndex({ forms: initialForms, submissions }: FormsIndexProps) {
  const [forms, setForms] = useState<FormDefinition[]>(initialForms || [])
  const [selectedFormId, setSelectedFormId] = useState<string | null>(initialForms[0]?.id ?? null)
  const [editing, setEditing] = useState<FormDefinition | null>(initialForms[0] ?? null)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeTab, setActiveTab] = useState<'builder' | 'submissions'>('submissions')

  const [availableWebhooks, setAvailableWebhooks] = useState<Array<{ id: string; name: string; events: string[] }>>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/webhooks', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        if (!alive) return
        const list: Array<any> = Array.isArray(j?.data) ? j.data : []
        setAvailableWebhooks(
          list.map((w) => ({
            id: String(w.id),
            name: String(w.name || w.url || w.id),
            events: Array.isArray(w.events) ? w.events : [],
          }))
        )
      } catch {
        if (!alive) setAvailableWebhooks([])
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!selectedFormId) {
      setEditing(null)
      return
    }
    const f = forms.find((x) => x.id === selectedFormId) || null
    setEditing(f)
  }, [selectedFormId, forms])

  function startCreate() {
    setCreating(true)
    setSelectedFormId('__NEW__')
    setEditing({
      id: '__NEW__',
      slug: '',
      title: '',
      description: '',
      fields: [
        { slug: 'name', label: 'Your Name', type: 'text', required: true },
        { slug: 'email', label: 'Your Email', type: 'email', required: true },
        { slug: 'message', label: 'Your Message', type: 'textarea', required: true },
      ],
      subscriptions: [],
      successMessage: 'Thanks! Your message has been sent.',
      thankYouPostId: '',
      createdAt: null,
      updatedAt: null,
    })
    setActiveTab('builder')
  }

  function cancelCreateOrEdit() {
    setCreating(false)
    if (forms.length > 0) {
      setSelectedFormId(forms[0].id)
      setActiveTab('builder')
    } else {
      setSelectedFormId(null)
    }
  }

  function updateField(index: number, patch: Partial<FormField>) {
    if (!editing) return
    const nextFields = editing.fields.slice()
    const current = nextFields[index]
    if (!current) return
    nextFields[index] = { ...current, ...patch }
    setEditing({ ...editing, fields: nextFields })
  }

  function addField() {
    if (!editing) return
    const next: FormField = {
      slug: `field_${editing.fields.length + 1}`,
      label: 'New field',
      type: 'text',
      required: false,
    }
    setEditing({ ...editing, fields: [...editing.fields, next] })
  }

  function removeField(index: number) {
    if (!editing) return
    const next = editing.fields.slice()
    next.splice(index, 1)
    setEditing({ ...editing, fields: next })
  }

  function toggleSubscription(webhookId: string) {
    if (!editing) return
    const set = new Set(editing.subscriptions || [])
    if (set.has(webhookId)) set.delete(webhookId)
    else set.add(webhookId)
    setEditing({ ...editing, subscriptions: Array.from(set) })
  }

  async function saveForm() {
    if (!editing) return
    const isNew = creating || editing.id === '__NEW__'
    const url = isNew ? '/api/forms-definitions' : `/api/forms-definitions/${encodeURIComponent(editing.id)}`
    const method = isNew ? 'POST' : 'PUT'
    try {
      setSaving(true)
      const res = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          slug: editing.slug,
          title: editing.title,
          description: editing.description,
          fields: editing.fields,
          subscriptions: editing.subscriptions,
          successMessage: editing.successMessage,
          thankYouPostId: editing.thankYouPostId || null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(j?.error || 'Failed to save form')
        return
      }
      const saved: FormDefinition | null = j?.data
        ? {
            id: String(j.data.id),
            slug: String(j.data.slug),
            title: String(j.data.title),
            description: j.data.description || '',
            fields: Array.isArray(j.data.fields) ? j.data.fields : [],
            subscriptions: Array.isArray(j.data.subscriptions) ? j.data.subscriptions : [],
            successMessage: j.data.successMessage || '',
            thankYouPostId: j.data.thankYouPostId || '',
            createdAt: j.data.createdAt || null,
            updatedAt: j.data.updatedAt || null,
          }
        : null
      if (!saved) {
        toast.error('Unexpected response while saving form')
        return
      }
      if (isNew) {
        setForms((prev) => [saved, ...prev])
        setCreating(false)
        setSelectedFormId(saved.id)
      } else {
        setForms((prev) => prev.map((f) => (f.id === saved.id ? saved : f)))
      }
      setEditing(saved)
      toast.success('Form saved')
    } finally {
      setSaving(false)
    }
  }

  async function deleteForm(id: string) {
    if (!id || id === '__NEW__') return
    if (!window.confirm('Delete this form? This cannot be undone.')) return
    const url = `/api/forms-definitions/${encodeURIComponent(id)}`
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to delete form')
        return
      }
      setForms((prev) => prev.filter((f) => f.id !== id))
      if (selectedFormId === id) {
        const next = forms.filter((f) => f.id !== id)
        setSelectedFormId(next[0]?.id ?? null)
      }
      toast.success('Form deleted')
    } catch {
      toast.error('Failed to delete form')
    }
  }

  const sortedForms = useMemo(
    () => forms.slice().sort((a, b) => (a.slug || '').localeCompare(b.slug || '')),
    [forms]
  )

  function ThankYouPagePicker({
    value,
    onChange,
  }: {
    value: string
    onChange: (id: string) => void
  }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<Array<{ id: string; title: string; slug: string; type: string }>>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
      let alive = true
      ;(async () => {
        try {
          setLoading(true)
          const params = new URLSearchParams()
          params.set('status', 'published')
          params.set('limit', '20')
          params.set('sortBy', 'updated_at')
          params.set('sortOrder', 'desc')
          if (query) params.set('q', query)
          // Prefer pages for thank-you, but allow any type
          const res = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
          const j = await res.json().catch(() => ({}))
          if (!alive) return
          const list: Array<any> = Array.isArray(j?.data) ? j.data : []
          setResults(
            list.map((p) => ({
              id: String(p.id),
              title: String(p.title || p.slug || p.id),
              slug: String(p.slug || ''),
              type: String(p.type || ''),
            }))
          )
        } catch {
          if (!alive) setResults([])
        } finally {
          if (alive) setLoading(false)
        }
      })()
      return () => {
        alive = false
      }
    }, [query])

    const current = results.find((r) => r.id === value)

    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-neutral-medium mb-1">Thank You Page</label>
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Search published posts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-40 overflow-auto border border-line rounded bg-backdrop-medium/40">
            {loading ? (
              <div className="px-3 py-2 text-xs text-neutral-low">Searching…</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-neutral-low">No results.</div>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onChange(r.id)}
                  className={`w-full text-left px-3 py-1.5 text-xs ${
                    value === r.id ? 'bg-backdrop-medium text-neutral-high' : 'hover:bg-backdrop-medium/60 text-neutral-medium'
                  }`}
                >
                  <span className="font-medium">{r.title}</span>
                  <span className="ml-1 text-[11px] text-neutral-low font-mono">
                    /{r.slug} · {r.type}
                  </span>
                </button>
              ))
            )}
          </div>
          {current && (
            <p className="text-[11px] text-neutral-low">
              Selected: <span className="font-mono">/{current.slug}</span>
            </p>
          )}
          {value && !current && (
            <button
              type="button"
              className="self-start text-[11px] text-danger hover:underline"
              onClick={() => onChange('')}
            >
              Clear selection
            </button>
          )}
        </div>
        <p className="text-[11px] text-neutral-low mt-1">
          If set, successful submissions will redirect to this page instead of showing an inline message.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-backdrop-low">
      <Head title="Forms" />
      <AdminHeader title="Forms" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Forms' }]} />

        {/* Tabs */}
        <div className="mb-6 border-b border-line flex items-center gap-2 text-sm md:text-base">
          <button
            type="button"
            className={`px-4 py-2 font-medium rounded-t-md border-b-2 transition-colors ${
              activeTab === 'submissions'
                ? 'border-standout text-neutral-high bg-backdrop-medium'
                : 'border-transparent text-neutral-medium hover:text-neutral-high hover:bg-backdrop-medium/60'
            }`}
            onClick={() => setActiveTab('submissions')}
          >
            Submissions
          </button>
          <button
            type="button"
            className={`px-4 py-2 font-medium rounded-t-md border-b-2 transition-colors ${
              activeTab === 'builder'
                ? 'border-standout text-neutral-high bg-backdrop-medium'
                : 'border-transparent text-neutral-medium hover:text-neutral-high hover:bg-backdrop-medium/60'
            }`}
            onClick={() => setActiveTab('builder')}
          >
            Form Builder
          </button>
        </div>

        {/* Form definitions */}
        {activeTab === 'builder' && (
        <div className="bg-backdrop-low border border-line rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-line flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-high">Form Definitions</h2>
              <p className="text-xs text-neutral-low">
                Create and manage forms that can be embedded via the <code>Form</code> and <code>Prose with Form</code> modules.
              </p>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded border border-line bg-backdrop-medium hover:bg-backdrop-medium/80 text-neutral-high"
              onClick={startCreate}
            >
              New Form
            </button>
          </div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-[260px,minmax(0,1fr)] gap-6">
            {/* List */}
            <div>
              <div className="text-xs font-medium text-neutral-medium mb-2">Forms</div>
              <div className="border border-line rounded divide-y divide-line bg-backdrop-medium/40 max-h-[360px] overflow-auto">
                {sortedForms.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-neutral-low">No forms yet. Click “New Form” to create one.</div>
                ) : (
                  sortedForms.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setCreating(false)
                        setSelectedFormId(f.id)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                        selectedFormId === f.id ? 'bg-backdrop-medium text-neutral-high' : 'hover:bg-backdrop-medium/60 text-neutral-medium'
                      }`}
                    >
                      <span className="truncate">
                        {f.title || f.slug}
                        <span className="ml-1 text-[11px] text-neutral-low font-mono">/{f.slug}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
            {/* Editor */}
            <div>
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-medium mb-1">Slug</label>
                      <Input
                        value={editing.slug}
                        onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                        placeholder="contact"
                      />
                      <p className="text-[11px] text-neutral-low mt-1">
                        Used in URLs and module configuration, e.g. <code>/api/forms/&lt;slug&gt;</code>.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-medium mb-1">Title</label>
                      <Input
                        value={editing.title}
                        onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                        placeholder="Contact Us"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-1">Description</label>
                    <Textarea
                      value={editing.description || ''}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      rows={3}
                      placeholder="Optional description shown above the form."
                    />
                  </div>

                  {/* Success message and thank-you page */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-medium mb-1">Success Message</label>
                      <Textarea
                        value={editing.successMessage || ''}
                        onChange={(e) => setEditing({ ...editing, successMessage: e.target.value })}
                        rows={3}
                        placeholder="Message shown after successful submission (if no thank-you page is set)."
                      />
                    </div>
                    <ThankYouPagePicker
                      value={editing.thankYouPostId || ''}
                      onChange={(id) => setEditing({ ...editing, thankYouPostId: id })}
                    />
                  </div>

                  {/* Fields */}
                  <div className="border border-line rounded-md p-4 space-y-3 bg-backdrop-medium/40">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-semibold text-neutral-high">Fields</h3>
                      <button
                        type="button"
                        className="px-2 py-1 text-xs rounded border border-line hover:bg-backdrop-medium text-neutral-medium"
                        onClick={addField}
                      >
                        Add Field
                      </button>
                    </div>
                    {editing.fields.length === 0 ? (
                      <p className="text-xs text-neutral-low">No fields defined yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {editing.fields.map((field, idx) => (
                          <div
                            key={`${field.slug}-${idx}`}
                            className="grid grid-cols-1 md:grid-cols-[1.2fr,1.2fr,0.9fr,auto] gap-2 items-start"
                          >
                            <div>
                              <label className="block text-[11px] font-medium text-neutral-medium mb-1">Slug</label>
                              <Input
                                value={field.slug}
                                onChange={(e) => updateField(idx, { slug: e.target.value })}
                                placeholder="field_slug"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-neutral-medium mb-1">Label</label>
                              <Input
                                value={field.label}
                                onChange={(e) => updateField(idx, { label: e.target.value })}
                                placeholder="Field label"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-neutral-medium mb-1">Type</label>
                              <Select
                                value={field.type}
                                onValueChange={(val) => updateField(idx, { type: val as FormFieldType })}
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Text</SelectItem>
                                  <SelectItem value="email">Email</SelectItem>
                                  <SelectItem value="textarea">Textarea</SelectItem>
                                  <SelectItem value="checkbox">Checkbox</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-3 mt-5 md:mt-0">
                              <label className="inline-flex items-center gap-2 text-xs text-neutral-medium">
                                <Checkbox
                                  checked={!!field.required}
                                  onCheckedChange={(c) => updateField(idx, { required: !!c })}
                                />
                                Required
                              </label>
                              <button
                                type="button"
                                className="text-xs text-danger hover:underline"
                                onClick={() => removeField(idx)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Subscriptions */}
                  <div className="border border-line rounded-md p-4 space-y-3 bg-backdrop-medium/40">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-semibold text-neutral-high">Subscriptions</h3>
                    </div>
                    {availableWebhooks.length === 0 ? (
                      <p className="text-xs text-neutral-low">
                        No webhooks configured yet. Create webhooks under <code>Settings → Webhooks</code>.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {availableWebhooks.map((w) => {
                          const hasFormSubmitted = w.events.includes('form.submitted')
                          const checked = editing.subscriptions?.includes(w.id)
                          return (
                            <label
                              key={w.id}
                              className="flex items-center gap-2 text-xs text-neutral-high cursor-pointer"
                            >
                              <Checkbox
                                checked={checked}
                                disabled={!hasFormSubmitted}
                                onCheckedChange={() => toggleSubscription(w.id)}
                              />
                              <span>
                                {w.name}
                                {!hasFormSubmitted && (
                                  <span className="ml-2 text-[11px] text-warning">
                                    (does not subscribe to <code>form.submitted</code>)
                                  </span>
                                )}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-sm rounded bg-standout text-on-standout disabled:opacity-60"
                      onClick={saveForm}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save Form'}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-sm rounded border border-line text-neutral-medium"
                      onClick={cancelCreateOrEdit}
                    >
                      Cancel
                    </button>
                    {!creating && editing.id !== '__NEW__' && (
                      <button
                        type="button"
                        className="ml-auto px-3 py-1.5 text-sm rounded border border-danger text-danger"
                        onClick={() => deleteForm(editing.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-medium">
                  Select a form on the left or create a new one to get started.
                </p>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Submissions */}
        {activeTab === 'submissions' && (
        <div className="bg-backdrop-low border border-line rounded-lg">
          <div className="px-6 py-4 border-b border-line flex items-center justify-between">
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-line text-sm">
                  <thead className="bg-backdrop-medium">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-neutral-high">Form</th>
                      <th className="px-4 py-2 text-left font-medium text-neutral-high">Name</th>
                      <th className="px-4 py-2 text-left font-medium text-neutral-high">Email</th>
                      <th className="px-4 py-2 text-left font-medium text-neutral-high">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {submissions.map((s) => (
                      <tr key={s.id} className="hover:bg-backdrop-medium/40">
                        <td className="px-4 py-2 text-neutral-high">
                          <span className="inline-flex items-center rounded-full bg-backdrop-medium px-2 py-0.5 text-xs font-mono">
                            {s.formSlug}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-neutral-medium">
                          {s.name || <span className="text-neutral-low">—</span>}
                        </td>
                        <td className="px-4 py-2 text-neutral-medium">
                          {s.email || <span className="text-neutral-low">—</span>}
                        </td>
                        <td className="px-4 py-2 text-neutral-medium">
                          {s.createdAt
                            ? new Date(s.createdAt).toLocaleString()
                            : <span className="text-neutral-low">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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



