import { useEffect, useMemo, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { Checkbox } from '../../../components/ui/checkbox'
import { toast } from 'sonner'
import { ThankYouPagePicker } from './ThankYouPagePicker'

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

function slugify(input: string): string {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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
  const [slugAuto, setSlugAuto] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<'builder' | 'submissions'>('submissions')

  const [availableWebhooks, setAvailableWebhooks] = useState<
    Array<{ id: string; name: string; events: string[] }>
  >([])

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

  function startCreate() {
    setCreating(true)
    setSelectedFormId('__NEW__')
    setSlugAuto(true)
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
    // If we're creating a brand new form, cancel should close the editor entirely
    if (creating || editing?.id === '__NEW__') {
      setCreating(false)
      setSelectedFormId(null)
      setEditing(null)
      setSlugAuto(true)
      return
    }

    // If we're editing an existing form, reset to the last saved version
    if (editing) {
      const original = forms.find((f) => f.id === editing.id)
      if (original) {
        setEditing(original)
        setSlugAuto(() => {
          const s = String(original.slug || '').trim()
          const t = String(original.title || '').trim()
          if (!s) return true
          return slugify(t) === s
        })
      }
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

  function addSubscriptionRow() {
    if (!editing) return
    const next = Array.isArray(editing.subscriptions) ? editing.subscriptions.slice() : []
    next.push('')
    setEditing({ ...editing, subscriptions: next })
  }

  function updateSubscriptionRow(index: number, value: string) {
    if (!editing) return
    const next = Array.isArray(editing.subscriptions) ? editing.subscriptions.slice() : []
    if (index < 0 || index >= next.length) return
    next[index] = value
    setEditing({ ...editing, subscriptions: next })
  }

  function removeSubscriptionRow(index: number) {
    if (!editing) return
    const next = Array.isArray(editing.subscriptions) ? editing.subscriptions.slice() : []
    if (index < 0 || index >= next.length) return
    next.splice(index, 1)
    setEditing({ ...editing, subscriptions: next })
  }

  async function saveForm() {
    if (!editing) return
    const isNew = creating || editing.id === '__NEW__'
    const url = isNew
      ? '/api/forms-definitions'
      : `/api/forms-definitions/${encodeURIComponent(editing.id)}`
    const method = isNew ? 'POST' : 'PUT'
    try {
      setSaving(true)
      const res = await fetch(url, {
        method,
        headers: {
          'Accept': 'application/json',
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
      setForms((prev) => {
        const next = prev.filter((f) => f.id !== id)
        if (selectedFormId === id) {
          const first = next[0] ?? null
          setSelectedFormId(first?.id ?? null)
          setEditing(first ?? null)
        }
        return next
      })
      toast.success('Form deleted')
    } catch {
      toast.error('Failed to delete form')
    }
  }

  const sortedForms = useMemo(
    () => forms.slice().sort((a, b) => (a.slug || '').localeCompare(b.slug || '')),
    [forms]
  )

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Forms" />
      <AdminHeader title="Forms" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6 border-b border-line-low flex items-center gap-2 text-sm md:text-base">
          <button
            type="button"
            className={`px-4 py-2 font-medium rounded-t-md border-b-2 transition-colors ${
              activeTab === 'submissions'
                ? 'border-standout-medium text-neutral-high bg-backdrop-medium'
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
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded border border-line-low bg-backdrop-medium hover:bg-backdrop-medium/80 text-neutral-high"
                onClick={startCreate}
              >
                New Form
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Creation editor pinned to the top when creating a new form */}
              {creating && editing && editing.id === '__NEW__' && (
                <div className="border border-line-low rounded-md bg-backdrop-medium/40 p-4">
                  <EditorInner
                    editing={editing}
                    creating={true}
                    saving={saving}
                    slugAuto={slugAuto}
                    setEditing={setEditing}
                    setSlugAuto={setSlugAuto}
                    availableWebhooks={availableWebhooks}
                    addField={addField}
                    updateField={updateField}
                    removeField={removeField}
                    addSubscriptionRow={addSubscriptionRow}
                    updateSubscriptionRow={updateSubscriptionRow}
                    removeSubscriptionRow={removeSubscriptionRow}
                    saveForm={saveForm}
                    cancelCreateOrEdit={cancelCreateOrEdit}
                    deleteForm={deleteForm}
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-neutral-medium">Forms</div>
                  {sortedForms.length > 0 && !creating && (
                    <span className="text-[11px] text-neutral-low">
                      Click a form below to expand and edit it.
                    </span>
                  )}
                </div>
                {sortedForms.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-neutral-low border border-line-low rounded bg-backdrop-medium/40">
                    No forms yet. Click “New Form” above to create one.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedForms.map((f) => {
                      const isOpen =
                        !creating && selectedFormId === f.id && editing && editing.id === f.id
                      return (
                        <div
                          key={f.id}
                          className="border border-line-low rounded bg-backdrop-medium/40"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (isOpen) {
                                setSelectedFormId(null)
                                setEditing(null)
                              } else {
                                setCreating(false)
                                setSelectedFormId(f.id)
                                setEditing(f)
                                setSlugAuto(() => {
                                  const s = String(f.slug || '').trim()
                                  const t = String(f.title || '').trim()
                                  if (!s) return true
                                  return slugify(t) === s
                                })
                              }
                            }}
                            className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-backdrop-medium/60"
                          >
                            <span className="truncate">
                              {f.title || f.slug}
                              <span className="ml-1 text-[11px] text-neutral-low font-mono">
                                /{f.slug}
                              </span>
                            </span>
                            <span className="ml-2 text-[11px] text-neutral-low">
                              {isOpen ? 'Hide' : 'Edit'}
                            </span>
                          </button>
                          {isOpen && (
                            <div className="border-t border-line-low p-4">
                              <EditorInner
                                editing={editing}
                                creating={false}
                                saving={saving}
                                slugAuto={slugAuto}
                                setEditing={setEditing}
                                setSlugAuto={setSlugAuto}
                                availableWebhooks={availableWebhooks}
                                addField={addField}
                                updateField={updateField}
                                removeField={removeField}
                                addSubscriptionRow={addSubscriptionRow}
                                updateSubscriptionRow={updateSubscriptionRow}
                                removeSubscriptionRow={removeSubscriptionRow}
                                saveForm={saveForm}
                                cancelCreateOrEdit={cancelCreateOrEdit}
                                deleteForm={deleteForm}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
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
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-line text-sm">
                    <thead className="bg-backdrop-medium">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-neutral-high">Form</th>
                        <th className="px-4 py-2 text-left font-medium text-neutral-high">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-neutral-high">Email</th>
                        <th className="px-4 py-2 text-left font-medium text-neutral-high">
                          Submitted
                        </th>
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
                            {s.createdAt ? (
                              new Date(s.createdAt).toLocaleString()
                            ) : (
                              <span className="text-neutral-low">—</span>
                            )}
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

function EditorInner({
  editing,
  creating,
  saving,
  slugAuto,
  setEditing,
  setSlugAuto,
  availableWebhooks,
  addField,
  updateField,
  removeField,
  addSubscriptionRow,
  updateSubscriptionRow,
  removeSubscriptionRow,
  saveForm,
  cancelCreateOrEdit,
  deleteForm,
}: {
  editing: FormDefinition
  creating: boolean
  saving: boolean
  slugAuto: boolean
  setEditing: React.Dispatch<React.SetStateAction<FormDefinition | null>>
  setSlugAuto: (val: boolean) => void
  availableWebhooks: Array<{ id: string; name: string; events: string[] }>
  addField: () => void
  updateField: (index: number, patch: Partial<FormField>) => void
  removeField: (index: number) => void
  addSubscriptionRow: () => void
  updateSubscriptionRow: (index: number, value: string) => void
  removeSubscriptionRow: (index: number) => void
  saveForm: () => Promise<void>
  cancelCreateOrEdit: () => void
  deleteForm: (id: string) => Promise<void>
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-neutral-high">
            {creating || editing.id === '__NEW__' ? 'New Form' : 'Edit Form'}
          </h3>
          {editing.slug && editing.id !== '__NEW__' && (
            <p className="text-xs text-neutral-low font-mono">/{editing.slug}</p>
          )}
        </div>
        {(creating || editing.id === '__NEW__') && (
          <span className="px-2 py-0.5 text-[11px] rounded-full border border-standout-medium/40 bg-standout-medium/10 text-standout-medium">
            Creating new
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-medium mb-1">Title</label>
          <Input
            value={editing.title}
            onChange={(e) => {
              const val = e.target.value
              setEditing((current) =>
                current
                  ? {
                      ...current,
                      title: val,
                      slug: slugAuto ? slugify(val) : current.slug,
                    }
                  : current
              )
            }}
            placeholder="Enter form title"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-medium mb-1">Slug</label>
          <Input
            value={editing.slug}
            onChange={(e) => {
              const v = slugify(e.target.value)
              setEditing((current) => (current ? { ...current, slug: v } : current))
              setSlugAuto(v === '')
            }}
            onBlur={() => {
              setEditing((current) =>
                current ? { ...current, slug: slugify(current.slug) } : current
              )
            }}
            placeholder="form-slug"
          />
          <p className="text-[11px] text-neutral-low mt-1">
            Defaults to a slug based on the title. Used in URLs and module configuration, e.g.{' '}
            <code>/api/forms/&lt;slug&gt;</code>.
          </p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-medium mb-1">Description</label>
        <Textarea
          value={editing.description || ''}
          onChange={(e) =>
            setEditing((current) =>
              current ? { ...current, description: e.target.value } : current
            )
          }
          rows={3}
          placeholder="Optional description shown above the form."
        />
      </div>

      {/* Success message and thank-you page */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-medium mb-1">
            Success Message
          </label>
          <Textarea
            value={editing.successMessage || ''}
            onChange={(e) =>
              setEditing((current) =>
                current ? { ...current, successMessage: e.target.value } : current
              )
            }
            rows={3}
            placeholder="Message shown after successful submission (if no thank-you page is set)."
          />
        </div>
        <div>
          <ThankYouPagePicker
            value={editing.thankYouPostId || ''}
            onChange={(id: string) =>
              setEditing((current) => (current ? { ...current, thankYouPostId: id } : current))
            }
          />
        </div>
      </div>

      {/* Fields */}
      <div className="border border-line-low rounded-md p-4 space-y-3 bg-backdrop-medium/40">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-neutral-high">Fields</h3>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
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
                  <label className="block text-[11px] font-medium text-neutral-medium mb-1">
                    Slug
                  </label>
                  <Input
                    value={field.slug}
                    onChange={(e) => updateField(idx, { slug: e.target.value })}
                    placeholder="field_slug"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-medium mb-1">
                    Label
                  </label>
                  <Input
                    value={field.label}
                    onChange={(e) => updateField(idx, { label: e.target.value })}
                    placeholder="Field label"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-medium mb-1">
                    Type
                  </label>
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
      <div className="border border-line-low rounded-md p-4 space-y-3 bg-backdrop-medium/40">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-neutral-high">Subscriptions</h3>
          {availableWebhooks.length > 0 && (
            <button
              type="button"
              className="px-2 py-1 text-xs rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
              onClick={addSubscriptionRow}
            >
              Add Webhook
            </button>
          )}
        </div>
        {availableWebhooks.length === 0 ? (
          <p className="text-xs text-neutral-low">
            No webhooks configured yet. Create webhooks under <code>Settings → Webhooks</code>.
          </p>
        ) : (
          <div className="space-y-2">
            {(!editing.subscriptions || editing.subscriptions.length === 0) && (
              <p className="text-xs text-neutral-low">
                No subscriptions configured. Click “Add Webhook” to subscribe this form to one or
                more webhooks.
              </p>
            )}
            {editing.subscriptions?.map((subId, idx) => {
              return (
                <div key={`${subId || 'new'}-${idx}`} className="flex items-center gap-2">
                  <Select
                    value={subId || ''}
                    onValueChange={(val) => updateSubscriptionRow(idx, val)}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Select a webhook" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWebhooks.map((w) => (
                        <SelectItem
                          key={w.id}
                          value={w.id}
                          disabled={!w.events.includes('form.submitted')}
                        >
                          {w.name}
                          {!w.events.includes('form.submitted') && ' (no form.submitted)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs border border-line-medium rounded text-neutral-medium hover:bg-backdrop-medium"
                    onClick={() => removeSubscriptionRow(idx)}
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {availableWebhooks.length > 0 && (
          <p className="text-[11px] text-neutral-low">
            Only webhooks subscribed to the <code>form.submitted</code> event will receive payloads
            when this form is submitted.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded bg-standout-medium text-on-standout disabled:opacity-60"
          onClick={saveForm}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Form'}
        </button>
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded border border-line-low text-neutral-medium"
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
  )
}
