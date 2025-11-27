import { Head, Link, usePage } from '@inertiajs/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTurnUp } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useState } from 'react'
import { AdminHeader } from '../components/AdminHeader'
import { AdminFooter } from '../components/AdminFooter'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { Checkbox } from '~/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Badge } from '~/components/ui/badge'
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
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, DragEndEvent, DragStartEvent, DragMoveEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface DashboardProps { }

export default function Dashboard({ }: DashboardProps) {
  const inertiaPage = usePage()
  const role: string | undefined =
    (inertiaPage.props as any)?.currentUser?.role ??
    (inertiaPage.props as any)?.auth?.user?.role
  const isAdmin = role === 'admin'
  const isEditor = role === 'editor'
  const [posts, setPosts] = useState<Array<{ id: string; title: string; slug: string; status: string; locale: string; updatedAt: string; parentId?: string | null; translationOfId?: string | null; familyLocales?: string[]; hasReviewDraft?: boolean }>>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('')
  const [locale, setLocale] = useState<string>('')
  const [postType, setPostType] = useState<string>('')
  const [postTypes, setPostTypes] = useState<string[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'title' | 'slug' | 'status' | 'locale' | 'updated_at' | 'created_at' | 'order_index'>('updated_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [bulkKey, setBulkKey] = useState(0)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [hierarchical, setHierarchical] = useState(false)
  const [dndMode, setDndMode] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const INDENT_PX = 24
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)
  const [dragBaseLevel, setDragBaseLevel] = useState<number>(0)
  const [dragProjectedLevel, setDragProjectedLevel] = useState<number | null>(null)
  // Profile CTA moved to Dashboard page

  // CSRF token for API calls
  const xsrfFromCookie: string | undefined = (() => {
    if (typeof document === 'undefined') return undefined
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : undefined
  })()

  async function fetchPosts() {
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
      const list: Array<{ id: string; title: string; slug: string; status: string; locale: string; updatedAt: string; parentId?: string | null; translationOfId?: string | null; familyLocales?: string[]; hasReviewDraft?: boolean }> =
        Array.isArray(json?.data) ? json.data : []
      setPosts(list)
      setTotal(Number(json?.meta?.total || list.length || 0))
      // Reset selection when list changes
      setSelected(new Set())
      setSelectAll(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, locale, postType, sortBy, sortOrder, page, limit, hierarchical])

  // Profile status removed here

  useEffect(() => {
    ; (async () => {
      const res = await fetch('/api/post-types', { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      const list: string[] = Array.isArray(json?.data) ? json.data : []
      setPostTypes(list)
    })()
  }, [])

  // Supported locales for translation progress
  const [supportedLocales, setSupportedLocales] = useState<string[]>([])
  useEffect(() => {
    ; (async () => {
      try {
        const res = await fetch('/api/locales', { credentials: 'same-origin' })
        const json = await res.json().catch(() => ({}))
        const list: Array<{ code: string; isEnabled?: boolean; is_enabled?: boolean }> = Array.isArray(json?.data) ? json.data : []
        const enabled = list
          .filter((l) => (l as any).isEnabled === true || (l as any).is_enabled === true || (l as any).isEnabled === undefined)
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

  async function createNew(typeArg?: string) {
    const type = typeArg || postType || (postTypes[0] || '').toString()
    if (!type) {
      alert('Select a post type first')
      return
    }
    const slug = `untitled-${type}-${Date.now()}`
    const title = `Untitled ${type.charAt(0).toUpperCase() + type.slice(1)}`
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
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
      }),
    })
    if (res.ok) {
      const json = await res.json().catch(() => ({}))
      const id = json?.data?.id
      if (id) {
        window.location.href = `/admin/posts/${id}/edit`
        return
      }
    }
    alert('Failed to create post')
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

  async function applyBulk(action: 'publish' | 'draft' | 'archive' | 'delete' | 'duplicate') {
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
      await fetchPosts()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err?.error || 'Bulk action failed')
    }
  }

  function toggleSort(column: typeof sortBy) {
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
    const out: Array<{ post: typeof posts[number]; level: number }> = []
    const sortKids = (arr: typeof posts) => {
      const copy = arr.slice()
      // In reorder mode, always use order_index ascending for stable handles
      if (dndMode) {
        return copy.sort((a: any, b: any) => ((a.orderIndex ?? 0) - (b.orderIndex ?? 0)))
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
          case 'slug': {
            return a.slug.localeCompare(b.slug) * factor
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
    function dfs(node: typeof posts[number], level: number) {
      out.push({ post: node, level })
      const kids = sortKids(idToChildren.get(node.id) || [])
      kids.forEach((c) => dfs(c, level + 1))
    }
    rootsSorted.forEach((r) => dfs(r, 0))
    return out
  }, [posts, hierarchical, dndMode, sortBy, sortOrder])

  function onToggleDnd(enabled: boolean) {
    setDndMode(enabled)
    if (enabled) {
      // Reorder requires hierarchy
      if (!hierarchical) {
        setHierarchical(true)
        setPage(1)
      }
      // Prefer order-index ascending for meaningful DnD
      if (sortBy !== 'order_index') setSortBy('order_index' as any)
      if (sortOrder !== 'asc') setSortOrder('asc')
    }
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
  }

  function handleDragMove(ev: DragMoveEvent) {
    if (!dragActiveId) return
    const dx = ev.delta.x || 0
    const change = Math.round(dx / INDENT_PX)
    const next = Math.max(0, dragBaseLevel + change)
    setDragProjectedLevel(next)
  }

  async function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev
    if (!over || active.id === over.id) return
    const activeIdx = flatRows.findIndex((r) => r.post.id === active.id)
    const overIdx = flatRows.findIndex((r) => r.post.id === over.id)
    if (activeIdx < 0 || overIdx < 0) return
    const activeRow = flatRows[activeIdx]
    const activeParent = (activeRow.post as any).parentId || null
    const baseLevel = typeof dragProjectedLevel === 'number' ? dragProjectedLevel : activeRow.level
    // Build list without the active row to compute the intended insertion point and parent
    const listWithoutActive = flatRows.filter((r) => r.post.id !== active.id)
    // Adjusted index where to insert (account for removal shift)
    const targetIndex = activeIdx < overIdx ? Math.max(0, overIdx - 1) : overIdx
    // Determine new parentId from projected level: look backwards for level-1
    let newParentId: string | null = null
    if (baseLevel > 0) {
      for (let i = targetIndex - 1; i >= 0; i--) {
        const row = listWithoutActive[i]
        if (row && row.level === baseLevel - 1) {
          newParentId = (row.post as any).id
          break
        }
      }
    }
    // Prevent self-parenting
    if (newParentId && String(newParentId) === String(active.id)) {
      setDragActiveId(null); setDragProjectedLevel(null)
      return
    }
    const oldParentId = activeParent
    // Determine insertion index among new parent's siblings based on targetIndex
    const siblingsBefore = listWithoutActive
      .slice(0, targetIndex)
      .filter((r) => (((r.post as any).parentId || null) === (newParentId || null)))
    const insertionIndex = siblingsBefore.length
    // Assemble sibling lists for reindexing
    const allPosts = posts
    const oldSiblings = allPosts
      .filter((p: any) => ((p.parentId || null) === (oldParentId || null)) && String(p.id) !== String(active.id))
      .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((p) => p.id)
    const newSiblingsExisting = allPosts
      .filter((p: any) => ((p.parentId || null) === (newParentId || null)) && String(p.id) !== String(active.id))
      .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map((p) => p.id)
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
          if ((f as any).hasOwnProperty('parentId')) {
            next.parentId = f.parentId ?? null
          }
          return next
        }
        return p
      })
    )
    setDragActiveId(null); setDragProjectedLevel(null)
    // Persist batch
    try {
      await fetch('/api/posts/reorder', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ items: deduped }),
      })
      // Refresh to ensure consistent ordering from backend
      await fetchPosts()
    } catch {
      // Ignore; fetchPosts will re-sync on next reload
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-low">
      <Head title="Posts" />

      <AdminHeader title="Posts" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low rounded-lg shadow">
          {/* Posts Header */}
          <div className="px-6 py-4">
            {/* Top right: Create New button */}
            <div className="flex items-center justify-end mb-3">
              {(isAdmin || isEditor) && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-3 py-2 text-sm border border-line rounded bg-standout text-on-standout cursor-pointer"
                >
                  Create New
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search title or slug..."
                  className="px-3 py-1.75 text-sm border border-line bg-backdrop-low text-neutral-high"
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
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  defaultValue={locale || undefined}
                  onValueChange={(val) => {
                    setLocale(val === 'all' ? '' : val)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All locales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locales</SelectItem>
                    <SelectItem value="en">EN</SelectItem>
                    <SelectItem value="es">ES</SelectItem>
                    <SelectItem value="fr">FR</SelectItem>
                    <SelectItem value="pt">PT</SelectItem>
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
                      <SelectItem key={t} value={t}>{labelize(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm text-neutral-high">
                  <Checkbox
                    checked={hierarchical}
                    onCheckedChange={(c) => onToggleHierarchy(!!c)}
                  />
                  View hierarchy
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-high">
                  <Checkbox
                    checked={dndMode}
                    onCheckedChange={(c) => onToggleDnd(!!c)}
                  />
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
                  onValueChange={(val: 'publish' | 'draft' | 'archive' | 'delete' | 'duplicate') => {
                    if (val === 'delete') {
                      setConfirmBulkDelete(true)
                    } else {
                      applyBulk(val)
                      setBulkKey((k) => k + 1)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Bulk actions..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(isAdmin || isEditor) && <SelectItem value="publish">Publish</SelectItem>}
                    <SelectItem value="draft">Move to Draft</SelectItem>
                    {(isAdmin || isEditor) && <SelectItem value="archive">Archive</SelectItem>}
                    {(isAdmin || isEditor) && <SelectItem value="duplicate">Duplicate</SelectItem>}
                    {isAdmin && <SelectItem value="delete">Delete (archived only)</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {/* Per page selector moved next to Bulk Actions */}
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
            <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete selected posts?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action deletes archived posts only. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmBulkDelete(false)}>Cancel</AlertDialogCancel>
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
                  <button className="hover:underline" onClick={() => { toggleSort('title'); setPage(1) }}>
                    Title {sortBy === 'title' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </TableHead>
                <TableHead>
                  <button className="hover:underline" onClick={() => { toggleSort('slug'); setPage(1) }}>
                    Slug {sortBy === 'slug' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </TableHead>
                <TableHead>
                  <button className="hover:underline" onClick={() => { toggleSort('order_index' as any); setPage(1) }}>
                    Order {sortBy === 'order_index' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </TableHead>
                <TableHead>Locales</TableHead>
                <TableHead>
                  <button className="hover:underline" onClick={() => { toggleSort('status'); setPage(1) }}>
                    Status {sortBy === 'status' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </TableHead>
                <TableHead>
                  <button className="hover:underline" onClick={() => { toggleSort('updated_at'); setPage(1) }}>
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
                        <TableCell colSpan={7}>
                          <div className="py-12 text-center">
                            <p className="text-neutral-low">No posts yet.</p>
                            <p className="text-sm text-neutral-low mt-2">Run the seeder to create test posts.</p>
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
                              <div className="flex items-center" style={{ paddingLeft: hierarchical ? level * 12 : 0 }}>
                                {hierarchical && level > 0 && (
                                  <span className="mr-2 text-neutral-medium" aria-hidden="true">
                                    <FontAwesomeIcon icon={faTurnUp} rotation={90} className="inline-block" size="sm" />
                                  </span>
                                )}
                                <span className="text-sm font-medium text-neutral-high">{post.title}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-sm text-neutral-medium">{post.slug}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-sm text-neutral-medium">{(post as any).orderIndex ?? 0}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(supportedLocales.length > 1 ? supportedLocales : [post.locale]).map((loc) => {
                                  const exists = (post.familyLocales || [post.locale]).includes(loc)
                                  return (
                                    <Badge
                                      key={`${post.id}-${loc}`}
                                      variant={exists ? 'default' : 'outline'}
                                      title={exists ? `Has ${loc.toUpperCase()}` : `Missing ${loc.toUpperCase()}`}
                                    >
                                      {loc.toUpperCase()}
                                    </Badge>
                                  )
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm capitalize">{post.status}</span>
                              {post.hasReviewDraft && <Badge variant="secondary" className="ml-2 align-middle">In Review</Badge>}
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
                                className="px-3 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium"
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
              {(hierarchical ? posts.length === 0 : posts.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="py-12 text-center">
                      <p className="text-neutral-low">No posts yet.</p>
                      <p className="text-sm text-neutral-low mt-2">Run the seeder to create test posts.</p>
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
                        <div className="flex items-center" style={{ paddingLeft: hierarchical ? level * 12 : 0 }}>
                          {hierarchical && level > 0 && (
                            <span className="mr-2 text-neutral-medium" aria-hidden="true">
                              <FontAwesomeIcon icon={faTurnUp} rotation={90} className="inline-block" size="sm" />
                            </span>
                          )}
                          <span className="text-sm font-medium text-neutral-high">{post.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-neutral-medium">{post.slug}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-neutral-medium">{(post as any).orderIndex ?? 0}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(supportedLocales.length > 1 ? supportedLocales : [post.locale]).map((loc) => {
                            const exists = (post.familyLocales || [post.locale]).includes(loc)
                            return (
                              <Badge
                                key={`${post.id}-${loc}`}
                                variant={exists ? 'default' : 'outline'}
                                title={exists ? `Has ${loc.toUpperCase()}` : `Missing ${loc.toUpperCase()}`}
                              >
                                {loc.toUpperCase()}
                              </Badge>
                            )
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{post.status}</span>
                        {post.hasReviewDraft && <Badge variant="secondary" className="ml-2 align-middle">In Review</Badge>}
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
                          className="px-3 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium"
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
                  <>Showing {(total === 0 ? 0 : (page - 1) * limit + 1)}–{Math.min(page * limit, total)} of {total}</>
                ) : (
                  <>No results</>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 border border-line rounded disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </button>
                <span className="px-2">{page}</span>
                <button
                  className="px-2 py-1 border border-line rounded disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsCreateOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-line bg-backdrop-low p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-neutral-high">Create New Post</h3>
              <button
                className="text-neutral-medium hover:text-neutral-high"
                onClick={() => setIsCreateOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-neutral-medium mb-3">Choose a post type:</p>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-auto">
              {postTypes.length === 0 && (
                <div className="text-sm text-neutral-low">No post types available.</div>
              )}
              {postTypes.map((t) => (
                <button
                  key={t}
                  className="w-full text-left px-3 py-2 rounded border border-line bg-backdrop-low hover:bg-backdrop-medium text-neutral-high"
                  onClick={() => {
                    setIsCreateOpen(false)
                    createNew(t)
                  }}
                >
                  {labelize(t)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


