import { useEffect, useMemo, useRef, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { toast } from 'sonner'
import { Checkbox } from '../../../components/ui/checkbox'
import { CustomFieldRenderer } from '../../components/CustomFieldRenderer'
import type { CustomFieldDefinition } from '~/types/custom_field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog'
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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTurnUp } from '@fortawesome/free-solid-svg-icons'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Pencil, Trash2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'

type Menu = {
  id: string
  name: string
  slug: string
  locale?: string | null
  createdAt: string
  updatedAt: string
}
type MenuItem = {
  id: string
  parentId: string | null
  orderIndex: number
  label: string
  type: 'post' | 'custom' | 'dynamic'
  kind?: 'item' | 'section'
  postId?: string | null
  customUrl?: string | null
  anchor?: string | null
  target?: string | null
  rel?: string | null
  dynamicPostType?: string | null
  dynamicParentId?: string | null
  dynamicDepthLimit?: number | null
}

export default function MenusIndex() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [loadingMenus, setLoadingMenus] = useState(false)
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuLocale, setMenuLocale] = useState<string | null>(null)
  const [editingLocale, setEditingLocale] = useState<string>('en')
  const [selectedMenuSlug, setSelectedMenuSlug] = useState<string>('')
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

  const [menuTemplate, setMenuTemplate] = useState<string | null>(null)
  const [menuMeta, setMenuMeta] = useState<Record<string, any>>({})
  const [templates, setTemplates] = useState<
    Array<{
      slug: string
      name: string
      description?: string
      fields?: CustomFieldDefinition[]
    }>
  >([])
  const [savingMenuMeta, setSavingMenuMeta] = useState<boolean>(false)
  const xsrfFromCookie: string | undefined = (() => {
    if (typeof document === 'undefined') return undefined
    const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : undefined
  })()

  // Menus are code-defined; creation/deletion UI removed

  // Add item form
  const [addType, setAddType] = useState<'post' | 'custom' | 'dynamic'>('post')
  const [addLabel, setAddLabel] = useState('')
  const [overrideLabel, setOverrideLabel] = useState<boolean>(false)
  const [addParentId, setAddParentId] = useState<string>('__ROOT__')
  const [postQuery, setPostQuery] = useState('')
  const [postResults, setPostResults] = useState<
    Array<{ id: string; title: string; slug: string; locale: string }>
  >([])
  const [selectedPostId, setSelectedPostId] = useState<string>('')
  const [selectedPostLabel, setSelectedPostLabel] = useState<string>('') // for display (e.g., "Title (en)")
  const [selectedPostTitle, setSelectedPostTitle] = useState<string>('') // plain title for auto-label
  const [postPickerOpen, setPostPickerOpen] = useState<boolean>(false)
  const [postLoading, setPostLoading] = useState<boolean>(false)
  const searchTimerRef = useRef<number | null>(null)
  const [customUrl, setCustomUrl] = useState<string>('')
  const [extra, setExtra] = useState<string>('') // additional field (anchor, tokens, etc.)
  const [target, setTarget] = useState<string>('default') // dropdown: 'default', _self, _blank, _parent, _top
  const [relOptions, setRelOptions] = useState<{ [key: string]: boolean }>({
    nofollow: false,
    noopener: false,
    noreferrer: false,
    external: false,
  })
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false)
  const [dynamicPostType, setDynamicPostType] = useState<string>('')
  const [dynamicParentId, setDynamicParentId] = useState<string>('')
  const [dynamicDepthLimit, setDynamicDepthLimit] = useState<number>(1)

  // Reorder (always enabled)
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const [dragBaseLevel, setDragBaseLevel] = useState<number>(0)
  const [dragProjectedLevel, setDragProjectedLevel] = useState<number | null>(null)
  const [willNest, setWillNest] = useState<boolean>(false)
  const [nestFlashId, setNestFlashId] = useState<string | null>(null)
  const INDENT_PX = 40
  // Edit dialog state
  const [editOpen, setEditOpen] = useState<boolean>(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [editLabel, setEditLabel] = useState<string>('')
  const [editType, setEditType] = useState<'post' | 'custom' | 'dynamic' | 'section'>('custom')
  const [editCustomUrl, setEditCustomUrl] = useState<string>('')
  const [editPostPickerOpen, setEditPostPickerOpen] = useState<boolean>(false)
  const [editPostQuery, setEditPostQuery] = useState<string>('')
  const [editPostResults, setEditPostResults] = useState<
    Array<{ id: string; title: string; slug: string; locale: string }>
  >([])
  const [editSelectedPostId, setEditSelectedPostId] = useState<string>('')
  const [editSelectedPostTitle, setEditSelectedPostTitle] = useState<string>('')
  const [editExtra, setEditExtra] = useState<string>('')
  const [editTarget, setEditTarget] = useState<string>('default')
  const [editRelOptions, setEditRelOptions] = useState<{ [key: string]: boolean }>({
    nofollow: false,
    noopener: false,
    noreferrer: false,
    external: false,
  })
  const [editDynamicPostType, setEditDynamicPostType] = useState<string>('')
  const [editDynamicParentId, setEditDynamicParentId] = useState<string>('')
  const [editDynamicDepthLimit, setEditDynamicDepthLimit] = useState<number>(1)
  const [savingEdit, setSavingEdit] = useState<boolean>(false)
  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false)
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null)
  const [deleting, setDeleting] = useState<boolean>(false)

  async function loadMenus() {
    setLoadingMenus(true)
    try {
      const res = await fetch('/api/menus', { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      const list: Menu[] = Array.isArray(j?.data) ? j.data : []
      setMenus(list)
      if (!selectedMenuId && list.length) {
        setSelectedMenuId(list[0].id)
        setSelectedMenuSlug(list[0].slug || '')
      }
    } finally {
      setLoadingMenus(false)
    }
  }

  async function loadMenu(id: string, locale?: string) {
    const params = new URLSearchParams()
    if (locale) params.set('locale', locale)
    const res = await fetch(`/api/menus/${encodeURIComponent(id)}?${params.toString()}`, {
      credentials: 'same-origin',
    })
    const j = await res.json().catch(() => ({}))
    const items: MenuItem[] = Array.isArray(j?.data?.items) ? j.data.items : []
    setMenuItems(items)
    const loc = (j?.data?.locale as string | null) ?? null
    const editLoc = (j?.data?.editingLocale as string | null) ?? (loc || 'en')
    setMenuLocale(loc)
    setEditingLocale(editLoc)
    const slugFromApi = (j?.data?.slug as string | undefined) || undefined
    if (slugFromApi) {
      setSelectedMenuSlug(slugFromApi)
    } else {
      const fallbackSlug = menus.find((m) => m.id === id)?.slug || ''
      setSelectedMenuSlug(fallbackSlug)
    }
    setMenuTemplate((j?.data?.template as string | null) ?? null)
    setMenuMeta((j?.data?.meta as Record<string, any>) ?? {})
  }

  useEffect(() => {
    loadMenus()
  }, [])
  useEffect(() => {
    if (selectedMenuId) loadMenu(selectedMenuId)
  }, [selectedMenuId])
  useEffect(() => {
    ; (async () => {
      try {
        const res = await fetch('/api/menu-templates', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        const list: Array<any> = Array.isArray(j?.data) ? j.data : []
        setTemplates(
          list.map((t) => ({
            slug: String(t.slug),
            name: String(t.name || t.slug),
            description: t.description ? String(t.description) : undefined,
            fields: Array.isArray(t.fields) ? t.fields : [],
          }))
        )
      } catch {
        setTemplates([])
      }
    })()
  }, [])
  // (no create/delete menu logic)

  // Post search for item add
  const [searchAllLocales, setSearchAllLocales] = useState<boolean>(false)
  async function searchPostsImmediate(query: string) {
    setPostLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      params.set('limit', '20')
      params.set('status', 'published')
      params.set('hasPermalinks', '1')
      params.set('sortBy', 'updated_at')
      params.set('sortOrder', 'desc')
      if (!searchAllLocales && menuLocale) params.set('locale', menuLocale)
      const res = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      const list = Array.isArray(j?.data) ? j.data : []
      let mapped = list.map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        locale: p.locale,
      }))
      if (mapped.length === 0 && !searchAllLocales && menuLocale) {
        const params2 = new URLSearchParams()
        if (query) params2.set('q', query)
        params2.set('limit', '20')
        params2.set('status', 'published')
        params2.set('hasPermalinks', '1')
        params2.set('sortBy', 'updated_at')
        params2.set('sortOrder', 'desc')
        const res2 = await fetch(`/api/posts?${params2.toString()}`, { credentials: 'same-origin' })
        const j2 = await res2.json().catch(() => ({}))
        const list2 = Array.isArray(j2?.data) ? j2.data : []
        mapped = list2.map((p: any) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          locale: p.locale,
        }))
      }
      setPostResults(mapped)
    } finally {
      setPostLoading(false)
    }
  }
  function debouncedSearchPosts(query: string) {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
    searchTimerRef.current = window.setTimeout(() => {
      searchPostsImmediate(query)
    }, 250)
  }
  useEffect(() => {
    if (!postPickerOpen) return
    // initial load when opening the picker (recent posts)
    searchPostsImmediate(postQuery || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postPickerOpen, editingLocale])

  async function addItem() {
    if (!selectedMenuId) return
    // Label resolution with override support
    let finalLabel = ''
    if (addType === 'post') {
      finalLabel = overrideLabel
        ? addLabel.trim() || selectedPostTitle || ''
        : selectedPostTitle || ''
    } else {
      finalLabel = addLabel.trim()
    }
    if (!finalLabel) {
      toast.error('Label is required')
      return
    }
    const parentId = addParentId === '__ROOT__' ? null : addParentId
    const relString =
      Object.keys(relOptions)
        .filter((k) => relOptions[k])
        .join(' ') || null
    const payload: any = {
      type: addType,
      label: finalLabel,
      parentId,
      locale: editingLocale,
      anchor: extra || null,
      target: target === 'default' ? null : target,
      rel: relString,
    }
    if (addType === 'post') {
      if (!selectedPostId) {
        toast.error('Select a post')
        return
      }
      payload.postId = selectedPostId
    } else if (addType === 'custom') {
      if (!customUrl.trim()) {
        toast.error('Enter a URL')
        return
      }
      payload.customUrl = customUrl.trim()
    } else if (addType === 'dynamic') {
      if (!dynamicPostType) {
        toast.error('Select a post type')
        return
      }
      payload.dynamicPostType = dynamicPostType
      payload.dynamicParentId = dynamicParentId || null
      payload.dynamicDepthLimit = dynamicDepthLimit
    } else if (addType === 'section') {
      payload.kind = 'section'
    }
    const res = await fetch(`/api/menus/${encodeURIComponent(selectedMenuId)}/items`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j?.error || 'Add failed')
      return
    }
    setAddLabel('')
    setSelectedPostId('')
    setCustomUrl('')
    setExtra('')
    setTarget('default')
    setRelOptions({ nofollow: false, noopener: false, noreferrer: false, external: false })
    setDynamicPostType('')
    setDynamicParentId('')
    setDynamicDepthLimit(1)
    await loadMenu(selectedMenuId, editingLocale)
    toast.success('Item added')
  }

  const flatRows = useMemo(() => {
    if (!menuItems.length) return [] as Array<{ item: MenuItem; level: number }>
    const idToChildren = new Map<string, MenuItem[]>()
    const roots: MenuItem[] = []
    menuItems.forEach((it) => {
      const pid = it.parentId || null
      if (pid) {
        if (!idToChildren.has(pid)) idToChildren.set(pid, [])
        idToChildren.get(pid)!.push(it)
      } else {
        roots.push(it)
      }
    })
    const out: Array<{ item: MenuItem; level: number }> = []
    const sortKids = (arr: MenuItem[]) => arr.slice().sort((a, b) => a.orderIndex - b.orderIndex)
    const dfs = (node: MenuItem, level: number) => {
      out.push({ item: node, level })
      const kids = sortKids(idToChildren.get(node.id) || [])
      kids.forEach((c) => dfs(c, level + 1))
    }
    sortKids(roots).forEach((r) => dfs(r, 0))
    return out
  }, [menuItems])

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
    const idx = flatRows.findIndex((r) => r.item.id === id)
    setDragBaseLevel(idx >= 0 ? flatRows[idx].level : 0)
    setDragProjectedLevel(null)
    setWillNest(false)
    setNestFlashId(null)
  }

  function handleDragMove(ev: DragMoveEvent) {
    if (!dragActiveId) return
    const dx = ev.delta.x || 0
    const change = Math.round(dx / INDENT_PX)
    const next = Math.max(0, dragBaseLevel + change)
    setDragProjectedLevel(next)
    const overId = ev.over ? String(ev.over.id) : null
    if (!overId || overId === dragActiveId) return setWillNest(false)
    setWillNest(change >= 1)
  }

  async function handleDragEnd(ev: DragEndEvent) {
    const activeId = String(ev.active.id)
    const overId = ev.over ? String(ev.over.id) : null
    if (!overId || activeId === overId) {
      setDragActiveId(null)
      setDragProjectedLevel(null)
      return
    }
    const activeIdx = flatRows.findIndex((r) => r.item.id === activeId)
    const overIdx = flatRows.findIndex((r) => r.item.id === overId)
    if (activeIdx < 0 || overIdx < 0) {
      setDragActiveId(null)
      setDragProjectedLevel(null)
      return
    }
    const activeRow = flatRows[activeIdx]
    const activeParent = activeRow.item.parentId ?? null
    const baseLevel = typeof dragProjectedLevel === 'number' ? dragProjectedLevel : activeRow.level
    const listWithoutActive = flatRows.filter((r) => r.item.id !== activeId)
    const targetIndex = activeIdx < overIdx ? Math.max(0, overIdx - 1) : overIdx
    // Helper: prevent creating cycles
    const idToParent = new Map<string, string | null>()
    menuItems.forEach((it) => idToParent.set(it.id, it.parentId ?? null))
    const isDescendant = (candidateParent: string, node: string): boolean => {
      let cur: string | null = idToParent.get(node) ?? null
      while (cur) {
        if (cur === candidateParent) return true
        cur = idToParent.get(cur) ?? null
      }
      return false
    }
    let newParentId: string | null = null
    // 1) Explicit nest intent (arrow shown): hovered row wins
    if (willNest) {
      if (!isDescendant(activeId, overId!)) {
        newParentId = overId
      } else {
        newParentId = activeParent
      }
    } else if (baseLevel > activeRow.level) {
      // 2) Indent-based inference when dragged deeper
      for (let i = targetIndex - 1; i >= 0; i--) {
        const row = listWithoutActive[i]
        if (row && row.level === baseLevel - 1) {
          newParentId = row.item.id
          break
        }
      }
    } else {
      // 3) Pure reorder at same depth
      newParentId = activeParent
    }
    if (newParentId && String(newParentId) === String(activeId)) {
      setDragActiveId(null)
      setDragProjectedLevel(null)
      return
    }
    const all = menuItems
    const oldSiblings = all
      .filter(
        (it) =>
          (it.parentId ?? null) === (activeParent ?? null) && String(it.id) !== String(activeId)
      )
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((it) => it.id)
    const newSiblingsExisting = all
      .filter(
        (it) =>
          (it.parentId ?? null) === (newParentId ?? null) && String(it.id) !== String(activeId)
      )
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((it) => it.id)
    let insertionIndex: number
    if (willNest && String(newParentId || '') === String(overId || '')) {
      // Dropped onto row: append as last child of the hovered item
      insertionIndex = newSiblingsExisting.length
    } else {
      const movingDown = activeIdx < overIdx
      const sliceEnd = movingDown ? targetIndex + 1 : targetIndex
      const siblingsBefore = listWithoutActive
        .slice(0, sliceEnd)
        .filter((r) => (r.item.parentId ?? null) === (newParentId ?? null))
        .map((r) => r.item.id)
      insertionIndex = Math.min(newSiblingsExisting.length, Math.max(0, siblingsBefore.length))
    }
    const newSiblings = newSiblingsExisting.slice()
    newSiblings.splice(insertionIndex, 0, activeId)
    // Optimistic UI update (avoid snap)
    setMenuItems((prev) => {
      return prev.map((it) => {
        if (String(it.id) === String(activeId)) {
          return { ...it, parentId: newParentId, orderIndex: newSiblings.indexOf(it.id) }
        }
        if ((it.parentId ?? null) === (activeParent ?? null)) {
          const idx = oldSiblings.indexOf(it.id)
          if (idx >= 0) return { ...it, orderIndex: idx }
        }
        if ((it.parentId ?? null) === (newParentId ?? null)) {
          const idx = newSiblings.indexOf(it.id)
          if (idx >= 0) return { ...it, orderIndex: idx }
        }
        return it
      })
    })
    try {
      if (String(activeParent ?? '') !== String(newParentId ?? '')) {
        const oldItems: Array<{ id: string; orderIndex: number }> = []
        oldSiblings.forEach((id, idx) => oldItems.push({ id, orderIndex: idx }))
        await fetch(`/api/menus/${encodeURIComponent(selectedMenuId || '')}/reorder`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            scope: { menuId: selectedMenuId, parentId: activeParent, locale: editingLocale },
            items: oldItems,
          }),
        })
      }
      const newItems: Array<{ id: string; orderIndex: number; parentId?: string | null }> = []
      newSiblings.forEach((id, idx) => {
        if (String(id) === String(activeId))
          newItems.push({ id, orderIndex: idx, parentId: newParentId })
        else newItems.push({ id, orderIndex: idx })
      })
      await fetch(`/api/menus/${encodeURIComponent(selectedMenuId || '')}/reorder`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          scope: { menuId: selectedMenuId, parentId: newParentId, locale: editingLocale },
          items: newItems,
        }),
      })
      // Brief confirmation flash on the moved item when nesting occurred
      if (willNest && String(newParentId || '') === String(overId || '')) {
        setNestFlashId(activeId)
        window.setTimeout(() => setNestFlashId(null), 800)
      }
      await loadMenu(selectedMenuId!, editingLocale)
    } finally {
      setDragActiveId(null)
      setDragProjectedLevel(null)
      setWillNest(false)
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Menus" />
      <AdminHeader title="Menus" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low rounded-lg p-4 border border-line-low">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: Menus list and create */}
            <div className="md:col-span-1">
              <div className="mb-3 text-sm font-medium text-neutral-high">Menus</div>
              {loadingMenus ? (
                <div className="text-sm text-neutral-medium">Loading…</div>
              ) : (
                <div className="space-y-2">
                  {menus.map((m) => (
                    <button
                      key={m.id}
                      className={`w-full text-left px-3 py-2 border border-line-low rounded ${selectedMenuId === m.id ? 'bg-backdrop-medium' : 'hover:bg-backdrop-medium'}`}
                      onClick={() => {
                        setSelectedMenuId(m.id)
                        setSelectedMenuSlug(m.slug || '')
                      }}
                    >
                      <div className="text-sm text-neutral-high">{m.name}</div>
                      <div className="text-[11px] text-neutral-low">
                        {m.slug}
                        {m.locale ? ` • ${m.locale}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {/* Menu creation/deletion removed: menus are code-defined */}
            </div>
            {/* Right: Menu editor */}
            <div className="md:col-span-2">
              {!selectedMenuId ? (
                <div className="text-sm text-neutral-medium">Select a menu</div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-neutral-medium">Editing locale:</span>
                      <Select
                        value={editingLocale}
                        onValueChange={(v: any) => {
                          setEditingLocale(v)
                          if (selectedMenuId) loadMenu(selectedMenuId, v)
                        }}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Locale" />
                        </SelectTrigger>
                        <SelectContent>
                          {supportedLocales.map((loc) => (
                            <SelectItem key={loc} value={loc} className="text-sm">
                              {loc.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {((menuLocale || 'en') === editingLocale ||
                      (!menuLocale && editingLocale === 'en')) && (
                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-1 text-xs border border-line-medium rounded"
                            onClick={async () => {
                              if (!selectedMenuId) return
                              const targets = supportedLocales.filter(
                                (l) => l !== editingLocale
                              )
                              await toast.promise(
                                fetch(
                                  `/api/menus/${encodeURIComponent(selectedMenuId)}/generate-variations`,
                                  {
                                    method: 'POST',
                                    headers: {
                                      'Accept': 'application/json',
                                      'Content-Type': 'application/json',
                                      ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
                                    },
                                    credentials: 'same-origin',
                                    body: JSON.stringify({
                                      fromLocale: editingLocale,
                                      toLocales: targets,
                                      mode: 'replace',
                                    }),
                                  }
                                ).then(async (r) => {
                                  if (!r.ok) {
                                    const j = await r.json().catch(() => ({}))
                                    throw new Error(j?.error || 'Build failed')
                                  }
                                }),
                                {
                                  loading: 'Building locale menus…',
                                  success: 'Locale menus built',
                                  error: (e) => String(e.message || e),
                                }
                              )
                            }}
                          >
                            Build Locale Menus
                          </button>
                        </div>
                      )}
                  </div>
                  {(() => {
                    const want = (menuTemplate || selectedMenuSlug || '').toLowerCase()
                    const tmpl = templates.find((t) => (t.slug || '').toLowerCase() === want)
                    const activeTemplateSlug = tmpl?.slug || null
                    if (!activeTemplateSlug || !tmpl) return null
                    return (
                      <div className="mb-4 p-3 border border-line-low rounded">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">Menu Fields</div>
                          <button
                            className="px-3 py-1.5 text-sm rounded bg-standout-medium text-on-standout"
                            onClick={async () => {
                              if (!selectedMenuId) return
                              setSavingMenuMeta(true)
                              try {
                                const res = await fetch(
                                  `/api/menus/${encodeURIComponent(selectedMenuId)}`,
                                  {
                                    method: 'PUT',
                                    headers: {
                                      'Accept': 'application/json',
                                      'Content-Type': 'application/json',
                                      ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
                                    },
                                    credentials: 'same-origin',
                                    body: JSON.stringify({
                                      template: activeTemplateSlug,
                                      meta: menuMeta,
                                    }),
                                  }
                                )
                                if (!res.ok) {
                                  const j = await res.json().catch(() => ({}))
                                  throw new Error(j?.error || 'Save failed')
                                }
                                toast.success('Menu settings saved')
                                await loadMenu(selectedMenuId, editingLocale)
                              } catch (e: any) {
                                toast.error(String(e.message || e))
                              } finally {
                                setSavingMenuMeta(false)
                              }
                            }}
                            disabled={savingMenuMeta}
                          >
                            {savingMenuMeta ? 'Saving…' : 'Save Settings'}
                          </button>
                        </div>
                        <div className="mt-1">
                          <CustomFieldRenderer
                            definitions={tmpl.fields || []}
                            values={menuMeta}
                            onChange={(slug, val) =>
                              setMenuMeta((prev) => ({ ...prev, [slug]: val }))
                            }
                          />
                        </div>
                      </div>
                    )
                  })()}
                  <div className="text-sm font-medium mb-2">Add Menu Item</div>
                  <div className="flex items-center gap-2 mb-2">
                    <Select defaultValue={addType} onValueChange={(v: any) => setAddType(v)}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="post">Post</SelectItem>
                        <SelectItem value="custom">Custom URL</SelectItem>
                        <SelectItem value="dynamic">Dynamic</SelectItem>
                        <SelectItem value="section">Section</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={addParentId} onValueChange={setAddParentId}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Parent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ROOT__">Roots (no parent)</SelectItem>
                        {menuItems.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-neutral-medium">Label</label>
                      <input
                        className="px-2 py-1 text-sm border border-line-low bg-backdrop-input text-neutral-high"
                        placeholder="Label"
                        value={
                          addType === 'post' && !overrideLabel ? selectedPostLabel || '' : addLabel
                        }
                        onChange={(e) => setAddLabel(e.target.value)}
                        disabled={addType === 'post' && !overrideLabel}
                      />
                      {addType === 'post' && (
                        <label className="inline-flex items-center gap-2 text-xs text-neutral-medium mt-1">
                          <Checkbox
                            checked={overrideLabel}
                            onCheckedChange={(c) => setOverrideLabel(!!c)}
                          />
                          Override label
                        </label>
                      )}
                    </div>
                    {addType === 'post' ? (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-neutral-medium">Post</label>
                        <Popover open={postPickerOpen} onOpenChange={setPostPickerOpen}>
                          <PopoverTrigger asChild>
                            <button className="px-2 py-1 text-sm border border-line-medium rounded bg-backdrop-low text-neutral-high text-left">
                              {selectedPostTitle || 'Select a post'}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[340px]">
                            <div className="space-y-2">
                              <input
                                className="w-full px-2 py-1 text-sm border border-line-low bg-backdrop-input text-neutral-high"
                                placeholder={`Search posts${menuLocale ? ` in ${menuLocale}` : ''}…`}
                                value={postQuery}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setPostQuery(v)
                                  debouncedSearchPosts(v)
                                }}
                              />
                              <label className="inline-flex items-center gap-2 text-xs text-neutral-medium">
                                <Checkbox
                                  checked={searchAllLocales}
                                  onCheckedChange={(c) => {
                                    setSearchAllLocales(!!c)
                                    debouncedSearchPosts(postQuery)
                                  }}
                                />
                                Search all locales
                              </label>
                              <div className="max-h-[260px] overflow-auto border border-line-low rounded">
                                {postLoading ? (
                                  <div className="p-2 text-xs text-neutral-medium">Loading…</div>
                                ) : postResults.length === 0 ? (
                                  <div className="p-2 text-xs text-neutral-low">
                                    No matches. Type to search.
                                  </div>
                                ) : (
                                  postResults.map((p) => (
                                    <button
                                      key={p.id}
                                      className="w-full text-left px-2 py-1 text-sm hover:bg-backdrop-medium border-b border-line-low last:border-b-0"
                                      onClick={() => {
                                        setSelectedPostId(p.id)
                                        setSelectedPostLabel(`${p.title} (${p.locale})`)
                                        setSelectedPostTitle(p.title)
                                        setPostPickerOpen(false)
                                        if (overrideLabel && !addLabel) {
                                          setAddLabel(p.title)
                                        }
                                      }}
                                    >
                                      <div className="text-neutral-high">{p.title}</div>
                                      <div className="text-[11px] text-neutral-medium">
                                        {p.slug} • {p.locale.toUpperCase()}
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    ) : addType === 'custom' ? (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-neutral-medium">URL</label>
                        <input
                          className="px-2 py-1 text-sm border border-line-input bg-backdrop-input text-neutral-high"
                          placeholder="https:// or /path"
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                        />
                      </div>
                    ) : addType === 'dynamic' ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-neutral-medium">Post Type</label>
                          <Select value={dynamicPostType} onValueChange={setDynamicPostType}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select post type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="documentation">Documentation</SelectItem>
                              <SelectItem value="blog">Blog</SelectItem>
                              <SelectItem value="page">Page</SelectItem>
                              <SelectItem value="profile">Profile</SelectItem>
                              <SelectItem value="company">Company</SelectItem>
                              <SelectItem value="testimonial">Testimonial</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-neutral-medium">Depth Limit</label>
                          <Select
                            value={String(dynamicDepthLimit)}
                            onValueChange={(v) => setDynamicDepthLimit(Number(v))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 level (direct children)</SelectItem>
                              <SelectItem value="2">2 levels (children + grandchildren)</SelectItem>
                              <SelectItem value="3">3 levels</SelectItem>
                              <SelectItem value="4">4 levels</SelectItem>
                              <SelectItem value="5">5 levels</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-xs text-neutral-medium px-2 py-1 bg-backdrop-low border border-line-low rounded">
                          Dynamic menu items automatically populate with posts of the selected type
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center text-xs text-neutral-medium px-2 py-1">
                        Section (no destination) — used for mega menu content areas
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      className="px-2 py-1 text-xs border border-line-medium rounded"
                      onClick={() => setAdvancedOpen((v) => !v)}
                    >
                      {advancedOpen ? 'Hide Advanced' : 'Show Advanced'}
                    </button>
                    <button
                      className="px-3 py-1.5 text-sm rounded bg-standout-medium text-on-standout"
                      onClick={addItem}
                    >
                      Add Item
                    </button>
                  </div>
                  {advancedOpen && (
                    <div className="mt-3 p-2 border border-line-low rounded space-y-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-neutral-medium">
                          Additional (anchor or tokens)
                        </label>
                        <input
                          className="px-2 py-1 text-sm border border-line-input bg-backdrop-input text-neutral-high"
                          placeholder="#anchor or {token}"
                          value={extra}
                          onChange={(e) => setExtra(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-neutral-medium min-w-[80px]">Target</label>
                        <Select value={target} onValueChange={(v: any) => setTarget(v)}>
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="(default)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">(default)</SelectItem>
                            <SelectItem value="_self">_self</SelectItem>
                            <SelectItem value="_blank">_blank</SelectItem>
                            <SelectItem value="_parent">_parent</SelectItem>
                            <SelectItem value="_top">_top</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-medium mb-1">rel</div>
                        <div className="flex items-center gap-3">
                          {Object.keys(relOptions).map((k) => (
                            <label
                              key={k}
                              className="inline-flex items-center gap-1 text-xs text-neutral-high"
                            >
                              <Checkbox
                                checked={relOptions[k]}
                                onCheckedChange={(c) =>
                                  setRelOptions((prev) => ({ ...prev, [k]: !!c }))
                                }
                              />
                              {k}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="mt-4">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragMove={handleDragMove}
                      onDragEnd={handleDragEnd}
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[36px]"></TableHead>
                            <TableHead>Label</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Destination</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <SortableContext
                            items={flatRows.map((r) => r.item.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {flatRows.map(({ item, level }) => {
                              return (
                                <SortableRow key={item.id} id={item.id}>
                                  <TableCell></TableCell>
                                  <TableCell>
                                    <div
                                      className="flex items-center"
                                      style={{ paddingLeft: level * 12 }}
                                    >
                                      {level > 0 ||
                                      (dragActiveId === item.id && willNest) ||
                                      nestFlashId === item.id ? (
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
                                      ) : null}
                                      <span className="text-sm text-neutral-high">
                                        {item.label}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-xs text-neutral-medium">
                                      {(item as any).kind === 'section'
                                        ? 'Section'
                                        : item.type === 'post'
                                          ? 'Post'
                                          : item.type === 'dynamic'
                                            ? 'Dynamic'
                                            : 'Custom'}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-xs text-neutral-medium">
                                      {item.type === 'custom' ? item.customUrl || '' : 'Post'}
                                      {item.anchor ? ` ${item.anchor}` : ''}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="inline-flex items-center gap-2">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium"
                                            onClick={() => {
                                              setEditingItem(item)
                                              setEditLabel(item.label)
                                              const k = (item as any).kind as
                                                | 'item'
                                                | 'section'
                                                | undefined
                                              setEditType(k === 'section' ? 'section' : item.type)
                                              setEditCustomUrl(item.customUrl || '')
                                              setEditSelectedPostId(item.postId || '')
                                              setEditSelectedPostTitle('') // can be filled after search
                                              setEditExtra(item.anchor || '')
                                              setEditTarget(item.target || 'default')
                                              setEditDynamicPostType(item.dynamicPostType || '')
                                              setEditDynamicParentId(item.dynamicParentId || '')
                                              setEditDynamicDepthLimit(item.dynamicDepthLimit || 1)
                                              const relSet = new Set(
                                                String(item.rel || '')
                                                  .split(/\s+/)
                                                  .filter(Boolean)
                                              )
                                              setEditRelOptions({
                                                nofollow: relSet.has('nofollow'),
                                                noopener: relSet.has('noopener'),
                                                noreferrer: relSet.has('noreferrer'),
                                                external: relSet.has('external'),
                                              })
                                              setEditOpen(true)
                                            }}
                                          >
                                            <Pencil size={14} />
                                            Edit
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Edit</p>
                                        </TooltipContent>
                                      </Tooltip>

                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-red-600"
                                            onClick={() => {
                                              setDeletingItem(item)
                                              setDeleteOpen(true)
                                            }}
                                          >
                                            <Trash2 size={14} />
                                            Remove
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Remove</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TableCell>
                                </SortableRow>
                              )
                            })}
                          </SortableContext>
                        </TableBody>
                      </Table>
                    </DndContext>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <AdminFooter />
      {/* Menu creation/deletion dialogs removed */}
      {/* Edit Menu Item Dialog */}
      <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Menu Item</AlertDialogTitle>
            <AlertDialogDescription>
              Update the label and destination for this item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-medium">Label</label>
                <input
                  className="px-2 py-1 text-sm border border-line-input bg-backdrop-input text-neutral-high"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-medium">Type</label>
                <div className="px-2 py-1 text-sm border border-line-low bg-backdrop-medium text-neutral-medium rounded">
                  {editType === 'post'
                    ? 'Post'
                    : editType === 'custom'
                      ? 'Custom URL'
                      : editType === 'dynamic'
                        ? 'Dynamic'
                        : 'Section'}
                  <span className="ml-2 text-xs">(cannot be changed)</span>
                </div>
              </div>
            </div>
            {editType === 'post' ? (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-medium">Post</label>
                <Popover open={editPostPickerOpen} onOpenChange={setEditPostPickerOpen}>
                  <PopoverTrigger asChild>
                    <button className="px-2 py-1 text-sm border border-line-medium rounded bg-backdrop-low text-neutral-high text-left">
                      {editSelectedPostTitle ||
                        (editSelectedPostId
                          ? `Selected: ${editSelectedPostId.slice(0, 6)}…`
                          : 'Select a post')}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[340px]">
                    <div className="space-y-2">
                      <input
                        className="w-full px-2 py-1 text-sm border border-line-low bg-backdrop-input text-neutral-high"
                        placeholder={`Search posts${menuLocale ? ` in ${menuLocale}` : ''}…`}
                        value={editPostQuery}
                        onChange={async (e) => {
                          const v = e.target.value
                          setEditPostQuery(v)
                          const params = new URLSearchParams()
                          if (v) params.set('q', v)
                          params.set('limit', '20')
                          params.set('status', 'published')
                          params.set('sortBy', 'updated_at')
                          params.set('sortOrder', 'desc')
                          if (menuLocale) params.set('locale', menuLocale)
                          const res = await fetch(`/api/posts?${params.toString()}`, {
                            credentials: 'same-origin',
                          })
                          const j = await res.json().catch(() => ({}))
                          const list = Array.isArray(j?.data) ? j.data : []
                          setEditPostResults(
                            list.map((p: any) => ({
                              id: p.id,
                              title: p.title,
                              slug: p.slug,
                              locale: p.locale,
                            }))
                          )
                        }}
                      />
                      <div className="max-h-[260px] overflow-auto border border-line-low rounded">
                        {editPostResults.length === 0 ? (
                          <div className="p-2 text-xs text-neutral-low">
                            No matches. Type to search.
                          </div>
                        ) : (
                          editPostResults.map((p) => (
                            <button
                              key={p.id}
                              className="w-full text-left px-2 py-1 text-sm hover:bg-backdrop-medium border-b border-line-low last:border-b-0"
                              onClick={() => {
                                setEditSelectedPostId(p.id)
                                setEditSelectedPostTitle(`${p.title} (${p.locale})`)
                                setEditPostPickerOpen(false)
                              }}
                            >
                              <div className="text-neutral-high">{p.title}</div>
                              <div className="text-[11px] text-neutral-medium">
                                {p.slug} • {p.locale.toUpperCase()}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ) : editType === 'custom' ? (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-medium">URL</label>
                <input
                  className="px-2 py-1 text-sm border border-line-input bg-backdrop-input text-neutral-high"
                  placeholder="https:// or /path"
                  value={editCustomUrl}
                  onChange={(e) => setEditCustomUrl(e.target.value)}
                />
              </div>
            ) : editType === 'dynamic' ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-medium">Post Type</label>
                  <Select value={editDynamicPostType} onValueChange={setEditDynamicPostType}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select post type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="documentation">Documentation</SelectItem>
                      <SelectItem value="blog">Blog</SelectItem>
                      <SelectItem value="page">Page</SelectItem>
                      <SelectItem value="profile">Profile</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="testimonial">Testimonial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-medium">Depth Limit</label>
                  <Select
                    value={String(editDynamicDepthLimit)}
                    onValueChange={(v) => setEditDynamicDepthLimit(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 level (direct children)</SelectItem>
                      <SelectItem value="2">2 levels (children + grandchildren)</SelectItem>
                      <SelectItem value="3">3 levels</SelectItem>
                      <SelectItem value="4">4 levels</SelectItem>
                      <SelectItem value="5">5 levels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="text-xs text-neutral-medium">Section has no destination.</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-medium">Additional (anchor or tokens)</label>
                <input
                  className="px-2 py-1 text-sm border border-line-input bg-backdrop-input text-neutral-high"
                  placeholder="#anchor or {token}"
                  value={editExtra}
                  onChange={(e) => setEditExtra(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-medium min-w-[60px]">Target</label>
                <Select value={editTarget} onValueChange={(v: any) => setEditTarget(v)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="(default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">(default)</SelectItem>
                    <SelectItem value="_self">_self</SelectItem>
                    <SelectItem value="_blank">_blank</SelectItem>
                    <SelectItem value="_parent">_parent</SelectItem>
                    <SelectItem value="_top">_top</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-medium mb-1">rel</div>
              <div className="flex items-center gap-3">
                {Object.keys(editRelOptions).map((k) => (
                  <label
                    key={k}
                    className="inline-flex items-center gap-1 text-xs text-neutral-high"
                  >
                    <Checkbox
                      checked={editRelOptions[k]}
                      onCheckedChange={(c) => setEditRelOptions((prev) => ({ ...prev, [k]: !!c }))}
                    />
                    {k}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEditOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!editingItem) {
                  setEditOpen(false)
                  return
                }
                setSavingEdit(true)
                try {
                  const relString =
                    Object.keys(editRelOptions)
                      .filter((k) => editRelOptions[k])
                      .join(' ') || null
                  const payload: any = {
                    label: editLabel.trim(),
                    anchor: editExtra || null,
                    target: editTarget === 'default' ? null : editTarget,
                    rel: relString,
                  }
                  if (editType === 'post') {
                    payload.type = 'post'
                    if (!editSelectedPostId) throw new Error('Select a post')
                    payload.postId = editSelectedPostId
                  } else if (editType === 'custom') {
                    payload.type = 'custom'
                    if (!editCustomUrl.trim()) throw new Error('Enter a URL')
                    payload.customUrl = editCustomUrl.trim()
                  } else if (editType === 'dynamic') {
                    payload.type = 'dynamic'
                    if (!editDynamicPostType) throw new Error('Select a post type')
                    payload.dynamicPostType = editDynamicPostType
                    payload.dynamicParentId = editDynamicParentId || null
                    payload.dynamicDepthLimit = editDynamicDepthLimit
                  } else {
                    // section: keep type unchanged, just label/anchor/target/rel
                  }
                  const res = await fetch(`/api/menu-items/${encodeURIComponent(editingItem.id)}`, {
                    method: 'PUT',
                    headers: {
                      'Accept': 'application/json',
                      'Content-Type': 'application/json',
                      ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify(payload),
                  })
                  if (!res.ok) {
                    const j = await res.json().catch(() => ({}))
                    throw new Error(j?.error || 'Update failed')
                  }
                  setEditOpen(false)
                  await loadMenu(selectedMenuId!, editingLocale)
                  toast.success('Menu item updated')
                } catch (e: any) {
                  toast.error(String(e.message || e))
                } finally {
                  setSavingEdit(false)
                }
              }}
            >
              {savingEdit ? 'Saving…' : 'Save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Remove Menu Item Dialog */}
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeletingItem(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove menu item</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{' '}
              <span className="font-medium text-neutral-high">{deletingItem?.label || 'this item'}</span>
              {deletingItem ? ' and any nested children under it.' : '.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} onClick={() => setDeleteOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting || !deletingItem}
              onClick={async () => {
                if (!deletingItem) {
                  setDeleteOpen(false)
                  return
                }
                setDeleting(true)
                try {
                  const res = await fetch(`/api/menu-items/${encodeURIComponent(deletingItem.id)}`, {
                    method: 'DELETE',
                    headers: {
                      'Accept': 'application/json',
                      ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
                    },
                    credentials: 'same-origin',
                  })
                  if (!res.ok && res.status !== 204) {
                    const j = await res.json().catch(() => ({}))
                    throw new Error(j?.error || 'Delete failed')
                  }
                  setDeleteOpen(false)
                  setDeletingItem(null)
                  await loadMenu(selectedMenuId!, editingLocale)
                  toast.success('Menu item removed')
                } catch (e: any) {
                  toast.error(String(e.message || e))
                } finally {
                  setDeleting(false)
                }
              }}
            >
              {deleting ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
