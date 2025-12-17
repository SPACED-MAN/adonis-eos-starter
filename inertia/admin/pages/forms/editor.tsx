import { useEffect, useMemo, useState } from 'react'
import { Head, Link, router } from '@inertiajs/react'
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

type FormFieldType = 'text' | 'email' | 'textarea' | 'checkbox'

interface FormField {
  /**
   * UI-only stable identifier used for React keys. Never persisted.
   */
  uiId?: string
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

interface FormsEditorProps {
  form: FormDefinition | null
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

function makeUiId(): string {
  // Prefer crypto UUID when available, fallback to a reasonably-unique string.
  const c: any = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined
  const uuid = c?.randomUUID ? c.randomUUID() : null
  return uuid || `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function ensureFormUiIds(form: FormDefinition): FormDefinition {
  const rawFields: any[] = Array.isArray((form as any).fields)
    ? ((form as any).fields as any[])
    : typeof (form as any).fields === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse((form as any).fields)
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        })()
      : []

  const nextFields = rawFields.map((raw: any) => {
    const f = raw && typeof raw === 'object' ? (raw as FormField) : ({} as FormField)
    return {
      uiId: f.uiId || makeUiId(),
      slug: String((f as any).slug || ''),
      label: String((f as any).label || ''),
      type:
        (f as any).type === 'text' ||
        (f as any).type === 'email' ||
        (f as any).type === 'textarea' ||
        (f as any).type === 'checkbox'
          ? ((f as any).type as FormFieldType)
          : 'text',
      required: !!(f as any).required,
    } satisfies FormField
  })
  return { ...form, fields: nextFields }
}

export default function FormsEditor({ form }: FormsEditorProps) {
  const isNew = !form
  const [creating, setCreating] = useState<boolean>(isNew)
  const [saving, setSaving] = useState(false)
  const [slugAuto, setSlugAuto] = useState<boolean>(true)
  const [editing, setEditing] = useState<FormDefinition>(() => {
    if (form) return ensureFormUiIds(form)
    return {
      id: '__NEW__',
      slug: '',
      title: '',
      description: '',
      fields: [
        { uiId: makeUiId(), slug: 'name', label: 'Your Name', type: 'text', required: true },
        { uiId: makeUiId(), slug: 'email', label: 'Your Email', type: 'email', required: true },
        { uiId: makeUiId(), slug: 'message', label: 'Your Message', type: 'textarea', required: true },
      ],
      subscriptions: [],
      successMessage: 'Thanks! Your message has been sent.',
      thankYouPostId: '',
      createdAt: null,
      updatedAt: null,
    }
  })

  const [availableWebhooks, setAvailableWebhooks] = useState<
    Array<{ id: string; name: string; events: string[] }>
  >([])

  useEffect(() => {
    // slugAuto defaults: if editing existing form and slug == slugify(title), keep auto mode
    if (!isNew) {
      const s = String(form?.slug || '').trim()
      const t = String(form?.title || '').trim()
      setSlugAuto(!s || slugify(t) === s)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/webhooks', { credentials: 'same-origin' })
        if (!res.ok) {
          if (alive) setAvailableWebhooks([])
          return
        }
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
        if (alive) setAvailableWebhooks([])
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  function updateField(index: number, patch: Partial<FormField>) {
    const nextFields = editing.fields.slice()
    const current = nextFields[index]
    if (!current) return
    nextFields[index] = { ...current, ...patch }
    setEditing({ ...editing, fields: nextFields })
  }

  function addField() {
    const next: FormField = {
      uiId: makeUiId(),
      slug: `field_${editing.fields.length + 1}`,
      label: 'New field',
      type: 'text',
      required: false,
    }
    setEditing({ ...editing, fields: [...editing.fields, next] })
  }

  function removeField(index: number) {
    const next = editing.fields.slice()
    next.splice(index, 1)
    setEditing({ ...editing, fields: next })
  }

  function addSubscriptionRow() {
    const next = Array.isArray(editing.subscriptions) ? editing.subscriptions.slice() : []
    next.push('')
    setEditing({ ...editing, subscriptions: next })
  }

  function updateSubscriptionRow(index: number, value: string) {
    const next = Array.isArray(editing.subscriptions) ? editing.subscriptions.slice() : []
    if (index < 0 || index >= next.length) return
    next[index] = value
    setEditing({ ...editing, subscriptions: next })
  }

  function removeSubscriptionRow(index: number) {
    const next = Array.isArray(editing.subscriptions) ? editing.subscriptions.slice() : []
    if (index < 0 || index >= next.length) return
    next.splice(index, 1)
    setEditing({ ...editing, subscriptions: next })
  }

  async function saveForm() {
    const isCreating = creating || editing.id === '__NEW__'
    const url = isCreating ? '/api/forms-definitions' : `/api/forms-definitions/${encodeURIComponent(editing.id)}`
    const method = isCreating ? 'POST' : 'PUT'
    try {
      setSaving(true)
      const payloadBody = {
        slug: editing.slug,
        title: editing.title,
        description: editing.description,
        fields: editing.fields.map((f) => ({
          slug: f.slug,
          label: f.label,
          type: f.type,
          required: !!f.required,
        })),
        subscriptions: editing.subscriptions,
        successMessage: editing.successMessage,
        thankYouPostId: editing.thankYouPostId || null,
      }

      const res = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify(payloadBody),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(j?.error || 'Failed to save form')
        return
      }
      const saved = j?.data ? ensureFormUiIds(j.data as any) : null
      if (!saved) {
        toast.error('Unexpected response while saving form')
        return
      }

      toast.success('Form saved')

      if (isCreating) {
        setCreating(false)
        router.visit(`/admin/forms/${encodeURIComponent(saved.id)}/edit`)
        return
      }

      setEditing(saved)
    } finally {
      setSaving(false)
    }
  }

  async function deleteForm() {
    if (creating || editing.id === '__NEW__') return
    if (!window.confirm('Delete this form? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/forms-definitions/${encodeURIComponent(editing.id)}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
      })
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to delete form')
        return
      }
      toast.success('Form deleted')
      router.visit('/admin/forms')
    } catch {
      toast.error('Failed to delete form')
    }
  }

  const pageTitle = useMemo(() => {
    if (creating || editing.id === '__NEW__') return 'New Form'
    return editing.title ? `Form: ${editing.title}` : `Form: /${editing.slug}`
  }, [creating, editing.id, editing.slug, editing.title])

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title={creating ? 'New Form' : `Edit Form`} />
      <AdminHeader title="Forms" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-neutral-low">
              <Link href="/admin/forms" className="hover:underline">
                Forms
              </Link>{' '}
              <span className="mx-1">/</span>
              <span className="text-neutral-medium">{creating ? 'New' : 'Edit'}</span>
            </div>
            <h2 className="text-lg font-semibold text-neutral-high">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/forms"
              className="px-3 py-2 text-sm rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
            >
              Back
            </Link>
            {!creating && editing.id !== '__NEW__' && (
              <Link
                href="/admin/forms"
                className="px-3 py-2 text-sm rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
              >
                Done
              </Link>
            )}
          </div>
        </div>

        <div className="bg-backdrop-low border border-line-low rounded-lg p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-1">Title</label>
                <Input
                  value={editing.title}
                  onChange={(e) => {
                    const val = e.target.value
                    setEditing((current) => ({
                      ...current,
                      title: val,
                      slug: slugAuto ? slugify(val) : current.slug,
                    }))
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
                    setEditing((current) => ({ ...current, slug: v }))
                    setSlugAuto(v === '')
                  }}
                  onBlur={() => setEditing((current) => ({ ...current, slug: slugify(current.slug) }))}
                  placeholder="form-slug"
                />
                <p className="text-[11px] text-neutral-low mt-1">
                  Used in URLs and module configuration, e.g. <code>/api/forms/&lt;slug&gt;</code>.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-medium mb-1">Description</label>
              <Textarea
                value={editing.description || ''}
                onChange={(e) => setEditing((current) => ({ ...current, description: e.target.value }))}
                rows={3}
                placeholder="Optional description shown above the form."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-1">Success Message</label>
                <Textarea
                  value={editing.successMessage || ''}
                  onChange={(e) => setEditing((current) => ({ ...current, successMessage: e.target.value }))}
                  rows={3}
                  placeholder="Message shown after successful submission (if no thank-you page is set)."
                />
              </div>
              <div>
                <ThankYouPagePicker
                  value={editing.thankYouPostId || ''}
                  onChange={(id: string) => setEditing((current) => ({ ...current, thankYouPostId: id }))}
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
                    <div key={field.uiId || `${idx}`}>
                      {idx > 0 && <hr className="my-3 border-line-low" />}
                      <div className="grid grid-cols-1 md:grid-cols-[1.2fr,1.2fr,0.9fr,auto] gap-2 items-start">
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
                      No subscriptions configured. Click “Add Webhook” to subscribe this form to one or more webhooks.
                    </p>
                  )}
                  {editing.subscriptions?.map((subId, idx) => (
                    <div key={`${subId || 'new'}-${idx}`} className="flex items-center gap-2">
                      <Select value={subId || ''} onValueChange={(val) => updateSubscriptionRow(idx, val)}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Select a webhook" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableWebhooks.map((w) => (
                            <SelectItem key={w.id} value={w.id} disabled={!w.events.includes('form.submitted')}>
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
                  ))}
                </div>
              )}
              {availableWebhooks.length > 0 && (
                <p className="text-[11px] text-neutral-low">
                  Only webhooks subscribed to the <code>form.submitted</code> event will receive payloads when this form is submitted.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded bg-standout-medium text-on-standout disabled:opacity-60"
                onClick={saveForm}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Form'}
              </button>
              <Link
                href="/admin/forms"
                className="px-3 py-2 text-sm rounded border border-line-low text-neutral-medium hover:bg-backdrop-medium"
              >
                Cancel
              </Link>
              {!creating && editing.id !== '__NEW__' && (
                <button
                  type="button"
                  className="ml-auto px-3 py-2 text-sm rounded border border-danger text-danger hover:bg-danger/10"
                  onClick={deleteForm}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}


