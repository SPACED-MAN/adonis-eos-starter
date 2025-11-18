/**
 * Admin Post Editor
 * 
 * Main editing interface for posts with modules, translations, and metadata.
 */

import { useForm, usePage } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { ModulePicker } from '../../components/modules/ModulePicker'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ModuleEditorPanel, ModuleListItem } from '../../components/modules/ModuleEditorPanel'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface EditorProps {
  post: {
    id: string
    type: string
    slug: string
    title: string
    excerpt: string | null
    status: string
    locale: string
    metaTitle: string | null
    metaDescription: string | null
    canonicalUrl: string | null
    robotsJson: Record<string, any> | null
    jsonldOverrides: Record<string, any> | null
    createdAt: string
    updatedAt: string
  }
  modules: {
    id: string
    type: string
    scope: string
    props: Record<string, any>
    overrides: Record<string, any> | null
    locked: boolean
    orderIndex: number
  }[]
  translations: { id: string; locale: string }[]
}

export default function Editor({ post, modules: initialModules, translations }: EditorProps) {
  const { data, setData, put, processing, errors } = useForm({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt || '',
    status: post.status,
    metaTitle: post.metaTitle || '',
    metaDescription: post.metaDescription || '',
    canonicalUrl: post.canonicalUrl || '',
    robotsJson: post.robotsJson ? JSON.stringify(post.robotsJson, null, 2) : '',
    jsonldOverrides: post.jsonldOverrides ? JSON.stringify(post.jsonldOverrides, null, 2) : '',
  })

  // CSRF/XSRF token for fetch requests (prefer cookie value)
  const page = usePage()
  const csrfFromProps: string | undefined = (page.props as any)?.csrf
  const xsrfFromCookie: string | undefined = (() => {
    if (typeof document === 'undefined') return undefined
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : undefined
  })()
  const xsrfToken = xsrfFromCookie ?? csrfFromProps

  // Modules state (sortable)
  const [modules, setModules] = useState<EditorProps['modules']>(initialModules || [])

  // Keep local state in sync with server props after Inertia navigations
  // Useful after adding modules or reloading the page
  useEffect(() => {
    setModules(initialModules || [])
  }, [initialModules])

  // Overrides panel state
  const [editing, setEditing] = useState<ModuleListItem | null>(null)
  const [savingOverrides, setSavingOverrides] = useState(false)

  // DnD sensors (pointer only to avoid key conflicts)
  const sensors = useSensors(useSensor(PointerSensor))

  function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    }
    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        {children(listeners)}
      </div>
    )
  }

  const orderedIds = useMemo(
    () => modules.slice().sort((a, b) => a.orderIndex - b.orderIndex).map((m) => m.id),
    [modules]
  )

  async function persistOrder(next: EditorProps['modules']) {
    const updates = next.map((m, index) => {
      if (m.orderIndex === index) return Promise.resolve()
      return fetch(`/api/post-modules/${encodeURIComponent(m.id)}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ orderIndex: index }),
      })
    })
    await Promise.allSettled(updates)
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const current = modules.slice().sort((a, b) => a.orderIndex - b.orderIndex)
    const oldIndex = current.findIndex((m) => m.id === active.id)
    const newIndex = current.findIndex((m) => m.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = current.slice()
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    const next = reordered.map((m, idx) => ({ ...m, orderIndex: idx }))
    setModules(next)
    persistOrder(next)
      .then(() => toast.success('Module order updated'))
      .catch(() => toast.error('Failed to save order'))
  }

  const sortedModules = useMemo(
    () => modules.slice().sort((a, b) => a.orderIndex - b.orderIndex),
    [modules]
  )

  const translationMap = useMemo(() => {
    const map = new Map<string, string>()
    translations?.forEach((t) => map.set(t.locale, t.id))
    return map
  }, [translations])
  const availableLocales = useMemo(() => {
    const base = new Set<string>(['en', 'es'])
    translations?.forEach((t) => base.add(t.locale))
    return Array.from(base)
  }, [translations])

  async function saveOverrides(
    postModuleId: string,
    overrides: Record<string, any> | null,
    edited: Record<string, any>
  ) {
    setSavingOverrides(true)
    try {
      const res = await fetch(`/api/post-modules/${encodeURIComponent(postModuleId)}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ overrides }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const json = await res.json()
      const updatedOverrides = json?.data?.overrides ?? overrides
      setModules((prev) =>
        prev.map((m) => {
          if (m.id !== postModuleId) return m
          // If local module, props are the source of truth; clear overrides and update props
          if (m.scope === 'post') {
            return { ...m, props: edited, overrides: null }
          }
          // For global/static, keep overrides
          return { ...m, overrides: updatedOverrides }
        })
      )
    } finally {
      setSavingOverrides(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    put(`/api/posts/${post.id}`, {
      onSuccess: () => {
        toast.success('Post updated successfully')
      },
      onError: (errors) => {
        const firstError = Object.values(errors)[0]
        toast.error(firstError || 'Failed to update post')
      },
    })
  }

  return (
    <div className="min-h-screen bg-backdrop-low">
      <AdminHeader title="Edit Post" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Post Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <div className="bg-backdrop-low rounded-lg shadow p-6 border border-line">
              <h2 className="text-lg font-semibold text-neutral-high mb-4">
                Post Information
              </h2>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={data.title}
                    onChange={(e) => setData('title', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high focus:ring-2 ring-standout"
                    placeholder="Enter post title"
                  />
                  {errors.title && (
                    <p className="text-sm text-[color:#dc2626] mt-1">{errors.title}</p>
                  )}
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Slug *
                  </label>
                  <input
                    type="text"
                    value={data.slug}
                    onChange={(e) => setData('slug', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high font-mono text-sm focus:ring-2 ring-standout"
                    placeholder="post-slug"
                  />
                  {errors.slug && (
                    <p className="text-sm text-[color:#dc2626] mt-1">{errors.slug}</p>
                  )}
                </div>

                {/* Excerpt */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Excerpt
                  </label>
                  <textarea
                    value={data.excerpt}
                    onChange={(e) => setData('excerpt', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high focus:ring-2 ring-standout"
                    placeholder="Brief description (optional)"
                  />
                  {errors.excerpt && (
                    <p className="text-sm text-[color:#dc2626] mt-1">{errors.excerpt}</p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Status *
                  </label>
                  <select
                    value={data.status}
                    onChange={(e) => setData('status', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high focus:ring-2 ring-standout"
                  >
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                  {errors.status && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.status}</p>
                  )}
                </div>

                {/* Save Row */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={processing}
                    className="inline-flex items-center gap-2 rounded-md bg-standout text-on-standout text-sm px-3 py-2 disabled:opacity-50"
                  >
                    {processing ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* SEO Card */}
            <div className="bg-backdrop-low rounded-lg shadow p-6 border border-line">
              <h2 className="text-lg font-semibold text-neutral-high mb-4">
                SEO Settings
              </h2>

              <div className="space-y-4">
                {/* Meta Title */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Meta Title
                  </label>
                  <input
                    type="text"
                    value={data.metaTitle}
                    onChange={(e) => setData('metaTitle', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high focus:ring-2 ring-standout"
                    placeholder="Custom meta title (optional)"
                  />
                  <p className="text-xs text-neutral-low mt-1">
                    Leave blank to use post title
                  </p>
                </div>

                {/* Meta Description */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Meta Description
                  </label>
                  <textarea
                    value={data.metaDescription}
                    onChange={(e) => setData('metaDescription', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high focus:ring-2 ring-standout"
                    placeholder="Custom meta description (optional)"
                  />
                  <p className="text-xs text-neutral-low mt-1">
                    Recommended: 150-160 characters
                  </p>
                </div>

                {/* Canonical URL */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Canonical URL
                  </label>
                  <input
                    type="url"
                    value={data.canonicalUrl}
                    onChange={(e) => setData('canonicalUrl', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high focus:ring-2 ring-standout"
                    placeholder="https://example.com/my-post"
                  />
                </div>

                {/* Robots JSON */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Robots (JSON)
                  </label>
                  <textarea
                    value={data.robotsJson}
                    onChange={(e) => setData('robotsJson', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high font-mono text-xs focus:ring-2 ring-standout"
                    placeholder={JSON.stringify({ index: true, follow: true }, null, 2)}
                  />
                  <p className="text-xs text-neutral-low mt-1">
                    Leave empty for defaults. Must be valid JSON.
                  </p>
                </div>

                {/* JSON-LD Overrides */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    JSON-LD Overrides (JSON)
                  </label>
                  <textarea
                    value={data.jsonldOverrides}
                    onChange={(e) => setData('jsonldOverrides', e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high font-mono text-xs focus:ring-2 ring-standout"
                    placeholder={JSON.stringify({ '@type': 'BlogPosting' }, null, 2)}
                  />
                  <p className="text-xs text-neutral-low mt-1">
                    Leave empty to auto-generate structured data.
                  </p>
                </div>
              </div>
            </div>

            {/* Modules Section (Placeholder) */}
            <div className="bg-backdrop-low rounded-lg shadow p-6 border border-line">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-high">
                  Modules
                </h2>
                <ModulePicker postId={post.id} postType={post.type} />
              </div>
              {modules.length === 0 ? (
                <div className="text-center py-12 text-neutral-low">
                  <p>No modules yet. Use “Add Module” to insert one.</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                    <ul className="space-y-3">
                      {sortedModules.map((m) => (
                        <SortableItem key={m.id} id={m.id}>
                          {(listeners: any) => (
                            <li className="bg-backdrop-low border border-line rounded-lg px-4 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  aria-label="Drag"
                                  className="cursor-grab text-neutral-low hover:text-neutral-high"
                                  {...listeners}
                                >
                                  ⋮⋮
                                </button>
                                <div>
                                  <div className="text-sm font-medium text-neutral-high">{m.type}</div>
                                  <div className="text-xs text-neutral-low">Order: {m.orderIndex}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  className="text-xs px-2 py-1 rounded border border-line bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
                                  onClick={() => setEditing(m)}
                                  type="button"
                                >
                                  Edit
                                </button>
                              </div>
                            </li>
                          )}
                        </SortableItem>
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Post Details */}
            <div className="bg-backdrop-low rounded-lg shadow p-6 border border-border">
              <h3 className="text-sm font-semibold text-neutral-high mb-4">
                Post Details
              </h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-neutral-low">Status</dt>
                  <dd className="font-medium text-neutral-high capitalize">
                    {data.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-low">Type</dt>
                  <dd className="font-medium text-neutral-high">{post.type}</dd>
                </div>
                <div>
                  <dt className="text-neutral-low">Locale</dt>
                  <dd className="font-medium text-neutral-high">{post.locale}</dd>
                </div>
                <div>
                  <dt className="text-neutral-low">ID</dt>
                  <dd className="font-mono text-xs text-neutral-medium break-all">
                    {post.id}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-low">Created</dt>
                  <dd className="font-medium text-neutral-high">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-low">Updated</dt>
                  <dd className="font-medium text-neutral-high">
                    {new Date(post.updatedAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Quick Actions (Placeholder) */}
            <div className="bg-backdrop-low rounded-lg shadow p-6 border border-border">
              <h3 className="text-sm font-semibold text-neutral-high mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                {/* Locale Switcher */}
                <div>
                  <label className="block text-xs font-medium text-neutral-medium mb-1">
                    Locale
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={post.locale}
                      onChange={(e) => {
                        const nextLocale = e.target.value
                        if (nextLocale === post.locale) return
                        // Navigate to existing translation if present
                        const target = translations?.find((t) => t.locale === nextLocale)
                        if (target) {
                          window.location.href = `/admin/posts/${target.id}/edit`
                        }
                      }}
                      className="px-2 py-1 border border-border rounded bg-backdrop-low text-neutral-high"
                    >
                      {(['en', 'es'] as string[])
                        .concat(translations?.map((t) => t.locale) || [])
                        .filter((v, i, arr) => arr.indexOf(v) === i)
                        .map((loc) => (
                          <option key={loc} value={loc}>
                            {loc.toUpperCase()}
                          </option>
                        ))}
                    </select>
                    {!(translations || []).some((t) => t.locale !== post.locale) && (
                      <span className="text-xs text-neutral-low">No other translations</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-xs px-2 py-1 rounded border border-border bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
                    onClick={async () => {
                      // Create the first missing locale (defaults to 'es' if not present)
                      const locales = ['en', 'es']
                      const existing = new Set((translations || []).map((t) => t.locale))
                      const toCreate = locales.find((l) => !existing.has(l) && l !== post.locale) || (post.locale === 'en' ? 'es' : 'en')
                      const res = await fetch(`/api/posts/${post.id}/translations`, {
                        method: 'POST',
                        headers: {
                          Accept: 'application/json',
                          'Content-Type': 'application/json',
                          ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({ locale: toCreate }),
                      })
                      if (res.redirected) {
                        window.location.href = res.url
                        return
                      }
                      if (res.ok) {
                        window.location.reload()
                      } else {
                        toast.error('Failed to create translation')
                      }
                    }}
                  >
                    Create Translation
                  </button>
                </div>
                <button
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg hover:bg-backdrop-medium text-neutral-medium"
                  onClick={() => {
                    window.open(`/posts/${post.slug}?locale=${encodeURIComponent(post.locale)}`, '_blank')
                  }}
                  type="button"
                >
                  View on Site
                </button>
                <button
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg hover:bg-backdrop-medium text-neutral-medium"
                  onClick={() => {
                    setData('status', 'published')
                    put(`/api/posts/${post.id}`, {
                      preserveScroll: true,
                      onSuccess: () => toast.success('Post published'),
                      onError: () => toast.error('Failed to publish'),
                    })
                  }}
                  type="button"
                >
                  Publish
                </button>
                {post.status === 'published' && (
                  <button
                    className="w-full px-4 py-2 text-sm border border-border rounded-lg hover:bg-backdrop-medium text-neutral-medium"
                    onClick={() => {
                      setData('status', 'draft')
                      put(`/api/posts/${post.id}`, {
                        preserveScroll: true,
                        onSuccess: () => toast.success('Post moved to draft'),
                        onError: () => toast.error('Failed to update status'),
                      })
                    }}
                    type="button"
                  >
                    Unpublish (Move to Draft)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
      <ModuleEditorPanel
        open={!!editing}
        moduleItem={editing}
        onClose={() => setEditing(null)}
        onSave={(overrides, edited) =>
          editing ? saveOverrides(editing.id, overrides, edited) : Promise.resolve()
        }
        processing={savingOverrides}
      />
    </div>
  )
}

