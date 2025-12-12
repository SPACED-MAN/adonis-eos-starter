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
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { humanizeSlug } from '~/utils/strings'
import type { CustomFieldType } from '~/types/custom_field'
import { ModuleEditorPanel, ModuleListItem } from '../../components/modules/ModuleEditorPanel'
import { MediaPickerModal } from '../../components/media/MediaPickerModal'
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover'
import { Calendar } from '~/components/ui/calendar'
import { Checkbox } from '~/components/ui/checkbox'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Star } from 'lucide-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faReact } from '@fortawesome/free-brands-svg-icons'
import { faGlobe } from '@fortawesome/free-solid-svg-icons'
import { getXsrf } from '~/utils/xsrf'
import { LinkField, type LinkFieldValue } from '~/components/forms/LinkField'
import { useHasPermission } from '~/utils/permissions'
import { pickMediaVariantUrl, type MediaVariant } from '../../../lib/media'
// Field components are auto-discovered via Vite glob below

const flattenTerms = (
  nodes: TaxonomyTermNode[],
  prefix = ''
): Array<{ id: string; label: string }> => {
  const out: Array<{ id: string; label: string }> = []
  for (const node of nodes) {
    const label = prefix ? `${prefix} › ${node.name}` : node.name
    out.push({ id: node.id, label })
    if (Array.isArray(node.children) && node.children.length > 0) {
      out.push(...flattenTerms(node.children, label))
    }
  }
  return out
}

type TaxonomyTermNode = {
  id: string
  slug: string
  name: string
  children?: TaxonomyTermNode[]
}

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
    featuredImageId: string | null
    createdAt: string
    updatedAt: string
    publicPath: string
    author?: { id: number; email: string; fullName: string | null } | null
  }
  modules: {
    id: string
    type: string
    scope: string
    props: Record<string, any>
    reviewProps?: Record<string, any> | null
    aiReviewProps?: Record<string, any> | null
    overrides: Record<string, any> | null
    reviewOverrides?: Record<string, any> | null
    aiReviewOverrides?: Record<string, any> | null
    reviewAdded?: boolean
    reviewDeleted?: boolean
    aiReviewAdded?: boolean
    aiReviewDeleted?: boolean
    locked: boolean
    orderIndex: number
  }[]
  translations: { id: string; locale: string }[]
  reviewDraft?: any | null
  aiReviewDraft?: any | null
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
    hasPermalinks?: boolean
    modulesEnabled?: boolean
    featuredImage?: {
      enabled: boolean
      label?: string
    }
  }
  taxonomies?: Array<{ slug: string; name: string; terms: TaxonomyTermNode[] }>
  selectedTaxonomyTermIds?: string[]
  fieldTypes?: Array<{ type: string; adminComponent: string }>
}

export default function Editor({
  post,
  modules: initialModules,
  translations,
  reviewDraft,
  aiReviewDraft,
  customFields: initialCustomFields,
  uiConfig,
  taxonomies = [],
  selectedTaxonomyTermIds = [],
  fieldTypes = [],
}: EditorProps) {
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
    featuredImageId: post.featuredImageId || '',
    customFields: Array.isArray(initialCustomFields)
      ? initialCustomFields.map((f) => ({ fieldId: f.id, slug: f.slug, value: f.value ?? null }))
      : [],
    taxonomyTermIds: selectedTaxonomyTermIds,
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
    featuredImageId: post.featuredImageId || '',
    customFields: Array.isArray(initialCustomFields)
      ? initialCustomFields.map((f) => ({ fieldId: f.id, slug: f.slug, value: f.value ?? null }))
      : [],
    taxonomyTermIds: selectedTaxonomyTermIds,
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
    featuredImageId: String(reviewDraft.featuredImageId ?? (post.featuredImageId || '')),
    customFields: Array.isArray(reviewDraft.customFields) ? reviewDraft.customFields : ((Array.isArray(initialCustomFields) ? initialCustomFields.map(f => ({ fieldId: f.id, slug: f.slug, value: f.value ?? null })) : [])),
    taxonomyTermIds: selectedTaxonomyTermIds,
  } : null)
  const [viewMode, setViewMode] = useState<'approved' | 'review' | 'ai-review'>('approved')
  const [pendingModules, setPendingModules] = useState<Record<string, { overrides: Record<string, any> | null; edited: Record<string, any> }>>({})
  const [pendingRemoved, setPendingRemoved] = useState<Set<string>>(new Set())
  const [pendingReviewRemoved, setPendingReviewRemoved] = useState<Set<string>>(new Set())
  // Track new modules that haven't been persisted yet (temporary client-side IDs)
  const [pendingNewModules, setPendingNewModules] = useState<Array<{
    tempId: string
    type: string
    scope: 'local' | 'global'
    globalSlug?: string | null
    orderIndex: number
  }>>([])
  // Track structural changes that need to be published
  const [hasStructuralChanges, setHasStructuralChanges] = useState(false)
  const [taxonomyTrees, setTaxonomyTrees] = useState(taxonomies)
  const [newTermNames, setNewTermNames] = useState<Record<string, string>>({})
  const [selectedTaxonomyTerms, setSelectedTaxonomyTerms] = useState<Set<string>>(
    new Set(selectedTaxonomyTermIds)
  )
  const taxonomyInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const fieldComponents = useMemo(() => {
    const modules = import.meta.glob('../fields/*.tsx', { eager: true }) as Record<
      string,
      { default: any }
    >
    const map: Record<string, any> = {}
    Object.entries(modules).forEach(([path, mod]) => {
      const name = path.split('/').pop()?.replace(/\.\w+$/, '')
      if (name && mod?.default) {
        map[name] = mod.default
      }
    })
    return map
  }, [])

  const fieldRenderers = useMemo(() => {
    const byType = new Map<string, string>()
    fieldTypes.forEach((f) => {
      const compName = f.adminComponent?.split('/').pop()?.replace(/\.\w+$/, '')
      if (f.type && compName) byType.set(f.type, compName)
    })
    return byType
  }, [fieldTypes])

  const pascalFromType = (t: string) =>
    t
      .split(/[-_]/g)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')

  useEffect(() => {
    setTaxonomyTrees(taxonomies)
    setSelectedTaxonomyTerms(new Set(selectedTaxonomyTermIds))
    setData('taxonomyTermIds' as any, selectedTaxonomyTermIds)
  }, [taxonomies, selectedTaxonomyTermIds])

  const taxonomyOptions = useMemo(
    () =>
      Array.isArray(taxonomyTrees)
        ? taxonomyTrees.map((t) => ({
          slug: t.slug,
          name: t.name,
          hierarchical: !!(t as any).hierarchical,
          freeTagging: !!(t as any).freeTagging,
          maxSelections:
            (t as any).maxSelections === null || (t as any).maxSelections === undefined
              ? null
              : Number((t as any).maxSelections),
          options: flattenTerms(t.terms || []),
        }))
        : [],
    [taxonomyTrees]
  )

  const toggleTaxonomyTerm = (termId: string, checked: boolean) => {
    setSelectedTaxonomyTerms((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(termId)
      } else {
        next.delete(termId)
      }
      return next
    })
  }

  useEffect(() => {
    setData('taxonomyTermIds' as any, Array.from(selectedTaxonomyTerms))
  }, [selectedTaxonomyTerms])

  async function refreshTaxonomy(slug: string) {
    try {
      const res = await fetch(`/api/taxonomies/${encodeURIComponent(slug)}/terms`, { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      const terms = Array.isArray(json?.data) ? json.data : []
      setTaxonomyTrees((prev) =>
        prev.map((t) => (t.slug === slug ? { ...t, terms } : t))
      )
    } catch {
      /* ignore */
    }
  }

  async function createInlineTerm(slug: string, keepFocus?: boolean) {
    const name = (newTermNames[slug] || '').trim()
    if (!name) {
      toast.error('Enter a category name')
      return
    }
    try {
      const res = await fetch(`/api/taxonomies/${encodeURIComponent(slug)}/terms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(xsrfHeader() ? xsrfHeader() : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ name, parentId: null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error || 'Failed to create category')
        return
      }
      toast.success('Category created')
      setNewTermNames((m) => ({ ...m, [slug]: '' }))
      await refreshTaxonomy(slug)
      if (keepFocus && taxonomyInputRefs.current[slug]) {
        taxonomyInputRefs.current[slug]?.focus()
      }
    } catch {
      toast.error('Failed to create category')
    }
  }
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
    featuredImageId: (d as any).featuredImageId,
    customFields: Array.isArray((d as any).customFields)
      ? (d as any).customFields.map((e: any) => ({ fieldId: e.fieldId, slug: e.slug, value: e.value }))
      : [],
    taxonomyTermIds: Array.isArray((d as any).taxonomyTermIds) ? (d as any).taxonomyTermIds : [],
  })
  const modulesEnabled = uiConfig?.modulesEnabled !== false
  const isDirty = useMemo(() => {
    try {
      const baseline = viewMode === 'review' && reviewInitialRef.current ? reviewInitialRef.current : initialDataRef.current
      const fieldsChanged = JSON.stringify(pickForm(data)) !== JSON.stringify(baseline)
      const modulesPending = modulesEnabled ? Object.keys(pendingModules).length > 0 : false
      const removalsPendingApproved = modulesEnabled ? pendingRemoved.size > 0 : false
      const removalsPendingReview = modulesEnabled ? pendingReviewRemoved.size > 0 : false
      const newModulesPending = modulesEnabled ? pendingNewModules.length > 0 : false
      const structuralChanges = modulesEnabled ? hasStructuralChanges : false
      return fieldsChanged || modulesPending || removalsPendingApproved || removalsPendingReview || newModulesPending || structuralChanges
    } catch {
      return true
    }
  }, [data, viewMode, pendingModules, pendingRemoved, pendingReviewRemoved, pendingNewModules, hasStructuralChanges, modulesEnabled])


  // CSRF/XSRF token for fetch requests
  const page = usePage()
  const csrfFromProps: string | undefined = (page.props as any)?.csrf
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
  const canSaveForReview = useHasPermission('posts.review.save')
  const canSaveForAiReview = useHasPermission('posts.ai-review.save')
  const canPublish = useHasPermission('posts.publish')
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
  const [modules, setModules] = useState<EditorProps['modules']>(
    modulesEnabled ? initialModules || [] : []
  )
  const [pathPattern, setPathPattern] = useState<string | null>(null)
  const [supportedLocales, setSupportedLocales] = useState<string[]>([])
  const [selectedLocale, setSelectedLocale] = useState<string>(post.locale)
  const [moduleRegistry, setModuleRegistry] = useState<
    Record<string, { name: string; description?: string; renderingMode?: 'static' | 'react' }>
  >({})
  const [globalSlugToLabel, setGlobalSlugToLabel] = useState<Map<string, string>>(new Map())

  // Keep local state in sync with server props after Inertia navigations
  // Useful after adding modules or reloading the page
  useEffect(() => {
    setModules(modulesEnabled ? initialModules || [] : [])
  }, [initialModules, modulesEnabled])

  // Load module registry for display names
  useEffect(() => {
    if (!modulesEnabled) return
    let cancelled = false
      ; (async () => {
        try {
          const res = await fetch(`/api/modules/registry?post_type=${encodeURIComponent(post.type)}`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
          })
          const json = await res.json().catch(() => null)
          const list: Array<{ type: string; name?: string; description?: string; renderingMode?: 'static' | 'react' }> =
            Array.isArray(json?.data) ? json.data : []
          if (!cancelled) {
            const map: Record<string, { name: string; description?: string; renderingMode?: 'static' | 'react' }> = {}
            list.forEach((m) => {
              map[m.type] = {
                name: m.name || m.type,
                description: m.description,
                renderingMode: m.renderingMode,
              }
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
  }, [post.type, modulesEnabled])

  // Load URL pattern for this post type/locale to preview final path
  useEffect(() => {
    if (uiConfig?.hasPermalinks === false) {
      setPathPattern(null)
      return
    }
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

    // For hierarchical patterns with {path}, use the publicPath from backend
    // because we need parent slugs which we don't have in the frontend
    if (pathPattern.includes('{path}')) {
      // If slug hasn't changed, use the publicPath directly
      if (currentSlug === post.slug) {
        return post.publicPath
      }
      // If slug changed, show the pattern with {path} token
      // (actual path will be calculated on save)
      return pathPattern.replace(/\{locale\}/g, post.locale)
    }

    // For simple patterns with {slug}, build the preview
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
  const [agents, setAgents] = useState<Array<{ id: string; name: string; description?: string }>>([])
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
          const list: Array<{ id: string; name: string; description?: string }> = Array.isArray(json?.data) ? json.data : []
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
    if (!modulesEnabled) return
    // Always update all modules' order indices to ensure they're saved correctly
    // Don't skip based on current orderIndex since it may have been updated in local state
    // Filter out temporary modules (pending creation)
    const updates = next
      .filter((m) => !m.id.startsWith('temp-'))
      .map((m, index) =>
        fetch(`/api/post-modules/${encodeURIComponent(m.id)}`, {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...xsrfHeader(),
          },
          credentials: 'same-origin',
          body: JSON.stringify({ orderIndex: index, mode: viewMode === 'review' ? 'review' : 'publish' }),
        })
      )
    await Promise.allSettled(updates)
  }

  // Create pending new modules via API
  async function createPendingNewModules(mode: 'publish' | 'review' | 'ai-review' = 'publish') {
    if (!modulesEnabled) return
    if (pendingNewModules.length === 0) return

    const creates = pendingNewModules.map(async (pm) => {
      const res = await fetch(`/api/posts/${post.id}/modules`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...xsrfHeader(),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          moduleType: pm.type,
          scope: pm.scope,
          globalSlug: pm.globalSlug,
          orderIndex: pm.orderIndex,
          locked: false,
          mode,
        }),
      })

      if (!res.ok) {
        throw new Error(`Failed to create module: ${pm.type}`)
      }

      return res.json()
    })

    try {
      await Promise.all(creates)
      setPendingNewModules([])
    } catch (error) {
      toast.error('Failed to save some new modules')
      throw error
    }
  }

  // Handle adding new modules locally (without API call)
  async function handleAddModule(payload: { type: string; scope: 'post' | 'global'; globalSlug?: string | null }) {
    if (!modulesEnabled) return
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const nextOrderIndex = Math.max(-1, ...modules.map(m => m.orderIndex)) + 1

    // Add to pending new modules
    setPendingNewModules(prev => [
      ...prev,
      {
        tempId,
        type: payload.type,
        scope: payload.scope === 'post' ? 'local' : 'global',
        globalSlug: payload.globalSlug || null,
        orderIndex: nextOrderIndex,
      }
    ])

    // Add to modules display list with temporary data
    const newModule: EditorProps['modules'][0] = {
      id: tempId,
      type: payload.type,
      scope: payload.scope === 'post' ? 'local' : 'global',
      props: {},
      overrides: null,
      locked: false,
      orderIndex: nextOrderIndex,
    }

    setModules(prev => [...prev, newModule])
    setHasStructuralChanges(true)
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const current = modules.slice().sort((a, b) => a.orderIndex - b.orderIndex)
    const dragged = current.find((m) => m.id === active.id)
    const overItem = current.find((m) => m.id === over.id)
    // Prevent any interaction involving locked modules
    if (dragged?.locked || overItem?.locked) return

    // Reorder only within unlocked modules while keeping locked modules fixed
    const lockedPositions = current
      .map((m, idx) => ({ m, idx }))
      .filter(({ m }) => m.locked)
    const unlocked = current.filter((m) => !m.locked)
    const unlockedOld = unlocked.findIndex((m) => m.id === active.id)
    const unlockedNew = unlocked.findIndex((m) => m.id === over.id)
    if (unlockedOld === -1 || unlockedNew === -1) return
    const unlockedReordered = unlocked.slice()
    const [moved] = unlockedReordered.splice(unlockedOld, 1)
    unlockedReordered.splice(unlockedNew, 0, moved)

    // Rebuild list with locked items frozen in place
    const rebuilt: typeof modules = []
    let uPtr = 0
    for (let i = 0; i < current.length; i++) {
      const lockedAt = lockedPositions.find((p) => p.idx === i)
      if (lockedAt) {
        rebuilt.push(lockedAt.m)
      } else {
        rebuilt.push(unlockedReordered[uPtr]!)
        uPtr++
      }
    }
    const next = rebuilt.map((m, idx) => ({ ...m, orderIndex: idx }))
    setModules(next)
    setHasStructuralChanges(true)
  }

  const adjustModuleForView = useCallback(
    (m: EditorProps['modules'][number]) => {
      if (viewMode === 'review') {
        if (m.scope === 'post') {
          return {
            ...m,
            props: m.reviewProps ?? m.props ?? {},
            overrides: m.overrides,
          }
        }
        return {
          ...m,
          overrides: (m as any).reviewOverrides ?? m.overrides ?? null,
        }
      }
      if (viewMode === 'ai-review') {
        if (m.scope === 'post') {
          return {
            ...m,
            props: (m as any).aiReviewProps ?? m.props ?? {},
            overrides: m.overrides,
          }
        }
        return {
          ...m,
          overrides: (m as any).aiReviewOverrides ?? m.overrides ?? null,
        }
      }
      return m
    },
    [viewMode]
  )

  const sortedModules = useMemo(() => {
    const baseAll = modules.slice().sort((a, b) => a.orderIndex - b.orderIndex)

    if (viewMode === 'review') {
      const base = baseAll
        .filter((m) => !pendingReviewRemoved.has(m.id))
        .filter((m) => !m.reviewDeleted)
      return base.map(adjustModuleForView)
    }

    if (viewMode === 'ai-review') {
      // hide review-added modules in approved view but show them in ai-review?
      const base = baseAll.filter((m) => !m.reviewDeleted)
      return base.map(adjustModuleForView)
    }

    // Approved view: hide review-added modules
    const base = baseAll.filter((m) => !m.reviewAdded)
    return base.map(adjustModuleForView)
  }, [modules, viewMode, pendingReviewRemoved, adjustModuleForView])

  // Keep editing module in sync when view mode changes
  useEffect(() => {
    if (!editing) return
    const match = modules.find((m) => m.id === editing.id)
    if (!match) return
    const adjusted = adjustModuleForView(match)
    const sameProps = adjusted.props === editing.props
    const sameOverrides = adjusted.overrides === editing.overrides
    if (sameProps && sameOverrides) return
    setEditing(adjusted)
  }, [viewMode, modules, editing?.id, adjustModuleForView])

  const translationsSet = useMemo(() => new Set((translations || []).map((t) => t.locale)), [translations])
  const availableLocales = useMemo(() => {
    const base = new Set<string>(supportedLocales.length ? supportedLocales : ['en'])
    translations?.forEach((t) => base.add(t.locale))
    return Array.from(base)
  }, [translations, supportedLocales])

  // saveOverrides removed; overrides are handled via ModuleEditorPanel onSave and pendingModules batching.

  async function commitPendingModules(mode: 'review' | 'publish' | 'ai-review') {
    if (!modulesEnabled) return
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
    <div className="min-h-screen bg-backdrop-medium">
      <AdminHeader title={`Edit ${post.type ? humanizeSlug(post.type) : 'Post'}`} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Post Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Content Card */}
            <div className="bg-backdrop-low rounded-lg p-6 border border-line-low">
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

                {/* Featured Image (core) */}
                {(uiConfig?.featuredImage?.enabled) && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-1">
                      <span className="inline-flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-500" aria-hidden="true" />
                        <span>{uiConfig.featuredImage.label || 'Featured Image'}</span>
                      </span>
                    </label>
                    <MediaThumb
                      mediaId={(data as any).featuredImageId || null}
                      onChange={() => setOpenMediaForField('featuredImage')}
                      onClear={() => setData('featuredImageId', '')}
                    />
                    <MediaPickerModal
                      open={openMediaForField === 'featuredImage'}
                      onOpenChange={(o) => setOpenMediaForField(o ? 'featuredImage' : null)}
                      initialSelectedId={(data as any).featuredImageId || undefined}
                      onSelect={(m) => {
                        setData('featuredImageId', m.id)
                        setOpenMediaForField(null)
                      }}
                    />
                  </div>
                )}

                {/* Categories (Taxonomies) */}
                {taxonomyOptions.length > 0 && (
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-neutral-high">Categories</div>
                    {taxonomyOptions.map((tax) => {
                      const selectedCount = Array.from(selectedTaxonomyTerms).filter((id) =>
                        tax.options.some((o) => o.id === id)
                      ).length
                      const limit = tax.maxSelections === null ? Infinity : tax.maxSelections
                      return (
                        <div key={tax.slug} className="space-y-2 rounded border border-border p-3 bg-backdrop-low">
                          <div className="text-sm font-medium text-neutral-high">{tax.name}</div>
                          {tax.options.length === 0 ? (
                            <p className="text-xs text-neutral-low">No terms available for {tax.name}</p>
                          ) : (
                            <div className="space-y-2">
                              {tax.options.map((opt) => {
                                const checked = selectedTaxonomyTerms.has(opt.id)
                                const disableUnchecked = !checked && selectedCount >= limit
                                return (
                                  <label key={opt.id} className="flex items-center gap-2 text-sm text-neutral-high">
                                    <Checkbox
                                      checked={checked}
                                      disabled={disableUnchecked}
                                      onCheckedChange={(val) => toggleTaxonomyTerm(opt.id, !!val)}
                                      aria-label={opt.label}
                                    />
                                    <span className={disableUnchecked ? 'text-neutral-low' : ''}>{opt.label}</span>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                          {tax.freeTagging && (
                            <div className="flex items-center gap-2">
                              <Input
                                ref={(el) => {
                                  taxonomyInputRefs.current[tax.slug] = el
                                }}
                                value={newTermNames[tax.slug] || ''}
                                onChange={(e) => setNewTermNames((m) => ({ ...m, [tax.slug]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    createInlineTerm(tax.slug, true)
                                  }
                                }}
                                placeholder={`Add ${tax.name}`}
                                className="flex-1"
                              />
                              <button
                                type="button"
                                className="px-3 py-2 text-sm rounded bg-standout text-on-standout disabled:opacity-50"
                                onClick={() => createInlineTerm(tax.slug, true)}
                                disabled={!newTermNames[tax.slug]?.trim()}
                              >
                                Add
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

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
                      const rendererKey = (f as any).fieldType || (f as any).type
                      const compName =
                        fieldRenderers.get(rendererKey) ||
                        rendererKey?.split('/').pop()?.replace(/\.\w+$/, '') ||
                        `${pascalFromType(rendererKey)}Field`
                      const Renderer = compName ? (fieldComponents as Record<string, any>)[compName] : undefined
                      if (Renderer) {
                        const cfg = (f as any).config || {}
                        const isSelect = compName === 'SelectField'
                        return (
                          <div key={f.id}>
                            <label className="block text-sm font-medium text-neutral-medium mb-1">
                              {f.label}
                            </label>
                            {isSelect ? (
                              <Renderer
                                value={entry.value ?? null}
                                onChange={setValue}
                                options={Array.isArray(cfg.options) ? cfg.options : []}
                                multiple={!!cfg.multiple}
                              />
                            ) : (
                              <Renderer
                                value={entry.value ?? null}
                                onChange={setValue}
                                placeholder={cfg.placeholder}
                                maxLength={cfg.maxLength}
                              />
                            )}
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
                        return (
                          <div key={f.id}>
                            <label className="block text-sm font-medium text-neutral-medium mb-1">
                              {f.label}
                            </label>
                            <MediaThumb
                              mediaId={currentId}
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
                      if (f.fieldType === 'post-reference') {
                        return (
                          <div key={f.id}>
                            <PostCustomPostReferenceField
                              label={f.label}
                              value={entry.value}
                              onChange={setValue}
                              config={f.config}
                            />
                          </div>
                        )
                      }
                      if (f.fieldType === 'link') {
                        return (
                          <div key={f.id}>
                            <LinkField
                              label={f.label}
                              value={entry.value}
                              onChange={(val: LinkFieldValue) => setValue(val)}
                              currentLocale={post.locale}
                              helperText="Use an existing post when possible so links stay valid if URLs change."
                            />
                          </div>
                        )
                      }
                      if (f.fieldType === 'file') {
                        const current = entry.value || null
                        const currentLabel: string | null =
                          typeof current === 'object' && current !== null
                            ? (current.originalFilename || current.filename || current.name || null)
                            : (typeof current === 'string' ? current : null)
                        const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          try {
                            const form = new FormData()
                            form.append('file', file)
                            form.append('naming', 'original')
                            form.append('appendIdIfExists', 'true')
                            form.append('altText', f.label || file.name)
                            const res = await fetch('/api/media', {
                              method: 'POST',
                              headers: {
                                ...xsrfHeader(),
                              },
                              credentials: 'same-origin',
                              body: form,
                            })
                            if (!res.ok) {
                              const j = await res.json().catch(() => ({}))
                              toast.error(j?.error || 'File upload failed')
                              return
                            }
                            const j = await res.json().catch(() => ({}))
                            const id = j?.data?.id
                            const url = j?.data?.url
                            if (!id || !url) {
                              toast.error('File upload response was invalid')
                              return
                            }
                            setValue({ id, url, originalFilename: file.name })
                            toast.success('File uploaded')
                          } catch {
                            toast.error('File upload failed')
                          } finally {
                            e.target.value = ''
                          }
                        }
                        return (
                          <div key={f.id}>
                            <label className="block text-sm font-medium text-neutral-medium mb-1">
                              {f.label}
                            </label>
                            <div className="space-y-2">
                              <Input
                                type="file"
                                onChange={handleFileChange}
                                className="h-9 text-sm"
                              />
                              {currentLabel && (
                                <div className="flex items-center justify-between text-[11px] text-neutral-low">
                                  <span className="truncate max-w-[220px]" title={currentLabel}>
                                    Attached: {currentLabel}
                                  </span>
                                  <button
                                    type="button"
                                    className="text-xs text-danger hover:underline"
                                    onClick={() => setValue(null)}
                                  >
                                    Clear
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }
                      if (f.fieldType === 'icon') {
                        const current: string = typeof entry.value === 'string' ? entry.value : ''
                        return (
                          <div key={f.id}>
                            <label className="block text-sm font-medium text-neutral-medium mb-1">
                              {f.label}
                            </label>
                            <div className="space-y-1">
                              <Input
                                type="text"
                                value={current}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder="fa-solid fa-briefcase"
                              />
                              <p className="text-[11px] text-neutral-low">
                                Enter a Font Awesome class string (for example{' '}
                                <code className="font-mono text-[11px]">fa-solid fa-briefcase</code>). This will be
                                rendered wherever the field is used.
                              </p>
                              {current && (
                                <div className="flex items-center gap-2 text-[11px] text-neutral-medium">
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-backdrop-medium">
                                    <i className={current} aria-hidden="true" />
                                  </span>
                                  <span className="truncate max-w-[220px]" title={current}>
                                    {current}
                                  </span>
                                </div>
                              )}
                            </div>
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

              {/* Modules integrated into Content (hidden when modules are disabled) */}
              {modulesEnabled && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-neutral-high">Modules</h3>
                    <ModulePicker
                      postId={post.id}
                      postType={post.type}
                      mode={viewMode === 'review' ? 'review' : 'publish'}
                      onAdd={handleAddModule}
                    />
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
                                <li className="bg-backdrop-low border border-line-low rounded-lg px-4 py-3 flex items-center justify-between">
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
                                    {moduleRegistry[m.type]?.renderingMode === 'react' && (
                                      <span
                                        className="inline-flex items-center rounded border border-line-medium bg-backdrop-low px-2 py-1 text-xs text-neutral-high"
                                        title="React module (client-side interactivity)"
                                        aria-label="React module"
                                      >
                                        <FontAwesomeIcon icon={faReact} className="mr-1 text-sky-400" />
                                        React
                                      </span>
                                    )}
                                    {m.scope === 'global'
                                      ? (
                                        <span
                                          className="inline-flex items-center rounded border border-line-medium bg-backdrop-low px-2 py-1 text-xs text-neutral-high"
                                          title="Global module"
                                          aria-label="Global module"
                                        >
                                          <FontAwesomeIcon icon={faGlobe} className="w-3.5 h-3.5" />
                                        </span>
                                      )
                                      : (
                                        <button
                                          className="text-xs px-2 py-1 rounded border border-line-low bg-backdrop-input text-neutral-high hover:bg-backdrop-medium"
                                          onClick={() => setEditing(adjustModuleForView(m))}
                                          type="button"
                                        >
                                          Edit
                                        </button>
                                      )}
                                    <button
                                      className="text-xs px-2 py-1 rounded border border-[#ef4444] text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] disabled:opacity-50"
                                      disabled={m.locked}
                                      onClick={async () => {
                                        if (m.locked) {
                                          toast.error('Locked modules cannot be removed')
                                          return
                                        }
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
              )}
            </div>

            {/* SEO Card */}
            <div className="bg-backdrop-low rounded-lg p-6 border border-line-low">
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
                    {canSaveForReview && (
                      <button
                        type="button"
                        onClick={() => setViewMode('review')}
                        className={`px-2 py-1 text-xs ${viewMode === 'review' ? 'bg-backdrop-medium text-neutral-high' : 'text-neutral-medium hover:bg-backdrop-medium'}`}
                      >
                        Review
                      </button>
                    )}
                    {aiReviewDraft && canSaveForAiReview && (
                      <button
                        type="button"
                        onClick={() => setViewMode('ai-review')}
                        className={`px-2 py-1 text-xs ${viewMode === 'ai-review' ? 'bg-backdrop-medium text-neutral-high' : 'text-neutral-medium hover:bg-backdrop-medium'}`}
                      >
                        AI Review
                      </button>
                    )}
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
                        {canPublish && <SelectItem value="published">Published</SelectItem>}
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="protected">Protected</SelectItem>
                        {canPublish && <SelectItem value="archived">Archived</SelectItem>}
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
                            className="px-3 py-2 text-sm border border-line-low rounded hover:bg-backdrop-medium text-neutral-high"
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
                                setData('scheduledAt' as any, '')
                                return
                              }
                              const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
                              setData('scheduledAt' as any, local.toISOString())
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
                {uiConfig?.hasPermalinks !== false && (
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

                {/* Draft Actions - Compact section for Save for Review/AI Review */}
                {viewMode === 'approved' && (canSaveForReview || canSaveForAiReview) && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-neutral-low px-1">Save as Draft</div>
                    <div className="grid grid-cols-2 gap-2">
                      {canSaveForReview && (
                        <button
                          className="px-3 py-1.5 text-xs border border-border rounded hover:bg-backdrop-medium text-neutral-medium disabled:opacity-50"
                          disabled={!isDirty || processing}
                          onClick={async () => {
                            await commitPendingModules('review')
                            await saveForReview()
                          }}
                          type="button"
                          title="Save changes to Review draft without publishing"
                        >
                          Review
                        </button>
                      )}
                      {canSaveForAiReview && (
                        <button
                          className="px-3 py-1.5 text-xs border border-border rounded hover:bg-backdrop-medium text-neutral-medium disabled:opacity-50"
                          disabled={!isDirty || processing}
                          onClick={async () => {
                            await commitPendingModules('ai-review')
                            const res = await fetch(`/api/posts/${post.id}`, {
                              method: 'PUT',
                              headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                ...xsrfHeader(),
                              },
                              credentials: 'same-origin',
                              body: JSON.stringify({ ...pickForm(data), mode: 'ai-review' }),
                            })
                            if (res.ok) {
                              toast.success('Saved for AI review')
                            } else {
                              toast.error('Failed to save for AI review')
                            }
                          }}
                          type="button"
                          title="Save changes to AI Review draft without publishing"
                        >
                          AI Review
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Main save button - conditionally shown based on mode and permissions */}
                {((viewMode === 'review' && canSaveForReview) || (viewMode === 'ai-review' && canSaveForAiReview) || viewMode === 'approved') && (
                  <button
                    className={`w-full px-4 py-2.5 text-sm rounded-lg disabled:opacity-50 ${(!isDirty || processing) ? 'border border-border text-neutral-medium' : 'bg-standout text-on-standout font-medium'}`}
                    disabled={!isDirty || processing}
                    onClick={async () => {
                      if (viewMode === 'review') {
                        await createPendingNewModules('review')
                        await commitPendingModules('review')
                        await saveForReview()
                      } else if (viewMode === 'ai-review') {
                        await createPendingNewModules('ai-review')
                        await commitPendingModules('ai-review')
                        const res = await fetch(`/api/posts/${post.id}`, {
                          method: 'PUT',
                          headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            ...xsrfHeader(),
                          },
                          credentials: 'same-origin',
                          body: JSON.stringify({ ...pickForm(data), mode: 'ai-review' }),
                        })
                        if (res.ok) {
                          toast.success('AI review updated')
                        } else {
                          toast.error('Failed to update AI review')
                        }
                      } else {
                        try {
                          // Create any new modules first
                          await createPendingNewModules('publish')
                          // Then commit edits to existing modules
                          await commitPendingModules('publish')
                          // Save module order if it changed (filter out temp modules)
                          if (hasStructuralChanges) {
                            const persistedModules = modules.filter(m => !m.id.startsWith('temp-'))
                            await persistOrder(persistedModules)
                          }
                          // Finally save post fields (this triggers page refresh)
                          put(`/api/posts/${post.id}`, {
                            headers: xsrfHeader(),
                            preserveScroll: true,
                            onSuccess: () => {
                              toast.success('Changes saved')
                              initialDataRef.current = pickForm(data)
                              // Clear structural changes flag after successful publish
                              setHasStructuralChanges(false)
                            },
                            onError: () => toast.error('Failed to save changes'),
                          })
                        } catch (error) {
                          console.error('Save error:', error)
                          toast.error('Failed to save changes')
                        }
                      }
                    }}
                    type="button"
                  >
                    {viewMode === 'ai-review' ? 'Save for AI Review' : (viewMode === 'review' ? 'Save for Review' : (data.status === 'published' ? 'Publish Changes' : 'Save Changes'))}
                  </button>
                )}
                {aiReviewDraft && (
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
                        body: JSON.stringify({ mode: 'approve-ai-review' }),
                      })
                      if (res.ok) {
                        toast.success('AI review approved and moved to Review')
                        setViewMode('review')
                        window.location.reload()
                      } else {
                        toast.error('Failed to approve AI review')
                      }
                    }}
                    type="button"
                  >
                    Approve AI Review
                  </button>
                )}
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
                      className="w-full border border-line-low bg-backdrop-input text-neutral-high rounded px-2 py-1"
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
          <div className="relative z-10 w-full max-w-md rounded-lg border border-line-low bg-backdrop-input p-6 shadow-xl">
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
                className="w-full px-3 py-2 text-sm rounded border border-line-low bg-backdrop-input hover:bg-backdrop-medium text-neutral-high"
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
        key={`${editing ? editing.id : 'none'}-${viewMode}`}
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

function PostCustomPostReferenceField({
  label,
  value,
  onChange,
  config,
}: {
  label: string
  value: any
  onChange: (val: any) => void
  config?: Record<string, any>
}) {
  const allowedTypes: string[] = Array.isArray((config as any)?.postTypes) ? (config as any).postTypes : []
  const allowMultiple = (config as any)?.allowMultiple !== false
  const initialVals: string[] = Array.isArray(value) ? value.map((v: any) => String(v)) : value ? [String(value)] : []
  const [vals, setVals] = useState<string[]>(initialVals)
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    onChange(allowMultiple ? vals : (vals[0] ?? null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals, allowMultiple])

  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const params = new URLSearchParams()
          params.set('status', 'published')
          params.set('limit', '100')
          params.set('sortBy', 'published_at')
          params.set('sortOrder', 'desc')
          if (allowedTypes.length > 0) {
            params.set('types', allowedTypes.join(','))
          }
          const res = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
          const j = await res.json().catch(() => ({}))
          const list: Array<{ id: string; title: string; slug?: string }> = Array.isArray(j?.data) ? j.data : []
          if (!alive) return
          setOptions(list.map((p) => ({ label: p.title || p.slug || String(p.id), value: String(p.id) })))
        } catch {
          if (!alive) return
          setOptions([])
        }
      })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allowedTypes)])

  const filteredOptions =
    query.trim().length === 0
      ? options
      : options.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-medium mb-1">
        {label}
      </label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full text-left px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
          >
            {vals.length === 0 ? 'Select posts' : `${vals.length} selected`}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Search posts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="max-h-64 overflow-auto space-y-2">
              {filteredOptions.length === 0 ? (
                <div className="text-xs text-neutral-low">No posts found.</div>
              ) : (
                filteredOptions.map((opt) => {
                  const checked = vals.includes(opt.value)
                  return (
                    <label key={opt.value} className="flex items-center gap-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          setVals((prev) => {
                            if (allowMultiple) {
                              const next = new Set(prev)
                              if (c) next.add(opt.value)
                              else next.delete(opt.value)
                              return Array.from(next)
                            }
                            return c ? [opt.value] : []
                          })
                        }}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Initial check
    setIsDark(document.documentElement.classList.contains('dark'))

    // Watch for changes
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return isDark
}

function MediaThumb({
  mediaId,
  onChange,
  onClear,
}: {
  mediaId: string | null
  onChange: () => void
  onClear: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [mediaData, setMediaData] = useState<{
    baseUrl: string
    variants: MediaVariant[]
    darkSourceUrl?: string
  } | null>(null)
  const isDark = useIsDarkMode()

  // Fetch media data when mediaId changes
  useEffect(() => {
    let alive = true
    async function load() {
      if (!mediaId) {
        if (alive) {
          setMediaData(null)
          setUrl(null)
        }
        return
      }
      try {
        const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}`, {
          credentials: 'same-origin',
        })
        const j = await res.json().catch(() => ({}))
        const data = j?.data
        if (!data) {
          if (alive) {
            setMediaData(null)
            setUrl(null)
          }
          return
        }
        const baseUrl: string | null = data.url || null
        if (!baseUrl) {
          if (alive) {
            setMediaData(null)
            setUrl(null)
          }
          return
        }
        const meta = (data as any).metadata || {}
        const variants: MediaVariant[] = Array.isArray(meta?.variants)
          ? (meta.variants as MediaVariant[])
          : []
        const darkSourceUrl =
          typeof meta.darkSourceUrl === 'string' ? (meta.darkSourceUrl as string) : undefined
        if (alive) {
          setMediaData({ baseUrl, variants, darkSourceUrl })
        }
      } catch (err) {
        console.error('MediaThumb: Failed to load media', err)
        if (alive) {
          setMediaData(null)
          setUrl(null)
        }
      }
    }
    load()
    return () => { alive = false }
  }, [mediaId])

  // Resolve URL when media data or theme changes
  useEffect(() => {
    if (!mediaData) {
      setUrl(null)
      return
    }
    const adminThumb =
      (typeof process !== 'undefined' &&
        process.env &&
        (process.env as any).MEDIA_ADMIN_THUMBNAIL_VARIANT) ||
      'thumb'
    const resolved = pickMediaVariantUrl(mediaData.baseUrl, mediaData.variants, adminThumb, {
      darkSourceUrl: mediaData.darkSourceUrl,
    })
    setUrl(resolved)
  }, [mediaData, isDark])

  return (
    <div className="border border-line-low rounded p-2 bg-backdrop-low flex items-center gap-3">
      <div className="w-16 h-16 bg-backdrop-medium rounded overflow-hidden flex items-center justify-center">
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover" key={`${url}-${isDark}`} />
        ) : (
          <span className="text-xs text-neutral-medium">No image</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
          onClick={onChange}
        >
          {mediaId ? 'Change' : 'Choose'}
        </button>
        {mediaId && (
          <button
            type="button"
            className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
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
        <SelectContent className="max-h-64 overflow-auto">
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

