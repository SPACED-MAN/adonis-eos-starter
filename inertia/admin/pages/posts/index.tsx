// Posts admin index page
// This file owns the full implementation for the Posts list/admin UI.
import { Head, Link, usePage, router } from '@inertiajs/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { toast } from 'sonner'
import { useConfirm } from '~/components/ConfirmDialogProvider'
import { faTurnUp, faMessage } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useState } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { useHasPermission } from '~/utils/permissions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Badge } from '~/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BulkAgentModal } from '../../components/agents/BulkAgentModal'

interface PostsIndexProps {}

export default function PostsIndexPage({}: PostsIndexProps) {
  const { confirm, alert } = useConfirm()
  // Entire implementation moved here from the former dashboard.tsx
  const inertiaPage = usePage()
  const role: string | undefined =
    (inertiaPage.props as any)?.currentUser?.role ?? (inertiaPage.props as any)?.auth?.user?.role
  const canCreatePost = useHasPermission('posts.create')
  const canPublish = useHasPermission('posts.publish')
  const canDelete = useHasPermission('posts.delete')
  const [posts, setPosts] = useState<
    Array<{
      id: string
      type: string
      title: string
      slug: string
      status: string
      locale: string
      updatedAt: string
      parentId?: string | null
      translationOfId?: string | null
      familyLocales?: string[]
      hasReviewDraft?: boolean
      hasFeedback?: boolean
    }>
  >([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('')
  const [locale, setLocale] = useState<string>('') // empty = all locales; will default to site's default on first load
  const [postType, setPostType] = useState<string>('')
  const [postTypes, setPostTypes] = useState<string[]>([])
  // Taxonomy filters
  type Taxonomy = { id: string; slug: string; name: string }
  type TermNode = { id: string; name: string; parentId: string | null; children?: TermNode[] }
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([])
  const [taxonomy, setTaxonomy] = useState<string>('') // slug
  const [terms, setTerms] = useState<TermNode[]>([])
  const [termId, setTermId] = useState<string>('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<'type' | 'template'>('type')
  const [selectedPostType, setSelectedPostType] = useState<string | null>(null)
  const [availableTemplates, setAvailableTemplates] = useState<
    Array<{ id: string; name: string; isDefault: boolean }>
  >([])
  const [fetchingTemplates, setFetchingTemplates] = useState(false)
  const [sortBy, setSortBy] = useState<
    'title' | 'status' | 'locale' | 'updated_at' | 'created_at' | 'order_index'
  >('updated_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [hasFeedback, setHasFeedback] = useState(false)
  const [bulkKey, setBulkKey] = useState(0)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [confirmBulkAction, setConfirmBulkAction] = useState(false)
  const [pendingBulkAction, setPendingBulkAction] = useState<
    'publish' | 'draft' | 'archive' | 'delete' | 'duplicate' | 'regeneratePermalinks' | null
  >(null)
  const [hierarchical, setHierarchical] = useState(false)
  const [dndMode, setDndMode] = useState(false)
  const [reorderParentId, setReorderParentId] = useState<string | null>(null)
  const [reorderScopeAlertOpen, setReorderScopeAlertOpen] = useState<boolean>(false)
  const [bulkAgents, setBulkAgents] = useState<any[]>([])
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null)
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const INDENT_PX = 40
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)
  const [dragBaseLevel, setDragBaseLevel] = useState<number>(0)
  const [dragProjectedLevel, setDragProjectedLevel] = useState<number | null>(null)
  const [willNest, setWillNest] = useState<boolean>(false)

  // CSRF token for API calls
  const xsrfFromCookie: string | undefined = (() => {
    if (typeof document === 'undefined') return undefined
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : undefined
  })()

  async function fetchPosts(resetSelection = true) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status) {
        if (status === '__in_review__') {
          params.set('inReview', '1')
        } else {
          params.set('status', status)
        }
      }
      if (postType) params.set('type', postType)
      if (locale) params.set('locale', locale)
      if (hasFeedback) params.set('hasFeedback', '1')
      if (taxonomy && termId) {
        params.set('taxonomy', taxonomy)
        params.set('termId', termId)
        params.set('includeDescendants', '1')
      }
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)
      if (hierarchical) {
        params.set('limit', '1000')
        params.set('page', '1')
      } else {
        params.set('limit', String(limit))
        params.set('page', String(page))
      }
      params.set('withTranslations', '1')
      const res = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      const list: Array<{
        id: string
        type: string
        title: string
        slug: string
        status: string
        locale: string
        updatedAt: string
        parentId?: string | null
        translationOfId?: string | null
        familyLocales?: string[]
        hasReviewDraft?: boolean
      }> = Array.isArray(json?.data) ? json.data : []
      setPosts(list)
      const metaTotal = (json as any)?.meta?.total
      setTotal(typeof metaTotal === 'number' ? metaTotal : Number(metaTotal || 0))
      // Reset selection when list changes
      if (resetSelection) {
        setSelected(new Set())
        setSelectAll(false)
      }
    } finally {
      setLoading(false)
    }
  }

  // Load bulk agents
  useEffect(() => {
    fetch('/api/agents?scope=posts.bulk', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((json) => {
        setBulkAgents(Array.isArray(json?.data) ? json.data : [])
      })
      .catch(() => setBulkAgents([]))
  }, [])

  // On first load (no locale filter), default to site's default locale
  useEffect(() => {
    if (locale) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/locales', { credentials: 'same-origin' })
        const json = await res.json().catch(() => null)
        const fromMeta: string | undefined = json?.meta?.defaultLocale
        const fromData: string | undefined = Array.isArray(json?.data)
          ? (json.data.find((l: any) => l.isDefault)?.code as string | undefined)
          : undefined
        const effective = fromMeta || fromData
        if (!cancelled && effective) {
          setLocale(effective)
        }
      } catch {
        // leave as all locales
      }
    })()
    return () => {
      cancelled = true
    }
  }, [locale])

  useEffect(() => {
    fetchPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, locale, postType, taxonomy, termId, sortBy, sortOrder, page, limit, hierarchical, hasFeedback])

  useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/post-types', { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      const list: string[] = Array.isArray(json?.data) ? json.data : []
      setPostTypes(list)
    })()
  }, [])

  // Load taxonomies for filter
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/taxonomies', { credentials: 'same-origin' })
        const json = await res.json().catch(() => ({}))
        const list: Taxonomy[] = Array.isArray(json?.data) ? json.data : []
        setTaxonomies(list)
      } catch {
        setTaxonomies([])
      }
    })()
  }, [])

  // Load terms for selected taxonomy
  useEffect(() => {
    ;(async () => {
      setTerms([])
      setTermId('')
      if (!taxonomy) return
      try {
        const res = await fetch(`/api/taxonomies/${encodeURIComponent(taxonomy)}/terms`, {
          credentials: 'same-origin',
        })
        const json = await res.json().catch(() => ({}))
        const tree: TermNode[] = Array.isArray(json?.data) ? json.data : []
        setTerms(tree)
      } catch {
        setTerms([])
      }
    })()
  }, [taxonomy])

  function flattenTerms(nodes: TermNode[]): TermNode[] {
    const out: TermNode[] = []
    const walk = (arr: TermNode[]) => {
      for (const n of arr) {
        out.push({ id: n.id, name: n.name, parentId: n.parentId, children: [] })
        if (n.children?.length) walk(n.children)
      }
    }
    walk(nodes)
    return out
  }
  const flatTerms = flattenTerms(terms)

  // Supported locales for translation progress
  const [supportedLocales, setSupportedLocales] = useState<string[]>([])
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/locales', { credentials: 'same-origin' })
        const json = await res.json().catch(() => ({}))
        const list: Array<{ code: string; isEnabled?: boolean; is_enabled?: boolean }> =
          Array.isArray(json?.data) ? json.data : []
        const enabled = list
          .filter(
            (l) =>
              (l as any).isEnabled === true ||
              (l as any).is_enabled === true ||
              (l as any).isEnabled === undefined
          )
          .map((l) => l.code)
        setSupportedLocales(enabled.length ? enabled : ['en'])
      } catch {
        setSupportedLocales(['en'])
      }
    })()
  }, [])

  function labelize(type: string): string {
    if (!type) return ''
    const withSpaces = type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
    return withSpaces
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  async function createNew(typeArg?: string, templateId?: string) {
    const type = typeArg || postType || (postTypes[0] || '').toString()
    if (!type) {
      alert({
        title: 'Post Type Required',
        description: 'Select a post type first',
      })
      return
    }
    const slug = `untitled-${type}-${Date.now()}`
    const title = `Untitled ${type.charAt(0).toUpperCase() + type.slice(1)}`
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        type,
        locale: 'en',
        slug,
        title,
        status: 'draft',
        moduleGroupId: templateId || null,
      }),
    })
    if (res.ok) {
      const json = await res.json().catch(() => ({}))
      const id = json?.data?.id
      if (id) {
        router.visit(`/admin/posts/${id}/edit`)
        return
      }
    }
    alert({
      title: 'Error',
      description: 'Failed to create post',
    })
  }

  async function handleTypeSelect(type: string) {
    setSelectedPostType(type)
    setFetchingTemplates(true)
    try {
      const res = await fetch(`/api/module-groups?postType=${encodeURIComponent(type)}`, {
        credentials: 'same-origin',
      })
      const json = await res.json().catch(() => ({}))
      const templates = Array.isArray(json?.data) ? json.data : []
      if (templates.length > 1) {
        setAvailableTemplates(templates)
        setCreateStep('template')
      } else {
        // Just one or zero templates - use default creation logic
        createNew(type)
        setIsCreateOpen(false)
      }
    } catch (err) {
      console.error('Failed to fetch templates', err)
      createNew(type)
      setIsCreateOpen(false)
    } finally {
      setFetchingTemplates(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectAll((prev) => !prev)
    setSelected(() => {
      if (!selectAll) {
        return new Set(posts.map((p) => p.id))
      }
      return new Set()
    })
  }

  async function applyBulk(
    action: 'publish' | 'draft' | 'archive' | 'delete' | 'duplicate' | 'regeneratePermalinks'
  ) {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    const res = await fetch('/api/posts/bulk', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
      },
      credentials: 'same-origin',
      body: JSON.stringify({ action, ids }),
    })
    if (res.ok) {
      await fetchPosts(action === 'delete')
    } else {
      const err = await res.json().catch(() => ({}))
      alert({
        title: 'Error',
        description: err?.error || 'Bulk action failed',
      })
    }
  }

  function toggleSort(
    column: 'title' | 'status' | 'locale' | 'updated_at' | 'created_at' | 'order_index'
  ) {
    // Any manual sort disables Reorder, but keeps View hierarchy
    if (dndMode) {
      setDndMode(false)
    }
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // Derived rows for rendering (flat list with levels when hierarchical)
  const flatRows: Array<{ post: (typeof posts)[number]; level: number }> = useMemo(() => {
    if (posts.length === 0) return []
    if (!hierarchical) return posts.map((p) => ({ post: p, level: 0 }))
    const idToChildren = new Map<string, typeof posts>()
    const roots: typeof posts = []
    posts.forEach((it) => {
      const pid = (it as any).parentId || null
      if (pid) {
        if (!idToChildren.has(pid)) idToChildren.set(pid, [])
        idToChildren.get(pid)!.push(it)
      } else {
        roots.push(it)
      }
    })
    const out: Array<{ post: (typeof posts)[number]; level: number }> = []
    const sortKids = (arr: typeof posts) => {
      const copy = arr.slice()
      // In reorder mode, always use order_index ascending for stable handles
      if (dndMode) {
        return copy.sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      }
      // Otherwise, respect the selected sortBy/sortOrder for sibling ordering
      const factor = sortOrder === 'asc' ? 1 : -1
      return copy.sort((a: any, b: any) => {
        switch (sortBy) {
          case 'order_index': {
            const av = Number(a.orderIndex ?? 0)
            const bv = Number(b.orderIndex ?? 0)
            return (av - bv) * factor
          }
          case 'status': {
            return a.status.localeCompare(b.status) * factor
          }
          case 'locale': {
            return a.locale.localeCompare(b.locale) * factor
          }
          case 'updated_at': {
            const at = new Date(a.updatedAt).getTime()
            const bt = new Date(b.updatedAt).getTime()
            return (at - bt) * factor
          }
          case 'title':
          default: {
            return a.title.localeCompare(b.title) * factor
          }
        }
      })
    }
    const rootsSorted = sortKids(roots)
    function dfs(node: (typeof posts)[number], level: number) {
      out.push({ post: node, level })
      const kids = sortKids(idToChildren.get(node.id) || [])
      kids.forEach((c) => dfs(c, level + 1))
    }
    rootsSorted.forEach((r) => dfs(r, 0))
    return out
  }, [posts, hierarchical, dndMode, sortBy, sortOrder])

  function onToggleDnd(enabled: boolean) {
    if (enabled) {
      // Require type and locale to be selected for safe scoped reorder
      if (!postType || !locale) {
        setReorderScopeAlertOpen(true)
        setDndMode(false)
        return
      }
      // Reorder requires hierarchy
      if (!hierarchical) {
        setHierarchical(true)
        setPage(1)
      }
      // Prefer order-index ascending for meaningful DnD
      if (sortBy !== 'order_index') setSortBy('order_index' as any)
      if (sortOrder !== 'asc') setSortOrder('asc')
      // Default scope: roots
      setReorderParentId(null)
      setDndMode(true)
      return
    }
    setDndMode(false)
  }

  function onToggleHierarchy(next: boolean) {
    // If disabling hierarchy while Reorder is active, turn off Reorder first
    if (!next && dndMode) {
      setDndMode(false)
    }
    setHierarchical(next)
    setPage(1)
  }

  function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      cursor: 'grab',
    }
    return (
      <TableRow ref={setNodeRef} style={style} {...attributes} {...listeners}>
        {children}
      </TableRow>
    )
  }

  function handleDragStart(ev: DragStartEvent) {
    const id = String(ev.active.id)
    setDragActiveId(id)
    const idx = flatRows.findIndex((r) => r.post.id === id)
    setDragBaseLevel(idx >= 0 ? flatRows[idx].level : 0)
    setDragProjectedLevel(null)
    setWillNest(false)
  }

  function handleDragMove(ev: DragMoveEvent) {
    if (!dragActiveId) return
    const dx = ev.delta.x || 0
    const change = Math.round(dx / INDENT_PX)
    const next = Math.max(0, dragBaseLevel + change)
    setDragProjectedLevel(next)
    // Nesting intent only if horizontally indented by at least 1 level
    const overId = ev.over ? String(ev.over.id) : null
    if (!overId || overId === dragActiveId) return setWillNest(false)
    setWillNest(change >= 1)
  }

  async function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev
    if (!over || active.id === over.id) return
    const activeIdx = flatRows.findIndex((r) => r.post.id === active.id)
    const overIdx = flatRows.findIndex((r) => r.post.id === over.id)
    if (activeIdx < 0 || overIdx < 0) return
    const activeRow = flatRows[activeIdx]
    const activeParent = (activeRow.post as any).parentId || null
    const oldParentId = activeParent
    const baseLevel = typeof dragProjectedLevel === 'number' ? dragProjectedLevel : activeRow.level
    // Build list without the active row to compute the intended insertion point and parent
    const listWithoutActive = flatRows.filter((r) => r.post.id !== active.id)
    // Adjusted index where to insert (account for removal shift)
    const targetIndex = activeIdx < overIdx ? Math.max(0, overIdx - 1) : overIdx
    // Determine new parentId (strict):
    // - If explicit willNest, drop onto hovered item (preferred to match user intent)
    // - Else if indented to deeper level, infer parent from previous level row
    // - Else keep original parent (pure reorder)
    let newParentId: string | null = null
    if (willNest) {
      const idToParent = new Map<string, string | null>()
      posts.forEach((p: any) => idToParent.set(p.id, p.parentId || null))
      const isDescendant = (candidateParent: string, node: string): boolean => {
        let cur: string | null = idToParent.get(node) ?? null
        while (cur) {
          if (cur === candidateParent) return true
          cur = idToParent.get(cur) ?? null
        }
        return false
      }
      if (!isDescendant(String(over.id), String(active.id))) {
        newParentId = String(over.id)
      } else {
        newParentId = oldParentId
      }
    } else if (baseLevel > activeRow.level) {
      for (let i = targetIndex - 1; i >= 0; i--) {
        const row = listWithoutActive[i]
        if (row && row.level === baseLevel - 1) {
          newParentId = (row.post as any).id
          break
        }
      }
    } else {
      newParentId = oldParentId
    }
    // Prevent self-parenting
    if (newParentId && String(newParentId) === String(active.id)) {
      setDragActiveId(null)
      setDragProjectedLevel(null)
      return
    }
    // Assemble sibling lists for reindexing
    const allPosts = posts
    const oldSiblings = allPosts
      .filter(
        (p: any) =>
          (p.parentId || null) === (oldParentId || null) && String(p.id) !== String(active.id)
      )
      .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((p) => p.id)
    const newSiblingsExisting = allPosts
      .filter(
        (p: any) =>
          (p.parentId || null) === (newParentId || null) && String(p.id) !== String(active.id)
      )
      .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((p) => p.id)
    // Determine insertion index among new parent's siblings based on targetIndex
    let insertionIndex = 0
    if (willNest && String(newParentId || '') === String(over.id)) {
      // Append as last child when nesting onto hovered row
      insertionIndex = newSiblingsExisting.length
    } else {
      const movingDown = activeIdx < overIdx
      const sliceEnd = movingDown ? targetIndex + 1 : targetIndex
      const siblingsBefore = listWithoutActive
        .slice(0, sliceEnd)
        .filter((r) => (r.post.parentId || null) === (newParentId || null))
      insertionIndex = siblingsBefore.length
    }
    const newSiblings = newSiblingsExisting.slice()
    const boundedIndex = Math.max(0, Math.min(insertionIndex, newSiblings.length))
    newSiblings.splice(boundedIndex, 0, String(active.id))
    // Build payload items: reindex old siblings, reindex new siblings (with parent change for active)
    const items: Array<{ id: string; orderIndex: number; parentId?: string | null }> = []
    oldSiblings.forEach((id, idx) => items.push({ id, orderIndex: idx }))
    newSiblings.forEach((id, idx) => {
      if (String(id) === String(active.id)) {
        items.push({ id, orderIndex: idx, parentId: newParentId })
      } else {
        items.push({ id, orderIndex: idx })
      }
    })
    // De-duplicate by last write wins
    const dedupMap = new Map<string, { id: string; orderIndex: number; parentId?: string | null }>()
    for (const it of items) dedupMap.set(String(it.id), it)
    const deduped = Array.from(dedupMap.values())
    // Optimistic UI
    setPosts((prev) =>
      prev.map((p: any) => {
        const f = deduped.find((it) => String(it.id) === String(p.id))
        if (f) {
          const next: any = { ...p, orderIndex: f.orderIndex }
          if (Object.prototype.hasOwnProperty.call(f, 'parentId')) {
            next.parentId = f.parentId ?? null
          }
          return next
        }
        return p
      })
    )
    setDragActiveId(null)
    setDragProjectedLevel(null)
    setWillNest(false)
    // Persist batch with scoped updates per sibling group
    try {
      // If parent changed, reindex old group first
      if (String(oldParentId ?? '') !== String(newParentId ?? '')) {
        const oldItems: Array<{ id: string; orderIndex: number }> = []
        oldSiblings.forEach((id, idx) => oldItems.push({ id, orderIndex: idx }))
        await fetch('/api/posts/reorder', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            scope: { type: postType, locale: locale, parentId: oldParentId },
            items: oldItems,
          }),
        })
      }
      // Then reindex new group (and set parent for moved item)
      const newItems: Array<{ id: string; orderIndex: number; parentId?: string | null }> = []
      newSiblings.forEach((id, idx) => {
        if (String(id) === String(active.id))
          newItems.push({ id, orderIndex: idx, parentId: newParentId })
        else newItems.push({ id, orderIndex: idx })
      })
      await fetch('/api/posts/reorder', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          scope: { type: postType, locale: locale, parentId: newParentId },
          items: newItems,
        }),
      })
      await fetchPosts(false)
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Posts" />

      <AdminHeader title="Posts" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low rounded-lg border border-line-low">
          {/* Posts Header */}
          <div className="px-6 py-4">
            {/* Top right: Create New button */}
            <div className="flex items-center justify-end mb-3">
              {canCreatePost && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-3 py-2 text-sm border border-line-low rounded bg-standout-high text-on-high cursor-pointer"
                >
                  Create New
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search title or slug..."
                  className="px-3 py-1.75 text-sm border border-line-low bg-backdrop-input text-neutral-high"
                />
                <Select
                  defaultValue={status || undefined}
                  onValueChange={(val) => {
                    setStatus(val === 'all' ? '' : val)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="__in_review__">In Review</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="protected">Protected</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={locale || 'all'}
                  onValueChange={(val) => {
                    const next = val === 'all' ? '' : val
                    setLocale(next)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All locales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locales</SelectItem>
                    {supportedLocales.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  defaultValue={postType || undefined}
                  onValueChange={(val) => {
                    setPostType(val === 'all' ? '' : val)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All post types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All post types</SelectItem>
                    {postTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {labelize(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Taxonomy filter */}
                <Select
                  value={taxonomy || 'all'}
                  onValueChange={(val) => {
                    const next = val === 'all' ? '' : val
                    setTaxonomy(next)
                    setTermId('')
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All taxonomies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All taxonomies</SelectItem>
                    {taxonomies.map((t) => (
                      <SelectItem key={t.slug} value={t.slug}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {taxonomy && (
                  <Select
                    value={termId || 'all'}
                    onValueChange={(val) => {
                      setTermId(val === 'all' ? '' : val)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {flatTerms.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <label className="flex items-center gap-2 text-sm text-neutral-high">
                  <Checkbox
                    checked={hasFeedback}
                    onCheckedChange={(c) => {
                      setHasFeedback(!!c)
                      setPage(1)
                    }}
                  />
                  Feedback
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-high">
                  <Checkbox
                    checked={hierarchical}
                    onCheckedChange={(c) => onToggleHierarchy(!!c)}
                  />
                  View hierarchy
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-high">
                  <Checkbox checked={dndMode} onCheckedChange={(c) => onToggleDnd(!!c)} />
                  Reorder
                </label>
              </div>
            </div>
            {/* Bulk actions */}
            <div className="mt-3 flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-medium">
                <Checkbox checked={selectAll} onCheckedChange={() => toggleSelectAll()} />
                Select All
              </label>
              <div className="w-[200px]">
                <Select
                  key={bulkKey}
                  onValueChange={(
                    val:
                      | 'publish'
                      | 'draft'
                      | 'archive'
                      | 'delete'
                      | 'duplicate'
                      | 'regeneratePermalinks'
                      | string
                  ) => {
                    if (val.startsWith('agent:')) {
                      const agentId = val.split(':')[1]
                      const agent = bulkAgents.find((a) => a.id === agentId)
                      if (agent) {
                        setSelectedAgent(agent)
                        setIsAgentModalOpen(true)
                      }
                      return
                    }

                    setPendingBulkAction(val as any)
                    if (val === 'delete') {
                      setConfirmBulkDelete(true)
                    } else {
                      setConfirmBulkAction(true)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Bulk actions..." />
                  </SelectTrigger>
                  <SelectContent>
                    {canPublish && <SelectItem value="publish">Publish</SelectItem>}
                    <SelectItem value="draft">Move to Draft</SelectItem>
                    {canPublish && <SelectItem value="archive">Archive</SelectItem>}
                    {canCreatePost && <SelectItem value="duplicate">Duplicate</SelectItem>}
                    {canPublish && (
                      <SelectItem value="regeneratePermalinks">Regenerate permalinks</SelectItem>
                    )}
                    {canDelete && <SelectItem value="delete">Delete (archived only)</SelectItem>}

                    {bulkAgents.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-neutral-medium border-t border-line-low mt-1">
                          Run Agent
                        </div>
                        {bulkAgents.map((agent) => (
                          <SelectItem key={agent.id} value={`agent:${agent.id}`}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {/* Per page selector */}
              <div className="w-[140px]">
                <Select
                  defaultValue={String(limit)}
                  onValueChange={(val) => {
                    setLimit(Number(val) || 20)
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="20">20 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                    <SelectItem value="100">100 / page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {loading && <span className="text-xs text-neutral-low">Loading...</span>}
            </div>

            {/* Delete confirmation dialog */}
            <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete selected posts?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action deletes archived posts only. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmBulkDelete(false)}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setConfirmBulkDelete(false)
                      applyBulk('delete')
                      setBulkKey((k) => k + 1)
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Generic bulk action confirmation dialog */}
            <AlertDialog open={confirmBulkAction} onOpenChange={setConfirmBulkAction}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {pendingBulkAction === 'publish' && 'Publish selected posts?'}
                    {pendingBulkAction === 'draft' && 'Move selected posts to draft?'}
                    {pendingBulkAction === 'archive' && 'Archive selected posts?'}
                    {pendingBulkAction === 'duplicate' && 'Duplicate selected posts?'}
                    {pendingBulkAction === 'regeneratePermalinks' && 'Regenerate permalinks?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {pendingBulkAction === 'publish' &&
                      `This will publish ${selected.size} post${selected.size === 1 ? '' : 's'}.`}
                    {pendingBulkAction === 'draft' &&
                      `This will move ${selected.size} post${
                        selected.size === 1 ? '' : 's'
                      } to draft status.`}
                    {pendingBulkAction === 'archive' &&
                      `This will archive ${selected.size} post${selected.size === 1 ? '' : 's'}.`}
                    {pendingBulkAction === 'duplicate' &&
                      `This will create ${selected.size} duplicate post${
                        selected.size === 1 ? '' : 's'
                      }.`}
                    {pendingBulkAction === 'regeneratePermalinks' &&
                      `This will regenerate permalinks for ${selected.size} post${
                        selected.size === 1 ? '' : 's'
                      } based on the current URL pattern. If "Auto-redirect on slug change" is enabled, redirects will be created from old URLs to new URLs.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={() => {
                      setConfirmBulkAction(false)
                      setPendingBulkAction(null)
                      setBulkKey((k) => k + 1)
                    }}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setConfirmBulkAction(false)
                      if (pendingBulkAction) {
                        applyBulk(pendingBulkAction)
                      }
                      setPendingBulkAction(null)
                      setBulkKey((k) => k + 1)
                    }}
                  >
                    {pendingBulkAction === 'publish' && 'Publish'}
                    {pendingBulkAction === 'draft' && 'Move to Draft'}
                    {pendingBulkAction === 'archive' && 'Archive'}
                    {pendingBulkAction === 'duplicate' && 'Duplicate'}
                    {pendingBulkAction === 'regeneratePermalinks' && 'Regenerate'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Reorder scope requirement dialog */}
            <AlertDialog open={reorderScopeAlertOpen} onOpenChange={setReorderScopeAlertOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reorder requires a scope</AlertDialogTitle>
                  <AlertDialogDescription>
                    Select a Post Type and Locale to enable Reorder.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogAction onClick={() => setReorderScopeAlertOpen(false)}>
                    OK
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <BulkAgentModal
              open={isAgentModalOpen}
              onOpenChange={setIsAgentModalOpen}
              agent={selectedAgent}
              postIds={Array.from(selected)}
              onSuccess={() => fetchPosts(false)}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[44px]">
                  <Checkbox
                    checked={selectAll}
                    onCheckedChange={() => toggleSelectAll()}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>
                  <button
                    className="hover:underline"
                    onClick={() => {
                      toggleSort('title')
                      setPage(1)
                    }}
                  >
                    Title {sortBy === 'title' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </TableHead>
                <TableHead>Post Type</TableHead>
                {dndMode && (
                  <TableHead>
                    <button
                      className="hover:underline"
                      onClick={() => {
                        toggleSort('order_index' as any)
                        setPage(1)
                      }}
                    >
                      Order {sortBy === 'order_index' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </TableHead>
                )}
                <TableHead>Locales</TableHead>
                <TableHead>
                  <button
                    className="hover:underline"
                    onClick={() => {
                      toggleSort('status')
                      setPage(1)
                    }}
                  >
                    Status {sortBy === 'status' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="hover:underline"
                    onClick={() => {
                      toggleSort('updated_at')
                      setPage(1)
                    }}
                  >
                    Updated {sortBy === 'updated_at' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            {/* Body */}
            {dndMode ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={flatRows.map((r) => r.post.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <TableBody>
                    {flatRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={dndMode ? 8 : 7}>
                          <div className="py-12 text-center">
                            <p className="text-neutral-low">No posts yet.</p>
                            <p className="text-sm text-neutral-low mt-2">
                              Run the seeder to create test posts.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      flatRows.map(({ post, level }) => {
                        const checked = selected.has(post.id)
                        return (
                          <SortableRow key={post.id} id={post.id}>
                            <TableCell>
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleSelect(post.id)}
                                aria-label="Select row"
                              />
                            </TableCell>
                            <TableCell>
                              <div
                                className="flex items-center"
                                style={{ paddingLeft: hierarchical ? level * 12 : 0 }}
                              >
                                {hierarchical && level > 0 && (
                                  <span className="mr-2 text-neutral-medium" aria-hidden="true">
                                    <FontAwesomeIcon
                                      icon={faTurnUp}
                                      rotation={90}
                                      className="inline-block"
                                      size="sm"
                                    />
                                  </span>
                                )}
                                {/* Show intent arrow on the dragged item to indicate it will become a child on drop */}
                                {hierarchical && dragActiveId === post.id && willNest && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="mr-2 text-neutral-medium" aria-hidden="true">
                                        <FontAwesomeIcon
                                          icon={faTurnUp}
                                          rotation={90}
                                          className="inline-block"
                                          size="sm"
                                        />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Will nest on drop</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-sm font-medium text-neutral-high cursor-help">
                                      {post.title}
                                      {post.hasFeedback && (
                                        <FontAwesomeIcon
                                          icon={faMessage}
                                          className="ml-2 text-violet-500 text-[10px]"
                                          title="Feedback"
                                        />
                                      )}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{post.slug}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-neutral-medium">
                                {labelize(post.type)}
                              </span>
                            </TableCell>
                            {dndMode && (
                              <TableCell>
                                <span className="font-mono text-sm text-neutral-medium">
                                  {(post as any).orderIndex ?? 0}
                                </span>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(supportedLocales.length > 1
                                  ? supportedLocales
                                  : [post.locale]
                                ).map((loc) => {
                                  const exists = (post.familyLocales || [post.locale]).includes(loc)
                                  return (
                                    <Tooltip key={`${post.id}-${loc}`}>
                                      <TooltipTrigger asChild>
                                        <Badge variant={exists ? 'default' : 'outline'}>
                                          {loc.toUpperCase()}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          {exists
                                            ? `Has ${loc.toUpperCase()}`
                                            : `Missing ${loc.toUpperCase()}`}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm capitalize">{post.status}</span>
                              {post.hasReviewDraft && (
                                <Badge variant="secondary" className="ml-2 align-middle">
                                  In Review
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-neutral-low">
                                {new Date(post.updatedAt).toLocaleString(undefined, {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Link
                                href={`/admin/posts/${post.id}/edit`}
                                className="px-3 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
                              >
                                Edit
                              </Link>
                            </TableCell>
                          </SortableRow>
                        )
                      })
                    )}
                  </TableBody>
                </SortableContext>
              </DndContext>
            ) : (
              <TableBody>
                {posts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={dndMode ? 8 : 7}>
                      <div className="py-12 text-center">
                        <p className="text-neutral-low">No posts yet.</p>
                        <p className="text-sm text-neutral-low mt-2">
                          Run the seeder to create test posts.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  flatRows.map(({ post, level }) => {
                    const checked = selected.has(post.id)
                    return (
                      <TableRow key={post.id}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleSelect(post.id)}
                            aria-label="Select row"
                          />
                        </TableCell>
                        <TableCell>
                          <div
                            className="flex items-center"
                            style={{ paddingLeft: hierarchical ? level * 12 : 0 }}
                          >
                            {hierarchical && level > 0 && (
                              <span className="mr-2 text-neutral-medium" aria-hidden="true">
                                <FontAwesomeIcon
                                  icon={faTurnUp}
                                  rotation={90}
                                  className="inline-block"
                                  size="sm"
                                />
                              </span>
                            )}
                            <span
                              className="text-sm font-medium text-neutral-high"
                              title={post.slug}
                            >
                              {post.title}
                              {post.hasFeedback && (
                                <FontAwesomeIcon
                                  icon={faMessage}
                                  className="ml-2 text-violet-500 text-[10px]"
                                  title="Feedback"
                                />
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-neutral-medium">{labelize(post.type)}</span>
                        </TableCell>
                        {dndMode && (
                          <TableCell>
                            <span className="font-mono text-sm text-neutral-medium">
                              {(post as any).orderIndex ?? 0}
                            </span>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(supportedLocales.length > 1 ? supportedLocales : [post.locale]).map(
                              (loc) => {
                                const exists = (post.familyLocales || [post.locale]).includes(loc)
                                return (
                                  <Badge
                                    key={`${post.id}-${loc}`}
                                    variant={exists ? 'default' : 'outline'}
                                    title={
                                      exists
                                        ? `Has ${loc.toUpperCase()}`
                                        : `Missing ${loc.toUpperCase()}`
                                    }
                                  >
                                    {loc.toUpperCase()}
                                  </Badge>
                                )
                              }
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm capitalize">{post.status}</span>
                          {post.hasReviewDraft && (
                            <Badge variant="secondary" className="ml-2 align-middle">
                              In Review
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-neutral-low">
                            {new Date(post.updatedAt).toLocaleString(undefined, {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/admin/posts/${post.id}/edit`}
                            className="px-3 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
                          >
                            Edit
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            )}
          </Table>

          {/* Pagination */}
          {!hierarchical && (
            <div className="px-6 py-3 flex items-center justify-between text-sm">
              <div className="text-neutral-medium">
                {total > 0 ? (
                  <>
                    Showing {total === 0 ? 0 : (page - 1) * limit + 1}–
                    {Math.min(page * limit, total)} of {total}
                  </>
                ) : (
                  <>No results</>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 border border-line-low rounded disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </button>
                <span className="px-2">{page}</span>
                <button
                  className="px-2 py-1 border border-line-low rounded disabled:opacity-50"
                  onClick={() => {
                    const totalPages = Math.max(1, Math.ceil(total / limit))
                    setPage((p) => Math.min(totalPages, p + 1))
                  }}
                  disabled={page >= Math.max(1, Math.ceil(total / limit))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <AdminFooter />

      {/* Create New Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setIsCreateOpen(false)
              setCreateStep('type')
              setSelectedPostType(null)
            }}
          />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-line-low bg-backdrop-input p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-neutral-high">
                {createStep === 'type' ? 'Create New Post' : 'Select Template'}
              </h3>
              <button
                className="text-neutral-medium hover:text-neutral-high"
                onClick={() => {
                  setIsCreateOpen(false)
                  setCreateStep('type')
                  setSelectedPostType(null)
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {createStep === 'type' ? (
              <>
                <p className="text-sm text-neutral-medium mb-3">Choose a post type:</p>
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-auto">
                  {postTypes.length === 0 && (
                    <div className="text-sm text-neutral-low">No post types available.</div>
                  )}
                  {postTypes.map((t) => (
                    <button
                      key={t}
                      disabled={fetchingTemplates}
                      className="w-full text-left px-3 py-2 rounded border border-line-low bg-backdrop-input hover:bg-backdrop-medium text-neutral-high disabled:opacity-50"
                      onClick={() => handleTypeSelect(t)}
                    >
                      {labelize(t)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-neutral-medium mb-3">
                  Select a template for your new{' '}
                  {selectedPostType ? labelize(selectedPostType) : 'post'}:
                </p>
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-auto">
                  {availableTemplates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      className="w-full text-left px-3 py-2 rounded border border-line-low bg-backdrop-input hover:bg-backdrop-medium text-neutral-high flex items-center justify-between"
                      onClick={() => {
                        setIsCreateOpen(false)
                        createNew(selectedPostType!, tmpl.id)
                        setCreateStep('type')
                      }}
                    >
                      <span>
                        {labelize(
                          tmpl.isDefault ? tmpl.name.replace(/[-_ ]?default$/i, '') : tmpl.name
                        )}
                        {tmpl.isDefault && (
                          <span className="ml-1.5 text-neutral-low text-xs">(default)</span>
                        )}
                      </span>
                    </button>
                  ))}
                  <button
                    className="w-full text-left px-3 py-2 rounded border border-line-dashed bg-transparent hover:bg-backdrop-medium text-neutral-medium italic"
                    onClick={() => {
                      setIsCreateOpen(false)
                      createNew(selectedPostType!)
                      setCreateStep('type')
                    }}
                  >
                    No template (blank post)
                  </button>
                </div>
                <div className="mt-4 flex justify-start">
                  <button
                    className="text-xs text-neutral-low hover:underline"
                    onClick={() => setCreateStep('type')}
                  >
                    ← Back to post types
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
