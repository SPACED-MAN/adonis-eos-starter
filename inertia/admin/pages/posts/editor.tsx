/**
 * Admin Post Editor
 * 
 * Main editing interface for posts with modules, translations, and metadata.
 */

import { useForm, usePage } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Badge } from '~/components/ui/badge'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { ModulePicker } from '../../components/modules/ModulePicker'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { humanizeSlug } from '~/utils/strings'
import type { CustomFieldType } from '~/types/custom_field'
import { ModuleEditorPanel, ModuleListItem } from '../../components/modules/ModuleEditorPanel'
import { MediaPickerModal } from '../../components/media/MediaPickerModal'
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover'
import { Calendar } from '~/components/ui/calendar'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Globe } from 'lucide-react'
import { getXsrf } from '~/utils/xsrf'

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
    author?: { id: number; email: string; fullName: string | null } | null
  }
  modules: {
    id: string
    type: string
    scope: string
    props: Record<string, any>
    reviewProps?: Record<string, any> | null
    overrides: Record<string, any> | null
    reviewOverrides?: Record<string, any> | null
    reviewAdded?: boolean
    reviewDeleted?: boolean
    locked: boolean
    orderIndex: number
  }[]
  translations: { id: string; locale: string }[]
  reviewDraft?: any | null
  customFields?: Array<{
    id: string
    slug: string
    label: string
    fieldType: CustomFieldType
    config?: Record<string, any>
    translatable?: boolean
    value?: any
  }>
  uiConfig?: {
    hideCoreFields?: string[]
    hierarchyEnabled?: boolean
    permalinksEnabled?: boolean
  }
}

export default function Editor({ post, modules: initialModules, translations, reviewDraft, customFields: initialCustomFields, uiConfig }: EditorProps) {
  const { data, setData, put, processing, errors } = useForm({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt || '',
    status: post.status,
    parentId: (post as any).parentId || '',
    orderIndex: (post as any).orderIndex ?? 0,
    metaTitle: post.metaTitle || '',
    metaDescription: post.metaDescription || '',
    canonicalUrl: post.canonicalUrl || '',
    robotsJson: post.robotsJson ? JSON.stringify(post.robotsJson, null, 2) : '',
    jsonldOverrides: post.jsonldOverrides ? JSON.stringify(post.jsonldOverrides, null, 2) : '',
    customFields: Array.isArray(initialCustomFields)
      ? initialCustomFields.map((f) => ({ fieldId: f.id, slug: f.slug, value: f.value ?? null }))
      : [],
  })
  const initialDataRef = useRef({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt || '',
    status: post.status,
    parentId: (post as any).parentId || '',
    orderIndex: (post as any).orderIndex ?? 0,
    metaTitle: post.metaTitle || '',
    metaDescription: post.metaDescription || '',
    canonicalUrl: post.canonicalUrl || '',
    robotsJson: post.robotsJson ? JSON.stringify(post.robotsJson, null, 2) : '',
    jsonldOverrides: post.jsonldOverrides ? JSON.stringify(post.jsonldOverrides, null, 2) : '',
    customFields: Array.isArray(initialCustomFields)
      ? initialCustomFields.map((f) => ({ fieldId: f.id, slug: f.slug, value: f.value ?? null }))
      : [],
  })
  const reviewInitialRef = useRef<null | typeof initialDataRef.current>(reviewDraft ? {
    title: String(reviewDraft.title ?? post.title),
    slug: String(reviewDraft.slug ?? post.slug),
    excerpt: String(reviewDraft.excerpt ?? (post.excerpt || '')),
    status: String(reviewDraft.status ?? post.status),
    parentId: String((reviewDraft.parentId ?? (post as any).parentId ?? '') || ''),
    orderIndex: Number(reviewDraft.orderIndex ?? ((post as any).orderIndex ?? 0)),
    metaTitle: String(reviewDraft.metaTitle ?? (post.metaTitle || '')),
    metaDescription: String(reviewDraft.metaDescription ?? (post.metaDescription || '')),
    canonicalUrl: String(reviewDraft.canonicalUrl ?? (post.canonicalUrl || '')),
    robotsJson: typeof reviewDraft.robotsJson === 'string' ? reviewDraft.robotsJson : (reviewDraft.robotsJson ? JSON.stringify(reviewDraft.robotsJson, null, 2) : ''),
    jsonldOverrides: typeof reviewDraft.jsonldOverrides === 'string' ? reviewDraft.jsonldOverrides : (reviewDraft.jsonldOverrides ? JSON.stringify(reviewDraft.jsonldOverrides, null, 2) : ''),
    customFields: Array.isArray(reviewDraft.customFields) ? reviewDraft.customFields : ((Array.isArray(initialCustomFields) ? initialCustomFields.map(f => ({ fieldId: f.id, slug: f.slug, value: f.value ?? null })) : [])),
  } : null)
  const [viewMode, setViewMode] = useState<'approved' | 'review'>('approved')
  const [pendingModules, setPendingModules] = useState<Record<string, { overrides: Record<string, any> | null; edited: Record<string, any> }>>({})
  const [pendingRemoved, setPendingRemoved] = useState<Set<string>>(new Set())
  const [pendingReviewRemoved, setPendingReviewRemoved] = useState<Set<string>>(new Set())
  const pickForm = (d: typeof data) => ({
    title: d.title,
    slug: d.slug,
    excerpt: d.excerpt,
    status: d.status,
    parentId: (d as any).parentId,
    orderIndex: d.orderIndex,
    metaTitle: d.metaTitle,
    metaDescription: d.metaDescription,
    canonicalUrl: d.canonicalUrl,
    robotsJson: d.robotsJson,
    jsonldOverrides: d.jsonldOverrides,
    customFields: Array.isArray((d as any).customFields)
      ? (d as any).customFields.map((e: any) => ({ fieldId: e.fieldId, slug: e.slug, value: e.value }))
      : [],
  })
  const isDirty = useMemo(() => {
    try {
      const baseline = viewMode === 'review' && reviewInitialRef.current ? reviewInitialRef.current : initialDataRef.current
      const fieldsChanged = JSON.stringify(pickForm(data)) !== JSON.stringify(baseline)
      const modulesPending = Object.keys(pendingModules).length > 0
      const removalsPendingApproved = pendingRemoved.size > 0
      const removalsPendingReview = pendingReviewRemoved.size > 0
      return fieldsChanged || modulesPending || removalsPendingApproved || removalsPendingReview
    } catch {
      return true
    }
  }, [data, viewMode, pendingModules, pendingRemoved, pendingReviewRemoved])

  // CSRF/XSRF token for fetch requests (prefer cookie value)
  const page = usePage()
  const csrfFromProps: string | undefined = (page.props as any)?.csrf
  const xsrfFromCookie: string | undefined = (() => {
    try {
      const { getXsrf } = require('~/utils/xsrf')
      return getXsrf()
    } catch {
      return undefined
    }
  })()
  // Always read latest token to avoid stale value after a request rotates it
  const xsrfHeader = () => {
    try {
      const live = getXsrf()
      const token = live ?? csrfFromProps
      return token ? { 'X-XSRF-TOKEN': token } as Record<string, string> : {}
    } catch {
      return csrfFromProps ? { 'X-XSRF-TOKEN': csrfFromProps } : {}
    }
  }
  const role: string | undefined =
    (page.props as any)?.currentUser?.role ?? (page.props as any)?.auth?.user?.role
  const isAdmin = role === 'admin'
  const [isImportModeOpen, setIsImportModeOpen] = useState(false)
  const [pendingImportJson, setPendingImportJson] = useState<any | null>(null)
  const importFileRef = useRef<HTMLInputElement | null>(null)
  function slugify(input: string): string {
    return String(input || '')
      .toLowerCase()
      .trim()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
  const [slugAuto, setSlugAuto] = useState<boolean>(() => {
    const s = String((post as any).slug || '').trim()
    const t = String((post as any).title || '').trim()
    if (!s) return true
    if (/^untitled(-[a-z0-9]+)*(-\d+)?$/i.test(s)) return true
    return slugify(t) === s
  })

  // Modules state (sortable)
  const [modules, setModules] = useState<EditorProps['modules']>(initialModules || [])
  const [pathPattern, setPathPattern] = useState<string | null>(null)
  const [supportedLocales, setSupportedLocales] = useState<string[]>([])
  const [selectedLocale, setSelectedLocale] = useState<string>(post.locale)
  const [moduleRegistry, setModuleRegistry] = useState<Record<string, { name: string; description?: string }>>({})
  const [globalSlugToLabel, setGlobalSlugToLabel] = useState<Map<string, string>>(new Map())

  // Keep local state in sync with server props after Inertia navigations
  // Useful after adding modules or reloading the page
  useEffect(() => {
    setModules(initialModules || [])
  }, [initialModules])

  // Load module registry for display names
  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const res = await fetch(`/api/modules/registry?post_type=${encodeURIComponent(post.type)}`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
          })
          const json = await res.json().catch(() => null)
          const list: Array<{ type: string; name?: string; description?: string }> = Array.isArray(json?.data)
            ? json.data
            : []
          if (!cancelled) {
            const map: Record<string, { name: string; description?: string }> = {}
            list.forEach((m) => {
              map[m.type] = { name: m.name || m.type, description: m.description }
            })
            setModuleRegistry(map)
          }
          // Load globals for slug->label mapping
          try {
            const gRes = await fetch('/api/modules/global', { credentials: 'same-origin' })
            const gJson = await gRes.json().catch(() => ({}))
            const gList: Array<{ globalSlug: string; label?: string | null }> = Array.isArray(gJson?.data) ? gJson.data : []
            const gMap = new Map<string, string>()
            gList.forEach((g) => {
              if (g.globalSlug) gMap.set(g.globalSlug, (g as any).label || g.globalSlug)
            })
            if (!cancelled) setGlobalSlugToLabel(gMap)
          } catch { /* ignore */ }
        } catch {
          if (!cancelled) setModuleRegistry({})
        }
      })()
    return () => {
      cancelled = true
    }
  }, [post.type])

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
      customFields: Array.isArray((data as any).customFields) ? (data as any).customFields : [],
      reviewModuleRemovals: Array.from(pendingReviewRemoved),
    }
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PUT',
        headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
          ...xsrfHeader(),
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast.success('Saved for review')
      reviewInitialRef.current = pickForm(data)
      setPendingReviewRemoved(new Set())
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
  // Removed explicit savingOverrides state; handled via pendingModules flow
  const [revisions, setRevisions] = useState<Array<{ id: string; mode: 'approved' | 'review'; createdAt: string; user?: { id?: number; email?: string } }>>([])
  const [loadingRevisions, setLoadingRevisions] = useState(false)
  // Agents
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [runningAgent, setRunningAgent] = useState<boolean>(false)
  // Author management (admin)
  const [users, setUsers] = useState<Array<{ id: number; email: string; fullName: string | null }>>([])
  const [selectedAuthorId, setSelectedAuthorId] = useState<number | null>(post.author?.id ?? null)
  // Media picker for custom fields
  const [openMediaForField, setOpenMediaForField] = useState<string | null>(null)
  // Debug removed

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

  // Load agents
  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const res = await fetch('/api/agents', { credentials: 'same-origin' })
          const json = await res.json().catch(() => ({}))
          const list: Array<{ id: string; name: string }> = Array.isArray(json?.data) ? json.data : []
          if (alive) setAgents(list)
        } catch {
          if (alive) setAgents([])
        }
      })()
    return () => { alive = false }
  }, [])

  // DnD sensors (pointer only to avoid key conflicts)
  const sensors = useSensors(useSensor(PointerSensor))

  function SortableItem({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode | ((listeners: any, attributes: any) => React.ReactNode) }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled: !!disabled })
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    }
    return (
      <div ref={setNodeRef} style={style} {...(disabled ? {} : attributes)}>
        {typeof children === 'function' ? (children(disabled ? {} : listeners, disabled ? {} : attributes)) : children}
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
          ...xsrfHeader(),
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
    // Prevent dragging locked modules
    const dragged = current.find((m) => m.id === active.id)
    if (dragged?.locked) return
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
    const baseAll = modules.slice().sort((a, b) => a.orderIndex - b.orderIndex)
    if (viewMode === 'review') {
      const base = baseAll
        .filter((m) => !pendingReviewRemoved.has(m.id))
        .filter((m) => !m.reviewDeleted)
      return base.map((m) => ({
        ...m,
        props: m.scope === 'post' ? (m.reviewProps ?? m.props) : m.props,
        overrides: m.scope !== 'post' ? (m.reviewOverrides ?? m.overrides ?? null) : m.overrides,
      }))
    }
    // Approved view: hide review-added modules
    const base = baseAll.filter((m) => !m.reviewAdded)
    return base
  }, [modules, viewMode, pendingReviewRemoved])

  const translationsSet = useMemo(() => new Set((translations || []).map((t) => t.locale)), [translations])
  const availableLocales = useMemo(() => {
    const base = new Set<string>(supportedLocales.length ? supportedLocales : ['en'])
    translations?.forEach((t) => base.add(t.locale))
    return Array.from(base)
  }, [translations, supportedLocales])

  // saveOverrides removed; overrides are handled via ModuleEditorPanel onSave and pendingModules batching.

  async function commitPendingModules(mode: 'review' | 'publish') {
    const entries = Object.entries(pendingModules)
    // 1) Apply updates
    if (entries.length > 0) {
      const updates = entries.map(([id, payload]) => {
        const url = `/api/post-modules/${encodeURIComponent(id)}`
        return fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...xsrfHeader(),
          },
          credentials: 'same-origin',
          body: JSON.stringify({ overrides: payload.overrides, mode }),
        })
      })
      const results = await Promise.allSettled(updates)
      const anyFailed = results.some((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as Response).ok))
      if (anyFailed) {
        toast.error('Failed to save module changes')
        throw new Error('Failed to save module changes')
      }
      setPendingModules({})
    }
    // 2) Apply removals
    if (pendingRemoved.size > 0) {
      const deletes = Array.from(pendingRemoved).map((id) =>
        fetch(`/api/post-modules/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: {
            ...xsrfHeader(),
          },
        })
      )
      await Promise.allSettled(deletes)
      setPendingRemoved(new Set())
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    put(`/api/posts/${post.id}`, {
      headers: xsrfHeader(),
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
      <AdminHeader title={`Edit ${post.type ? humanizeSlug(post.type) : 'Post'}`} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminBreadcrumbs
          items={[
            { label: 'Dashboard', href: '/admin' },
            { label: `Edit ${post.type ? humanizeSlug(post.type) : 'Post'}` },
          ]}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Post Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Content Card */}
            <div className="bg-backdrop-low rounded-lg shadow p-6 border border-line">
              <h2 className="text-lg font-semibold text-neutral-high mb-4">
                Content
              </h2>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Title */}
                {(uiConfig?.hideCoreFields || []).includes('title') ? null : (
                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-1">
                      Title *
                    </label>
                    <Input
                      type="text"
                      value={data.title}
                      onChange={(e) => {
                        const val = e.target.value
                        setData('title', val)
                        // Auto-suggest slug while slug is marked auto-generated
                        if (slugAuto) {
                          setData('slug', slugify(val))
                        }
                      }}
                      placeholder="Enter post title"
                    />
                    {errors.title && (
                      <p className="text-sm text-[#dc2626] mt-1">{errors.title}</p>
                    )}
                  </div>
                )}

                {/* Excerpt */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Excerpt
                  </label>
                  <Textarea
                    value={data.excerpt}
                    onChange={(e) => setData('excerpt', e.target.value)}
                    rows={3}
                    placeholder="Brief description (optional)"
                  />
                  {errors.excerpt && (
                    <p className="text-sm text-[#dc2626] mt-1">{errors.excerpt}</p>
                  )}
                </div>

                {/* Parent (optional hierarchy) */}
                {(uiConfig?.hierarchyEnabled ?? true) && (
                  <ParentSelect
                    postId={post.id}
                    postType={post.type}
                    locale={post.locale}
                    value={data.parentId || ''}
                    onChange={(val) => setData('parentId', val)}
                  />
                )}
                {/* Order Index */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">Order</label>
                  <Input
                    type="number"
                    value={typeof data.orderIndex === 'number' ? data.orderIndex : Number(data.orderIndex || 0)}
                    onChange={(e) => setData('orderIndex', Number(e.target.value) || 0)}
                    min={0}
                    className="w-32"
                  />
                </div>

                {/* Save button moved to Actions */}
              </form>
              {/* Custom Fields (e.g., Profile fields) - inside Content, above Modules */}
              {Array.isArray(initialCustomFields) && initialCustomFields.length > 0 && (
                <div className="mt-6">
                  <div className="space-y-4">
                    {initialCustomFields.map((f) => {
                      const entry = (data as any).customFields?.find((e: any) => e.fieldId === f.id) || { value: null }
                      const setValue = (val: any) => {
                        const prev: any[] = Array.isArray((data as any).customFields) ? (data as any).customFields : []
                        const list = prev.slice()
                        const idx = list.findIndex((e) => e.fieldId === f.id)
                        const next = { fieldId: f.id, slug: f.slug, value: val }
                        if (idx >= 0) list[idx] = next
                        else list.push(next)
                        setData('customFields', list as any)
                      }
                      if (f.fieldType === 'text' || f.fieldType === 'url' || f.fieldType === 'number') {
                        return (
                          <div key={f.id}>
                            <label className="block text-sm font-medium text-neutral-medium mb-1">
                              {f.label}
                            </label>
                            <Input
                              type={f.fieldType === 'number' ? 'number' : (f.fieldType === 'url' ? 'url' : 'text')}
                              value={entry.value ?? ''}
                              onChange={(e) => setValue(f.fieldType === 'number' ? Number(e.target.value) : e.target.value)}
                              placeholder={f.label}
                            />
                          </div>
                        )
                      }
                      if (f.fieldType === 'textarea') {
                        return (
                          <div key={f.id}>
                            <label className="block text-sm font-medium text-neutral-medium mb-1">
                              {f.label}
                            </label>
                            <Textarea
                              value={entry.value ?? ''}
                              onChange={(e) => setValue(e.target.value)}
                              rows={4}
                              placeholder={f.label}
                            />
                          </div>
                        )
                      }
                      if (f.fieldType === 'media') {
                        const currentId: string | null =
                          typeof entry.value === 'string'
                            ? (entry.value || null)
                            : (entry.value?.id ? String(entry.value.id) : null)
                        const currentUrl: string | null =
                          typeof entry.value === 'object' && entry.value?.url
                            ? String(entry.value.url)
                            : null
                        return (
                          <div key={f.id}>
                            <label className="block text-sm font-medium text-neutral-medium mb-1">
                              {f.label}
                            </label>
                            <MediaThumb
                              mediaId={currentId}
                              mediaUrl={currentUrl}
                              onChange={() => setOpenMediaForField(f.id)}
                              onClear={() => setValue(null)}
                            />
                            <MediaPickerModal
                              open={openMediaForField === f.id}
                              onOpenChange={(o) => setOpenMediaForField(o ? f.id : null)}
                              initialSelectedId={currentId || undefined}
                              onSelect={(m) => {
                                setValue({ id: m.id, url: m.url })
                                setOpenMediaForField(null)
                              }}
                            />
                          </div>
                        )
                      }
                      // Fallback simple input
                      return (
                        <div key={f.id}>
                          <label className="block text-sm font-medium text-neutral-medium mb-1">
                            {f.label}
                          </label>
                          <Input
                            value={entry.value ?? ''}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={f.label}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Modules integrated into Content */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-neutral-high">
                    Modules
                  </h3>
                  <ModulePicker postId={post.id} postType={post.type} mode={viewMode === 'review' ? 'review' : 'publish'} />
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
                          <SortableItem key={m.id} id={m.id} disabled={m.locked}>
                            {(listeners: any) => (
                              <li className="bg-backdrop-low border border-line rounded-lg px-4 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    aria-label="Drag"
                                    className={`text-neutral-low hover:text-neutral-high ${m.locked ? 'opacity-40 cursor-not-allowed' : 'cursor-grab'}`}
                                    {...(m.locked ? {} : listeners)}
                                  >
                                    <GripVertical size={16} />
                                  </button>
                                  <div>
                                    <div className="text-sm font-medium text-neutral-high">
                                      {m.scope === 'global'
                                        ? (globalSlugToLabel.get(String((m as any).globalSlug || '')) || (m as any).globalLabel || (m as any).globalSlug || (moduleRegistry[m.type]?.name || m.type))
                                        : (moduleRegistry[m.type]?.name || m.type)}
                                    </div>
                                    <div className="text-xs text-neutral-low">Order: {m.orderIndex}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {m.scope === 'global'
                                    ? (
                                      <span
                                        className="inline-flex items-center rounded border border-line bg-backdrop-low px-2 py-1 text-xs text-neutral-high"
                                        title="Global module"
                                        aria-label="Global module"
                                      >
                                        <Globe size={14} />
                                      </span>
                                    )
                                    : (
                                      <button
                                        className="text-xs px-2 py-1 rounded border border-line bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
                                        onClick={() => setEditing(m)}
                                        type="button"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  <button
                                    className="text-xs px-2 py-1 rounded border border-[#ef4444] text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)]"
                                    onClick={async () => {
                                      // Mark for removal in appropriate mode; actual apply on save
                                      if (viewMode === 'review') {
                                        setPendingReviewRemoved((prev) => {
                                          const next = new Set(prev)
                                          next.add(m.id)
                                          return next
                                        })
                                      } else {
                                        setPendingRemoved((prev) => {
                                          const next = new Set(prev)
                                          next.add(m.id)
                                          return next
                                        })
                                        // For approved mode, optimistically remove from UI
                                        setModules((prev) => prev.filter((pm) => pm.id !== m.id))
                                      }
                                      toast.success('Module marked for removal (apply by saving)')
                                    }}
                                    type="button"
                                  >
                                    Remove
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

            {/* SEO Card */}
            <div className="bg-backdrop-low rounded-lg shadow p-6 border border-line">
              <h2 className="text-lg font-semibold text-neutral-high mb-4">
                SEO
              </h2>

              <div className="space-y-4">
                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Slug *
                  </label>
                  <Input
                    type="text"
                    value={data.slug}
                    onChange={(e) => {
                      const v = String(e.target.value || '')
                        .toLowerCase()
                        .replace(/[^a-z0-9-]+/g, '-')
                      setData('slug', v)
                      // If user clears slug, re-enable auto; otherwise consider it manually controlled
                      setSlugAuto(v === '')
                    }}
                    onBlur={() => {
                      // Normalize fully on blur
                      const v = slugify(String((data as any).slug || ''))
                      setData('slug', v)
                    }}
                    className="font-mono text-sm"
                    placeholder="post-slug"
                  />
                  {errors.slug && (
                    <p className="text-sm text-[#dc2626] mt-1">{errors.slug}</p>
                  )}
                  {pathPattern && (
                    <p className="mt-1 text-xs text-neutral-low font-mono">
                      Preview: {buildPreviewPath(data.slug)}
                    </p>
                  )}
                </div>
                {/* Meta Title */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Meta Title
                  </label>
                  <Input
                    type="text"
                    value={data.metaTitle}
                    onChange={(e) => setData('metaTitle', e.target.value)}
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
                  <Textarea
                    value={data.metaDescription}
                    onChange={(e) => setData('metaDescription', e.target.value)}
                    rows={3}
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
                  <Input
                    type="url"
                    value={data.canonicalUrl}
                    onChange={(e) => setData('canonicalUrl', e.target.value)}
                    placeholder="https://example.com/my-post"
                  />
                </div>

                {/* Robots JSON */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Robots (JSON)
                  </label>
                  <Textarea
                    value={data.robotsJson}
                    onChange={(e) => setData('robotsJson', e.target.value)}
                    rows={4}
                    className="font-mono text-xs"
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
                  <Textarea
                    value={data.jsonldOverrides}
                    onChange={(e) => setData('jsonldOverrides', e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
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
              <div className="space-y-6">
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
                {/* Agent Runner */}
                <div>
                  <label className="block text-xs font-medium text-neutral-medium mb-1">Agent</label>
                  <div>
                    <Select
                      value={selectedAgent}
                      onValueChange={(val) => setSelectedAgent(val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.length === 0 ? (
                          <SelectItem value="__none__" disabled>No agents configured</SelectItem>
                        ) : (
                          agents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {selectedAgent && (
                      <button
                        className="mt-2 w-full px-4 py-2 text-sm rounded-lg bg-standout text-on-standout font-medium disabled:opacity-50"
                        disabled={runningAgent}
                        onClick={async () => {
                          if (!selectedAgent) return
                          setRunningAgent(true)
                          try {
                            const csrf = (() => {
                              if (typeof document === 'undefined') return undefined
                              const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
                              return m ? decodeURIComponent(m[1]) : undefined
                            })()
                            const res = await fetch(`/api/posts/${post.id}/agents/${encodeURIComponent(selectedAgent)}/run`, {
                              method: 'POST',
                              headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {}),
                              },
                              credentials: 'same-origin',
                              body: JSON.stringify({ context: { locale: selectedLocale } }),
                            })
                            const j = await res.json().catch(() => ({}))
                            if (res.ok) {
                              toast.success('Agent suggestions saved to review draft')
                              setViewMode('review')
                            } else {
                              toast.error(j?.error || 'Agent run failed')
                            }
                          } catch {
                            toast.error('Agent run failed')
                          } finally {
                            setRunningAgent(false)
                          }
                        }}
                        type="button"
                      >
                        {runningAgent ? 'Running…' : 'Run Agent'}
                      </button>
                    )}
                  </div>
                </div>
                {/* Status */}
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
                  {data.status === 'scheduled' && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-xs font-medium text-neutral-medium">
                        Scheduled Date
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="px-3 py-2 text-sm border border-line rounded hover:bg-backdrop-medium text-neutral-high"
                          >
                            {(data as any).scheduledAt
                              ? new Date((data as any).scheduledAt).toLocaleDateString()
                              : 'Pick a date'}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0">
                          <Calendar
                            mode="single"
                            selected={(data as any).scheduledAt ? new Date((data as any).scheduledAt) : undefined}
                            onSelect={(d: Date | undefined) => {
                              if (!d) {
                                setData('scheduledAt', '')
                                return
                              }
                              const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
                              setData('scheduledAt', local.toISOString())
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-neutral-low">Scheduler will publish on the selected day.</p>
                    </div>
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
                            ...xsrfHeader(),
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
                {uiConfig?.permalinksEnabled !== false && (
                  <button
                    className="w-full px-4 py-2 text-sm border border-border rounded-lg hover:bg-backdrop-medium text-neutral-medium"
                    onClick={() => {
                      const base = (post as any).publicPath || `/posts/${post.slug}`
                      const target = viewMode === 'review' ? `${base}${base.includes('?') ? '&' : '?'}view=review` : base
                      window.open(target, '_blank')
                    }}
                    type="button"
                  >
                    View on Site
                  </button>
                )}
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
                        headers: xsrfHeader(),
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
                          ...xsrfHeader(),
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({ mode: 'approve' }),
                      })
                      if (res.ok) {
                        toast.success('Review approved')
                        // Adopt the review values as the new approved baseline
                        const adopted = reviewInitialRef.current ? reviewInitialRef.current : pickForm(data)
                        initialDataRef.current = adopted as any
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

            {/* Author (Admin) */}
            {isAdmin && (
              <div className="bg-backdrop-low rounded-lg shadow p-6 border border-border">
                <h3 className="text-sm font-semibold text-neutral-high mb-4">Author</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-neutral-low">Current</div>
                    <div className="font-medium text-neutral-high">
                      {post.author?.fullName || post.author?.email || '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-medium mb-1">Reassign to</label>
                    <select
                      className="w-full border border-line bg-backdrop-low text-neutral-high rounded px-2 py-1"
                      value={selectedAuthorId ?? ''}
                      onChange={(e) => setSelectedAuthorId(e.target.value ? Number(e.target.value) : null)}
                      onFocus={async () => {
                        if (users.length > 0) return
                        try {
                          const res = await fetch('/api/users', { credentials: 'same-origin' })
                          const j = await res.json().catch(() => ({}))
                          const list: Array<{ id: number; email: string; fullName?: string | null }> = Array.isArray(j?.data) ? j.data : []
                          setUsers(list.map((u) => ({ id: u.id, email: u.email, fullName: (u as any).fullName ?? null })))
                        } catch { /* ignore */ }
                      }}
                    >
                      <option value="">Select a user…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.fullName || u.email)} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-sm border border-border rounded hover:bg-backdrop-medium text-neutral-high disabled:opacity-50"
                      disabled={!selectedAuthorId || selectedAuthorId === (post.author?.id ?? null)}
                      onClick={async () => {
                        if (!selectedAuthorId) return
                        try {
                          const res = await fetch(`/api/posts/${post.id}/author`, {
                            method: 'PATCH',
                            headers: {
                              Accept: 'application/json',
                              'Content-Type': 'application/json',
                              ...xsrfHeader(),
                            },
                            credentials: 'same-origin',
                            body: JSON.stringify({ authorId: selectedAuthorId }),
                          })
                          const j = await res.json().catch(() => ({}))
                          if (!res.ok) {
                            toast.error(j?.error || 'Failed to update author')
                            return
                          }
                          toast.success('Author updated')
                          window.location.reload()
                        } catch {
                          toast.error('Failed to update author')
                        }
                      }}
                    >
                      Update Author
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                          <Badge className="ml-2" variant={r.mode === 'review' ? 'secondary' : 'default'}>
                            {r.mode === 'review' ? 'Review' : 'Approved'}
                          </Badge>
                        </span>
                        {r.user?.email ? <span className="text-xs text-neutral-low">{r.user.email}</span> : null}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="px-2 py-1 text-xs border border-border rounded hover:bg-backdrop-medium text-neutral-medium"
                            type="button"
                          >
                            Revert
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revert to this revision?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will replace current content with the selected revision.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                const res = await fetch(`/api/posts/${post.id}/revisions/${encodeURIComponent(r.id)}/revert`, {
                                  method: 'POST',
                                  headers: {
                                    Accept: 'application/json',
                                    'Content-Type': 'application/json',
                                    ...xsrfHeader(),
                                  },
                                  credentials: 'same-origin',
                                })
                                if (res.ok) {
                                  toast.success('Reverted to selected revision')
                                  window.location.reload()
                                } else {
                                  const j = await res.json().catch(() => null)
                                  toast.error(j?.error || 'Failed to revert')
                                }
                              }}
                            >
                              Confirm
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
                        ...xsrfHeader(),
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
                        ...xsrfHeader(),
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
        processing={false}
      />
    </div>
  )
}

function MediaThumb({
  mediaId,
  mediaUrl,
  onChange,
  onClear,
}: {
  mediaId: string | null
  mediaUrl: string | null
  onChange: () => void
  onClear: () => void
}) {
  const [url, setUrl] = useState<string | null>(mediaUrl)
  useEffect(() => {
    let alive = true
    async function load() {
      if (url) return
      if (!mediaId) return
      try {
        const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}`, { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        const data = j?.data
        if (!data) return
        let u: string | null = data.url || null
        const variants = Array.isArray(data?.metadata?.variants) ? data.metadata.variants : []
        const adminThumb = (typeof process !== 'undefined' && process.env && (process.env as any).MEDIA_ADMIN_THUMBNAIL_VARIANT) || 'thumb'
        const found = variants.find((v: any) => v?.name === adminThumb)
        if (found?.url) u = found.url
        if (alive) setUrl(u)
      } catch {
        // ignore
      }
    }
    load()
    return () => { alive = false }
  }, [mediaId, url])
  return (
    <div className="border border-line rounded p-2 bg-backdrop-low flex items-center gap-3">
      <div className="w-16 h-16 bg-backdrop-medium rounded overflow-hidden flex items-center justify-center">
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-neutral-medium">No image</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium"
          onClick={onChange}
        >
          {mediaId ? 'Change' : 'Choose'}
        </button>
        {mediaId && (
          <button
            type="button"
            className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium"
            onClick={onClear}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

function ParentSelect({
  postId,
  postType,
  locale,
  value,
  onChange,
}: {
  postId: string
  postType: string
  locale: string
  value: string
  onChange: (val: string) => void
}) {
  const [options, setOptions] = useState<Array<{ id: string; title: string }>>([])
  const [loading, setLoading] = useState<boolean>(false)
  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          setLoading(true)
          const params = new URLSearchParams()
          params.set('types', postType)
          params.set('locale', locale)
          params.set('status', 'published')
          params.set('limit', '100')
          const res = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
          const json = await res.json().catch(() => ({}))
          const list: Array<{ id: string; title: string }> = Array.isArray(json?.data) ? json.data : []
          if (!alive) return
          setOptions(list.filter((p) => p.id !== postId))
        } finally {
          if (alive) setLoading(false)
        }
      })()
    return () => {
      alive = false
    }
  }, [postId, postType, locale])
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-medium mb-1">Parent</label>
      <Select
        defaultValue={value && value !== '' ? value : '__none__'}
        onValueChange={(val) => onChange(val === '__none__' ? '' : val)}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? 'Loading…' : 'None'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem key="__none__" value="__none__">
            None
          </SelectItem>
          {options.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

