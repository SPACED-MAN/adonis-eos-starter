/**
 * Admin Post Editor
 * 
 * Main editing interface for posts with modules, translations, and metadata.
 */

import { useForm, usePage } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { ModulePicker } from '../../components/modules/ModulePicker'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
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
    reviewProps?: Record<string, any> | null
    overrides: Record<string, any> | null
    reviewOverrides?: Record<string, any> | null
    locked: boolean
    orderIndex: number
  }[]
  translations: { id: string; locale: string }[]
  reviewDraft?: any | null
}

export default function Editor({ post, modules: initialModules, translations, reviewDraft }: EditorProps) {
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
  const initialDataRef = useRef({
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
  const reviewInitialRef = useRef<null | typeof initialDataRef.current>(reviewDraft ? {
    title: String(reviewDraft.title ?? post.title),
    slug: String(reviewDraft.slug ?? post.slug),
    excerpt: String(reviewDraft.excerpt ?? (post.excerpt || '')),
    status: String(reviewDraft.status ?? post.status),
    metaTitle: String(reviewDraft.metaTitle ?? (post.metaTitle || '')),
    metaDescription: String(reviewDraft.metaDescription ?? (post.metaDescription || '')),
    canonicalUrl: String(reviewDraft.canonicalUrl ?? (post.canonicalUrl || '')),
    robotsJson: typeof reviewDraft.robotsJson === 'string' ? reviewDraft.robotsJson : (reviewDraft.robotsJson ? JSON.stringify(reviewDraft.robotsJson, null, 2) : ''),
    jsonldOverrides: typeof reviewDraft.jsonldOverrides === 'string' ? reviewDraft.jsonldOverrides : (reviewDraft.jsonldOverrides ? JSON.stringify(reviewDraft.jsonldOverrides, null, 2) : ''),
  } : null)
  const [viewMode, setViewMode] = useState<'approved' | 'review'>('approved')
  const [pendingModules, setPendingModules] = useState<Record<string, { overrides: Record<string, any> | null; edited: Record<string, any> }>>({})
  const pickForm = (d: typeof data) => ({
    title: d.title,
    slug: d.slug,
    excerpt: d.excerpt,
    status: d.status,
    metaTitle: d.metaTitle,
    metaDescription: d.metaDescription,
    canonicalUrl: d.canonicalUrl,
    robotsJson: d.robotsJson,
    jsonldOverrides: d.jsonldOverrides,
  })
  const isDirty = useMemo(() => {
    try {
      const baseline = viewMode === 'review' && reviewInitialRef.current ? reviewInitialRef.current : initialDataRef.current
      const fieldsChanged = JSON.stringify(pickForm(data)) !== JSON.stringify(baseline)
      const modulesPending = Object.keys(pendingModules).length > 0
      return fieldsChanged || modulesPending
    } catch {
      return true
    }
  }, [data, viewMode, pendingModules])

  // CSRF/XSRF token for fetch requests (prefer cookie value)
  const page = usePage()
  const csrfFromProps: string | undefined = (page.props as any)?.csrf
  const xsrfFromCookie: string | undefined = (() => {
    if (typeof document === 'undefined') return undefined
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : undefined
  })()
  const xsrfToken = xsrfFromCookie ?? csrfFromProps
  const role: string | undefined =
    (page.props as any)?.currentUser?.role ?? (page.props as any)?.auth?.user?.role
  const isAdmin = role === 'admin'
  const [isImportModeOpen, setIsImportModeOpen] = useState(false)
  const [pendingImportJson, setPendingImportJson] = useState<any | null>(null)
  const importFileRef = useRef<HTMLInputElement | null>(null)

  // Modules state (sortable)
  const [modules, setModules] = useState<EditorProps['modules']>(initialModules || [])
  const [pathPattern, setPathPattern] = useState<string | null>(null)
  const [supportedLocales, setSupportedLocales] = useState<string[]>([])
  const [selectedLocale, setSelectedLocale] = useState<string>(post.locale)

  // Keep local state in sync with server props after Inertia navigations
  // Useful after adding modules or reloading the page
  useEffect(() => {
    setModules(initialModules || [])
  }, [initialModules])

  // Load URL pattern for this post type/locale to preview final path
  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const res = await fetch('/api/url-patterns', { credentials: 'same-origin' })
          const json = await res.json().catch(() => ({}))
          const list: Array<{ postType: string; locale: string; pattern: string; isDefault: boolean }> =
            Array.isArray(json?.data) ? json.data : []
          const rec =
            list.find((p) => p.postType === post.type && p.locale === post.locale && p.isDefault) ||
            list.find((p) => p.postType === post.type && p.locale === post.locale) ||
            null
          if (!mounted) return
          setPathPattern(rec?.pattern || '/{locale}/posts/{slug}')
        } catch {
          if (!mounted) return
          setPathPattern('/{locale}/posts/{slug}')
        }
      })()
    return () => {
      mounted = false
    }
  }, [post.type, post.locale])

  // Load supported locales from API (enabled locales)
  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const res = await fetch('/api/locales', { credentials: 'same-origin' })
          const json = await res.json().catch(() => ({}))
          const list: Array<{ code: string; isEnabled: boolean }> = Array.isArray(json?.data) ? json.data : []
          const enabled = list.filter((l) => l.isEnabled).map((l) => l.code)
          if (!mounted) return
          setSupportedLocales(enabled.length ? enabled : ['en'])
        } catch {
          if (!mounted) return
          setSupportedLocales(['en'])
        }
      })()
    return () => {
      mounted = false
    }
  }, [])

  // Switch between Published view and Review view
  useEffect(() => {
    if (viewMode === 'review' && reviewInitialRef.current) {
      // Load review draft into form
      setData({ ...data, ...reviewInitialRef.current })
    }
    if (viewMode === 'approved') {
      // Restore published values
      setData({ ...data, ...initialDataRef.current })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])

  async function saveForReview() {
    const payload = {
      ...pickForm(data),
      mode: 'review',
    }
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast.success('Saved for review')
      reviewInitialRef.current = pickForm(data)
    } else {
      toast.error('Failed to save for review')
    }
  }

  function buildPreviewPath(currentSlug: string): string | null {
    if (!pathPattern) return null
    const d = new Date(post.createdAt)
    const yyyy = String(d.getUTCFullYear())
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    let out = pathPattern
    const encSlug = encodeURIComponent(currentSlug || '')
    out = out.replace(/\{slug\}/g, encSlug).replace(/:slug\b/g, encSlug)
    out = out.replace(/\{locale\}/g, post.locale).replace(/:locale\b/g, post.locale)
    out = out.replace(/\{yyyy\}/g, yyyy).replace(/\{mm\}/g, mm).replace(/\{dd\}/g, dd)
    if (!out.startsWith('/')) out = '/' + out
    return out
  }

  // Overrides panel state
  const [editing, setEditing] = useState<ModuleListItem | null>(null)
  const [savingOverrides, setSavingOverrides] = useState(false)
  const [revisions, setRevisions] = useState<Array<{ id: string; mode: 'approved' | 'review'; createdAt: string; user?: { id?: number; email?: string } }>>([])
  const [loadingRevisions, setLoadingRevisions] = useState(false)

  useEffect(() => {
    let alive = true
    async function loadRevisions() {
      try {
        setLoadingRevisions(true)
        const res = await fetch(`/api/posts/${post.id}/revisions?limit=10`, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        })
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        if (!json?.data) return
        if (alive) setRevisions(json.data)
      } finally {
        if (alive) setLoadingRevisions(false)
      }
    }
    loadRevisions()
    return () => { alive = false }
  }, [post.id])

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
        body: JSON.stringify({ orderIndex: index, mode: viewMode === 'review' ? 'review' : 'publish' }),
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

  const sortedModules = useMemo(() => {
    const base = modules.slice().sort((a, b) => a.orderIndex - b.orderIndex)
    if (viewMode === 'review') {
      return base.map((m) => ({
        ...m,
        props: m.scope === 'post' ? (m.reviewPos ? m.reviewProps ?? m.props : m.props) : m.props,
        overrides: m.scope !== 'post' ? (m.reviewOverrides ?? m.overrides ?? null) : m.overrides,
      }))
    }
    return base
  }, [modules, viewMode])

  const translationMap = useMemo(() => {
    const map = new Map<string, string>()
    translations?.forEach((t) => map.set(t.locale, t.id))
    return map
  }, [translations])
  const translationsSet = useMemo(() => new Set((translations || []).map((t) => t.locale)), [translations])
  const availableLocales = useMemo(() => {
    const base = new Set<string>(supportedLocales.length ? supportedLocales : ['en'])
    translations?.forEach((t) => base.add(t.locale))
    return Array.from(base)
  }, [translations, supportedLocales])

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
        body: JSON.stringify({ overrides, mode: viewMode === 'review' ? 'review' : 'publish' }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const json = await res.json()
      const updatedOverrides = json?.data?.overrides ?? overrides
      setModules((prev) =>
        prev.map((m) => {
          if (m.id !== postModuleId) return m
          if (viewMode === 'review') {
            if (m.scope === 'post') {
              return { ...m, reviewProps: edited, overrides: null }
            } else {
              return { ...m, reviewOverrides: updatedOverrides }
            }
          } else {
            if (m.scope === 'post') {
              return { ...m, props: edited, overrides: null }
            } else {
              return { ...m, overrides: updatedOverrides }
            }
          }
        })
      )
    } finally {
      setSavingOverrides(false)
    }
  }

  async function commitPendingModules(mode: 'review' | 'publish') {
    const entries = Object.entries(pendingModules)
    if (entries.length === 0) return
    const updates = entries.map(([id, payload]) =>
      fetch(`/api/post-modules/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ overrides: payload.overrides, mode }),
      })
    )
    const results = await Promise.allSettled(updates)
    const anyFailed = results.some((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as Response).ok))
    if (anyFailed) {
      toast.error('Failed to save module changes')
      throw new Error('Failed to save module changes')
    }
    setPendingModules({})
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
        <AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Edit Post' }]} rightLink={{ label: '← Back to Dashboard', href: '/admin' }} />
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
                  {pathPattern && (
                    <p className="mt-1 text-xs text-neutral-low font-mono">
                      Preview: {buildPreviewPath(data.slug)}
                    </p>
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

                {/* Status moved to Actions sidebar */}

                {/* Save button moved to Actions */}
              </form>
            </div>

            {/* Modules Section */}
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

            {/* end left column */}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <div className="bg-backdrop-low rounded-lg shadow p-6 border border-border">
              <h3 className="text-sm font-semibold text-neutral-high mb-4">
                Actions
              </h3>
              <div className="space-y-2">
                {/* View toggle */}
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setViewMode('approved')}
                      className={`px-2 py-1 text-xs ${viewMode === 'approved' ? 'bg-backdrop-medium text-neutral-high' : 'text-neutral-medium hover:bg-backdrop-medium'}`}
                    >
                      Approved
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('review')}
                      className={`px-2 py-1 text-xs ${viewMode === 'review' ? 'bg-backdrop-medium text-neutral-high' : 'text-neutral-medium hover:bg-backdrop-medium'}`}
                    >
                      Review
                    </button>
                  </div>
                </div>
                {/* Status (moved here) */}
                <div>
                  <label className="block text-xs font-medium text-neutral-medium mb-1">
                    Status
                  </label>
                  <div className="flex items-center gap-2">
                  <Select defaultValue={data.status} onValueChange={(val) => setData('status', val)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  </div>
                  {errors.status && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.status}</p>
                  )}
                </div>
                {/* Locale Switcher */}
                <div>
                  <label className="block text-xs font-medium text-neutral-medium mb-1">
                    Locale
                  </label>
                  <div className="flex items-center gap-2">
                  <Select
                    defaultValue={selectedLocale}
                    onValueChange={(nextLocale) => {
                      setSelectedLocale(nextLocale)
                      if (nextLocale === post.locale) return
                      const target = translations?.find((t) => t.locale === nextLocale)
                      if (target) {
                        window.location.href = `/admin/posts/${target.id}/edit`
                      }
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLocales.map((loc) => {
                        const exists = translationsSet.has(loc)
                        const label = exists ? `${loc.toUpperCase()}` : `${loc.toUpperCase()} (missing)`
                        return (
                          <SelectItem key={loc} value={loc}>
                            {label}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                    {/* Removed helper text */}
                  </div>
                  {selectedLocale !== post.locale && !translationsSet.has(selectedLocale) && (
                    <button
                      type="button"
                      className="mt-2 text-xs px-2 py-1 rounded border border-border bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
                      onClick={async () => {
                        const toCreate = selectedLocale
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
                  )}
                </div>
                <button
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg hover:bg-backdrop-medium text-neutral-medium"
                  onClick={() => {
                    const target = (post as any).publicPath || `/posts/${post.slug}`
                    window.open(target, '_blank')
                  }}
                  type="button"
                >
                  View on Site
                </button>
                <button
                  className={`w-full px-4 py-2 text-sm rounded-lg disabled:opacity-50 ${(!isDirty || processing) ? 'border border-border text-neutral-medium' : 'bg-standout text-on-standout font-medium'}`}
                  disabled={!isDirty || processing}
                  onClick={async () => {
                    if (viewMode === 'review') {
                      await commitPendingModules('review')
                      await saveForReview()
                    } else {
                      await commitPendingModules('publish')
                      put(`/api/posts/${post.id}`, {
                        preserveScroll: true,
                        onSuccess: () => {
                          toast.success('Changes saved')
                          initialDataRef.current = pickForm(data)
                        },
                        onError: () => toast.error('Failed to save changes'),
                      })
                    }
                  }}
                  type="button"
                >
                  {viewMode === 'review' ? 'Save for Review' : (data.status === 'published' ? 'Publish Changes' : 'Save Changes')}
                </button>
                {reviewInitialRef.current && (
                  <button
                    className="w-full px-4 py-2 text-sm border border-border rounded-lg hover:bg-backdrop-medium text-neutral-medium"
                    onClick={async () => {
                      const res = await fetch(`/api/posts/${post.id}`, {
                        method: 'PUT',
                        headers: {
                          'Accept': 'application/json',
                          'Content-Type': 'application/json',
                          ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({ mode: 'approve' }),
                      })
                      if (res.ok) {
                        toast.success('Review approved')
                        // Adopt the review values as the new approved baseline
                        initialDataRef.current = reviewInitialRef.current
                        reviewInitialRef.current = null
                        setViewMode('approved')
                      } else {
                        toast.error('Failed to approve review')
                      }
                    }}
                    type="button"
                  >
                    Approve Review
                  </button>
                )}
                {/* Unpublish action handled by changing status to draft and saving */}
              </div>
            </div>

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
                    {new Date(post.createdAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-low">Updated</dt>
                  <dd className="font-medium text-neutral-high">
                    {new Date(post.updatedAt).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Revisions */}
            <div className="bg-backdrop-low rounded-lg shadow p-6 border border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-neutral-high">Revisions</h3>
                <button
                  type="button"
                  className="text-xs px-2 py-1 border border-border rounded hover:bg-backdrop-medium text-neutral-medium"
                  onClick={async () => {
                    // reload revisions
                    const res = await fetch(`/api/posts/${post.id}/revisions?limit=10`, {
                      headers: { Accept: 'application/json' },
                      credentials: 'same-origin',
                    })
                    if (res.ok) {
                      const json = await res.json().catch(() => null)
                      if (json?.data) setRevisions(json.data)
                    }
                  }}
                >
                  Refresh
                </button>
              </div>
              {loadingRevisions ? (
                <p className="text-sm text-neutral-low">Loading…</p>
              ) : revisions.length === 0 ? (
                <p className="text-sm text-neutral-low">No revisions yet.</p>
              ) : (
                <ul className="space-y-2">
                  {revisions.map((r) => (
                    <li key={r.id} className="flex items-center justify-between text-sm">
                      <div className="flex flex-col">
                        <span className="text-neutral-high">
                          {new Date(r.createdAt).toLocaleString()}
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] border ${r.mode === 'review' ? 'bg-backdrop-medium text-neutral-high' : 'bg-standout/10 text-standout border-standout/40'}`}>
                            {r.mode === 'review' ? 'Review' : 'Approved'}
                          </span>
                        </span>
                        {r.user?.email ? <span className="text-xs text-neutral-low">{r.user.email}</span> : null}
                      </div>
                      <button
                        className="px-2 py-1 text-xs border border-border rounded hover:bg-backdrop-medium text-neutral-medium"
                        onClick={async () => {
                          if (!confirm('Revert to this revision?')) return
                          const res = await fetch(`/api/posts/${post.id}/revisions/${encodeURIComponent(r.id)}/revert`, {
                            method: 'POST',
                            headers: {
                              Accept: 'application/json',
                              'Content-Type': 'application/json',
                              ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
                            },
                            credentials: 'same-origin',
                          })
                          if (res.ok) {
                            toast.success('Reverted to selected revision')
                            // After revert, reload page data
                            window.location.reload()
                          } else {
                            const j = await res.json().catch(() => null)
                            toast.error(j?.error || 'Failed to revert')
                          }
                        }}
                      >
                        Revert
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Import / Export (Admin only) */}
            {isAdmin && (
              <div className="bg-backdrop-low rounded-lg shadow p-6 border border-border">
                <h3 className="text-sm font-semibold text-neutral-high mb-3">Import / Export</h3>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 text-sm border border-border rounded hover:bg-backdrop-medium text-neutral-high"
                    onClick={() => {
                      const url = `/api/posts/${post.id}/export?download=1`
                      window.open(url, '_blank')
                    }}
                  >
                    Export JSON
                  </button>
                  <div className="flex items-center gap-2">
                    <input
                      ref={importFileRef}
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try {
                          const text = await file.text()
                          const data = JSON.parse(text)
                          setPendingImportJson(data)
                          setIsImportModeOpen(true)
                        } catch {
                          toast.error('Invalid JSON file')
                        } finally {
                          if (importFileRef.current) importFileRef.current.value = ''
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="px-3 py-2 text-sm border border-border rounded hover:bg-backdrop-medium text-neutral-high"
                      onClick={() => importFileRef.current?.click()}
                    >
                      Import JSON
                    </button>
                  </div>
                  <p className="text-xs text-neutral-low">Select a JSON file, then choose how to import.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
      {/* Import Mode Modal (Admin) */}
      {isAdmin && isImportModeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setIsImportModeOpen(false); setPendingImportJson(null) }} />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-line bg-backdrop-low p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-neutral-high">Import JSON</h3>
              <button
                className="text-neutral-medium hover:text-neutral-high"
                onClick={() => { setIsImportModeOpen(false); setPendingImportJson(null) }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-neutral-medium mb-4">
              How would you like to import this JSON into the current post?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="w-full px-3 py-2 text-sm rounded border border-line bg-backdrop-low hover:bg-backdrop-medium text-neutral-high"
                onClick={async () => {
                  if (!pendingImportJson) return
                  const res = await fetch(`/api/posts/${post.id}/import`, {
                    method: 'POST',
                    headers: {
                      Accept: 'application/json',
                      'Content-Type': 'application/json',
                      ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ data: pendingImportJson, mode: 'review' }),
                  })
                  if (res.ok) {
                    toast.success('Imported into review draft')
                    setIsImportModeOpen(false)
                    setPendingImportJson(null)
                    window.location.reload()
                  } else {
                    const j = await res.json().catch(() => null)
                    toast.error(j?.error || 'Import failed')
                  }
                }}
              >
                Import into Review (non-destructive)
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-sm rounded bg-standout text-on-standout hover:opacity-90"
                onClick={async () => {
                  if (!pendingImportJson) return
                  const res = await fetch(`/api/posts/${post.id}/import`, {
                    method: 'POST',
                    headers: {
                      Accept: 'application/json',
                      'Content-Type': 'application/json',
                      ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ data: pendingImportJson, mode: 'replace' }),
                  })
                  if (res.ok) {
                    toast.success('Imported and replaced live content')
                    setIsImportModeOpen(false)
                    setPendingImportJson(null)
                    window.location.reload()
                  } else {
                    const j = await res.json().catch(() => null)
                    toast.error(j?.error || 'Import failed')
                  }
                }}
              >
                Replace Live Content (destructive)
              </button>
            </div>
          </div>
        </div>
      )}
      <ModuleEditorPanel
        open={!!editing}
        moduleItem={editing}
        onClose={() => setEditing(null)}
        onSave={(overrides, edited) => {
          if (!editing) return Promise.resolve()
          // stage changes locally and mark as pending; do NOT persist now
          setPendingModules((prev) => ({ ...prev, [editing.id]: { overrides, edited } }))
          setModules((prev) =>
            prev.map((m) => {
              if (m.id !== editing.id) return m
              if (viewMode === 'review') {
                if (m.scope === 'post') {
                  return { ...m, reviewProps: edited, overrides: null }
                } else {
                  return { ...m, reviewOverrides: overrides }
                }
              } else {
                if (m.scope === 'post') {
                  return { ...m, props: edited, overrides: null }
                } else {
                  return { ...m, overrides }
                }
              }
            })
          )
          return Promise.resolve()
        }}
        processing={savingOverrides}
      />
    </div>
  )
}

