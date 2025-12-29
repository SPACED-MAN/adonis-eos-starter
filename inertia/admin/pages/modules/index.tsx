import { useEffect, useMemo, useState } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { toast } from 'sonner'
import { usePage, Link } from '@inertiajs/react'
import { useAdminPath } from '~/utils/adminPath'
import { FormField, FormLabel } from '../../../components/forms/field'
import { Input } from '../../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { ModuleEditorPanel, type ModuleListItem } from '../../components/modules/ModuleEditorPanel'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogDescription,
} from '../../../components/ui/alert-dialog'
import { ModulePicker } from '../../components/modules/ModulePicker'
import { DragHandle } from '../../components/ui/DragHandle'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Globe } from 'lucide-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faReact } from '@fortawesome/free-brands-svg-icons'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'

type GlobalModuleItem = {
  id: string
  scope: 'global' | 'static'
  type: string
  globalSlug: string | null
  props: Record<string, any>
  updatedAt: string
  usageCount: number
}

type ModuleGroup = {
  id: string
  name: string
  postType: string
  description?: string | null
  isDefault?: boolean
  locked?: boolean
  updatedAt?: string
}
type ModuleGroupModule = {
  id: string
  type: string
  defaultProps: any
  orderIndex: number
  locked: boolean
  scope?: 'post' | 'global'
  globalSlug?: string | null
}

function labelize(type: string): string {
  if (!type) return ''
  const withSpaces = type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
  return withSpaces
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatGroupName(g: ModuleGroup | null): string {
  if (!g || !g.name) return ''
  let name = g.name
  let isDef = !!g.isDefault

  if (name.endsWith('-default')) {
    name = name.replace('-default', '')
    isDef = true
  }

  const base = labelize(name)
  return isDef ? `${base} (default)` : base
}

export default function GlobalModulesIndex() {
  const page = usePage<{ isAdmin?: boolean }>()
  const adminPath = useAdminPath()
  const isAdmin = !!page.props?.isAdmin
  const [activeTab, setActiveTab] = useState<'globals' | 'groups'>('globals')
  const [loading, setLoading] = useState<boolean>(false)
  const [globals, setGlobals] = useState<GlobalModuleItem[]>([])
  const [q, setQ] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [creating, setCreating] = useState<boolean>(false)
  const [newType, setNewType] = useState<string>('')
  const [newSlug, setNewSlug] = useState<string>('')
  const [newLabel, setNewLabel] = useState<string>('')
  const [slugTouched, setSlugTouched] = useState<boolean>(false)
  const [editing, setEditing] = useState<GlobalModuleItem | null>(null)
  const [registryTypes, setRegistryTypes] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [groups, setGroups] = useState<ModuleGroup[]>([])
  const [groupsQuery, setGroupsQuery] = useState('')
  const [groupTypeFilter, setGroupTypeFilter] = useState('')
  const [groupCreateForm, setGroupCreateForm] = useState<{ name: string; postType: string }>({
    name: '',
    postType: '',
  })
  const [groupCreating, setGroupCreating] = useState(false)
  const [groupLoading, setGroupLoading] = useState(false)
  const [postTypes, setPostTypes] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<ModuleGroup | null>(null)
  const [groupModules, setGroupModules] = useState<ModuleGroupModule[]>([])
  const [groupDraft, setGroupDraft] = useState<ModuleGroupModule[]>([])
  const [groupDirty, setGroupDirty] = useState(false)
  const [groupEditorLoading, setGroupEditorLoading] = useState(false)
  const [groupSaving, setGroupSaving] = useState(false)
  const [groupRegistry, setGroupRegistry] = useState<
    Array<{ type: string; name: string; renderingMode?: 'static' | 'react' }>
  >([])
  const [pendingEditSlug, setPendingEditSlug] = useState<string | null>(null)
  const [editingGroupNameId, setEditingGroupNameId] = useState<string | null>(null)
  const [editGroupNameValue, setEditGroupNameValue] = useState('')
  const [usagePopupOpen, setUsagePopupOpen] = useState(false)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageData, setUsageData] = useState<any[]>([])
  const [selectedModuleForUsage, setSelectedModuleForUsage] = useState<GlobalModuleItem | null>(
    null
  )
  const sensors = useSensors(useSensor(PointerSensor))

  const xsrfToken: string | undefined = (() => {
    if (typeof document === 'undefined') return undefined
    const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : undefined
  })()

  async function loadGroups() {
    setGroupLoading(true)
    try {
      const r = await fetch('/api/module-groups', { credentials: 'same-origin' })
      const json = await r.json().catch(() => ({}))
      setGroups(Array.isArray(json?.data) ? json.data : [])
    } finally {
      setGroupLoading(false)
    }
  }

  async function loadPostTypes() {
    try {
      const r = await fetch('/api/post-types', { credentials: 'same-origin' })
      const json = await r.json().catch(() => ({}))
      const list: string[] = Array.isArray(json?.data) ? json.data : []
      setPostTypes(list)
      if (!groupCreateForm.postType && list.length) {
        setGroupCreateForm((f) => ({ ...f, postType: list[0] }))
      }
    } catch {
      setPostTypes([])
    }
  }

  async function load() {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (q) p.set('q', q)
      if (typeFilter) p.set('type', typeFilter)
      const [gRes, regRes] = await Promise.all([
        fetch(`/api/modules/global?${p.toString()}`, { credentials: 'same-origin' }),
        fetch(`/api/modules/registry`, { credentials: 'same-origin' }),
      ])
      const gJ = await gRes.json().catch(() => ({}))
      const regJ = await regRes.json().catch(() => ({}))
      setGlobals(Array.isArray(gJ?.data) ? gJ.data : [])
      const types = Array.isArray(regJ?.data)
        ? (regJ.data as any[]).map((m) => m.type).filter(Boolean)
        : []
      setRegistryTypes(Array.from(new Set(types)).sort((a, b) => a.localeCompare(b)))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [q, typeFilter])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('editSlug')
    if (slug) {
      setActiveTab('globals')
      setPendingEditSlug(slug)
    }
  }, [])
  useEffect(() => {
    loadGroups()
    loadPostTypes()
  }, [])

  useEffect(() => {
    if (!pendingEditSlug || globals.length === 0) return
    const match = globals.find(
      (g) => (g.globalSlug || '').toLowerCase() === pendingEditSlug.toLowerCase()
    )
    if (match) {
      setEditing(match)
      setPendingEditSlug(null)
    }
  }, [pendingEditSlug, globals])

  const availableTypes = useMemo(() => registryTypes, [registryTypes])
  const groupFiltered = useMemo(() => {
    const query = groupsQuery.trim().toLowerCase()
    return groups.filter((g) => {
      const matchesQ =
        !query || g.name.toLowerCase().includes(query) || g.postType.toLowerCase().includes(query)
      const matchesType = !groupTypeFilter || g.postType === groupTypeFilter
      return matchesQ && matchesType
    })
  }, [groups, groupsQuery, groupTypeFilter])

  async function loadUsage(m: GlobalModuleItem) {
    setSelectedModuleForUsage(m)
    setUsagePopupOpen(true)
    setUsageLoading(true)
    try {
      const res = await fetch(`/api/modules/global/${encodeURIComponent(m.id)}/usage`, {
        credentials: 'same-origin',
      })
      if (res.ok) {
        const json = await res.json()
        setUsageData(json.data || [])
      } else {
        toast.error('Failed to load usage data')
      }
    } catch {
      toast.error('Failed to load usage data')
    } finally {
      setUsageLoading(false)
    }
  }

  async function createGlobal() {
    if (!newType || !newSlug) {
      toast.error('Please select a module type and enter a slug')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/modules/global', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ type: newType, globalSlug: newSlug, label: newLabel || undefined }),
      })
      if (res.ok) {
        toast.success('Global module created')
        setNewType('')
        setNewSlug('')
        setNewLabel('')
        setSlugTouched(false)
        await load()
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to create')
      }
    } finally {
      setCreating(false)
    }
  }

  async function deleteGlobal(id: string) {
    const res = await fetch(`/api/modules/global/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}) },
    })
    if (res.status === 204) {
      toast.success('Deleted')
      await load()
    } else {
      const j = await res.json().catch(() => ({}))
      toast.error(j?.error || 'Failed to delete')
    }
  }

  async function createGroup() {
    const name = groupCreateForm.name.trim()
    const postType = groupCreateForm.postType.trim()
    if (!name || !postType) {
      toast.error('Please provide a name and post type')
      return
    }
    setGroupCreating(true)
    try {
      const res = await fetch('/api/module-groups', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ name, postType }),
      })
      if (res.ok) {
        await res.json().catch(() => ({}))
        toast.success('Module group created')
        setGroupCreateForm({ name: '', postType })
        await loadGroups()
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to create module group')
      }
    } finally {
      setGroupCreating(false)
    }
  }

  async function deleteGroup(id: string) {
    if (!isAdmin) {
      toast.error('Only admins can delete module groups')
      return
    }
    const ok = window.confirm('Delete this module group? This cannot be undone.')
    if (!ok) return
    try {
      const res = await fetch(`/api/module-groups/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}) },
      })
      if (res.status === 204) {
        toast.success('Module group deleted')
        if (selectedGroup?.id === id) {
          setSelectedGroup(null)
          setGroupModules([])
          setGroupDraft([])
          setGroupDirty(false)
        }
        await loadGroups()
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to delete module group')
      }
    } catch {
      toast.error('Failed to delete module group')
    }
  }

  async function saveGroupName(id: string, newName: string) {
    if (!newName.trim()) return
    try {
      const res = await fetch(`/api/module-groups/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        toast.success('Name updated')
        if (selectedGroup?.id === id) {
          setSelectedGroup((prev) => (prev ? { ...prev, name: newName.trim() } : null))
        }
        await loadGroups()
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to update name')
      }
    } catch {
      toast.error('Failed to update name')
    } finally {
      setEditingGroupNameId(null)
    }
  }

  async function loadGroupEditor(group: ModuleGroup) {
    setSelectedGroup(group)
    setGroupEditorLoading(true)
    try {
      const [modsRes, regRes, globalsRes] = await Promise.all([
        fetch(`/api/module-groups/${encodeURIComponent(group.id)}/modules`, {
          credentials: 'same-origin',
        }),
        fetch(`/api/modules/registry?post_type=${encodeURIComponent(group.postType)}`, {
          credentials: 'same-origin',
        }),
        fetch('/api/modules/global', { credentials: 'same-origin' }),
      ])
      const modsJson = await modsRes.json().catch(() => ({}))
      const regJson = await regRes.json().catch(() => ({}))
      const globalsJson = await globalsRes.json().catch(() => ({}))
      const loaded: ModuleGroupModule[] = Array.isArray(modsJson?.data) ? modsJson.data : []
      setGroupModules(loaded)
      setGroupDraft(loaded)
      setGroupDirty(false)
      const regList = Array.isArray(regJson?.data)
        ? regJson.data.map((m: any) => ({
            type: m.type,
            name: m.name || m.type,
            renderingMode: m.renderingMode,
          }))
        : []
      setGroupRegistry(regList)
      // keep existing globals list for labels; reuse loaded globals
      if (Array.isArray(globalsJson?.data)) {
        setGlobals(globalsJson.data)
      }
    } finally {
      setGroupEditorLoading(false)
    }
  }

  function SortableItem({
    id,
    disabled,
    children,
  }: {
    id: string
    disabled?: boolean
    children: (listeners: any, attributes: any) => React.ReactNode
  }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
      id,
      disabled: !!disabled,
    })
    const style = { transform: CSS.Transform.toString(transform), transition }
    const attrs = disabled ? {} : attributes
    const ls = disabled ? {} : listeners
    return (
      <div ref={setNodeRef} style={style} {...attrs}>
        {children(ls, attrs)}
      </div>
    )
  }

  const groupOrdered = useMemo(
    () => groupDraft.slice().sort((a, b) => a.orderIndex - b.orderIndex),
    [groupDraft]
  )
  const groupOrderedIds = useMemo(() => groupOrdered.map((m) => m.id), [groupOrdered])

  const slugToLabel = useMemo(() => {
    const map = new Map<string, string>()
    globals.forEach((g: any) => {
      if (g.globalSlug) map.set(g.globalSlug, (g as any).label || g.globalSlug)
    })
    return map
  }, [globals])

  async function onGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const current = groupOrdered
    const oldIndex = current.findIndex((m) => m.id === active.id)
    const newIndex = current.findIndex((m) => m.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    if (current[oldIndex]?.locked) return
    const next = current.slice()
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved)
    setGroupDraft(next.map((m, idx) => ({ ...m, orderIndex: idx })))
    setGroupDirty(true)
  }

  function toggleGroupLock(id: string, current: boolean) {
    setGroupDraft((prev) => prev.map((m) => (m.id === id ? { ...m, locked: !current } : m)))
    setGroupDirty(true)
  }

  function removeGroupModule(id: string) {
    setGroupDraft((prev) => {
      const next = prev.filter((m) => m.id !== id)
      return next.map((m, idx) => ({ ...m, orderIndex: idx }))
    })
    setGroupDirty(true)
  }

  async function addGroupModule(
    type: string,
    scope: 'post' | 'global' = 'post',
    globalSlug?: string | null
  ) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setGroupDraft((prev) => {
      const next: ModuleGroupModule = {
        id: tempId,
        type,
        defaultProps: {},
        orderIndex: prev.length,
        locked: false,
        scope,
        globalSlug: scope === 'global' ? globalSlug || null : null,
      }
      return [...prev, next]
    })
    setGroupDirty(true)
  }

  async function saveGroupChanges() {
    if (!selectedGroup) return
    setGroupSaving(true)
    try {
      const baselineById = new Map(groupModules.map((m) => [m.id, m]))
      const draftById = new Map(groupDraft.map((m) => [m.id, m]))
      const deletions = groupModules.filter((m) => !draftById.has(m.id))
      const creations = groupDraft.filter((m) => !baselineById.has(m.id))
      const updates = groupDraft.filter((m) => {
        const base = baselineById.get(m.id)
        if (!base) return false
        return (
          base.orderIndex !== m.orderIndex ||
          base.locked !== m.locked ||
          JSON.stringify(base.defaultProps || {}) !== JSON.stringify(m.defaultProps || {}) ||
          base.scope !== m.scope ||
          base.globalSlug !== m.globalSlug
        )
      })

      await Promise.all(
        deletions.map((m) =>
          fetch(`/api/module-groups/modules/${encodeURIComponent(m.id)}`, {
            method: 'DELETE',
            headers: { ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}) },
            credentials: 'same-origin',
          })
        )
      )

      await Promise.all(
        creations.map((m) =>
          fetch(`/api/module-groups/${encodeURIComponent(selectedGroup.id)}/modules`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
            },
            credentials: 'same-origin',
            body: JSON.stringify({
              type: m.type,
              defaultProps: m.defaultProps || {},
              locked: !!m.locked,
              scope: m.scope || 'post',
              globalSlug: m.scope === 'global' ? m.globalSlug || null : null,
              orderIndex: m.orderIndex,
            }),
          })
        )
      )

      await Promise.all(
        updates.map((m) =>
          fetch(`/api/module-groups/modules/${encodeURIComponent(m.id)}`, {
            method: 'PUT',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
            },
            credentials: 'same-origin',
            body: JSON.stringify({
              orderIndex: m.orderIndex,
              defaultProps: m.defaultProps || {},
              locked: !!m.locked,
            }),
          })
        )
      )

      await loadGroupEditor(selectedGroup)
      toast.success('Module group saved')
    } finally {
      setGroupSaving(false)
      setGroupDirty(false)
    }
  }

  function discardGroupChanges() {
    setGroupDraft(groupModules)
    setGroupDirty(false)
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <AdminHeader title="Modules" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="border-b border-line-low mb-6">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('globals')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'globals'
                  ? 'border-standout-medium text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              }`}
            >
              Globals
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'groups'
                  ? 'border-standout-medium text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              }`}
            >
              Groups
            </button>
          </nav>
        </div>

        <div className="bg-backdrop-low rounded-lg shadow border border-line-low p-6 space-y-6">
          {activeTab === 'globals' && (
            <>
              <div className="flex items-end gap-3">
                <FormField className="flex-1">
                  <FormLabel>Search (slug)</FormLabel>
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search by slug..."
                  />
                </FormField>
                <FormField>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={typeFilter || undefined}
                    onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {availableTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-high">Global Modules</h3>
                  {isAdmin && (
                    <button
                      className="px-3 py-1.5 text-xs rounded bg-standout-medium text-on-high cursor-pointer"
                      onClick={() => setCreateOpen(true)}
                      type="button"
                    >
                      Add
                    </button>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {globals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-xs text-neutral-low">
                          {loading ? 'Loading…' : 'No global modules.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      globals.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{(m as any).label || '-'}</TableCell>
                          <TableCell>{m.globalSlug || '-'}</TableCell>
                          <TableCell>{m.type}</TableCell>
                          <TableCell>{new Date(m.updatedAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => loadUsage(m)}
                              className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${
                                m.usageCount > 0
                                  ? 'bg-standout-medium/10 text-standout-high hover:bg-standout-medium/20'
                                  : 'text-neutral-low'
                              }`}
                            >
                              {m.usageCount}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium"
                                onClick={() => setEditing(m)}
                              >
                                Edit
                              </button>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium disabled:opacity-50"
                                    disabled={m.usageCount > 0}
                                    onClick={() => deleteGlobal(m.id)}
                                  >
                                    Delete
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {m.usageCount > 0
                                      ? 'Cannot delete while referenced'
                                      : 'Delete global module'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </section>

              {isAdmin && (
                <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
                  {createOpen && (
                    <AlertDialogContent className="w-full max-w-lg">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Create Global Module</AlertDialogTitle>
                        <AlertDialogDescription>
                          Pick a base module type and a unique slug to create a reusable Global
                          module.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-4 mt-3">
                        <div>
                          <label className="block text-xs text-neutral-medium mb-1">Label</label>
                          <Input
                            value={newLabel}
                            onChange={(e) => {
                              const val = e.target.value
                              setNewLabel(val)
                              if (!slugTouched) {
                                const slug = val
                                  .toLowerCase()
                                  .normalize('NFKD')
                                  .replace(/[\u0300-\u036f]/g, '')
                                  .replace(/[^a-z0-9]+/g, '-')
                                  .replace(/^-+|-+$/g, '')
                                  .replace(/-{2,}/g, '-')
                                setNewSlug(slug)
                              }
                            }}
                            placeholder="e.g., Footer Links"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-medium mb-1">
                            Base type
                          </label>
                          <Select value={newType} onValueChange={setNewType}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choose base type" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableTypes.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-medium mb-1">
                            Global slug
                          </label>
                          <Input
                            value={newSlug}
                            onChange={(e) => {
                              setNewSlug(e.target.value)
                              setSlugTouched(true)
                            }}
                            placeholder="unique-slug"
                          />
                        </div>
                      </div>
                      <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel disabled={creating}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            await createGlobal()
                            setCreateOpen(false)
                          }}
                          disabled={creating || !newType || !newSlug}
                        >
                          {creating ? 'Creating…' : 'Create'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  )}
                </AlertDialog>
              )}
            </>
          )}

          {activeTab === 'groups' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 items-center gap-3">
                  <FormField className="flex-1">
                    <FormLabel className="sr-only">Search (name or post type)</FormLabel>
                    <Input
                      value={groupsQuery}
                      onChange={(e) => setGroupsQuery(e.target.value)}
                      placeholder="Search module groups..."
                    />
                  </FormField>
                  <FormField>
                    <FormLabel className="sr-only">Post type</FormLabel>
                    <Select
                      value={groupTypeFilter || undefined}
                      onValueChange={(v) => setGroupTypeFilter(v === '__all__' ? '' : v)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All post types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All</SelectItem>
                        {postTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {labelize(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <Input
                      value={groupCreateForm.name}
                      onChange={(e) => setGroupCreateForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="New group name"
                      className="sm:w-48"
                    />
                    <Select
                      value={groupCreateForm.postType || undefined}
                      onValueChange={(val) => setGroupCreateForm((f) => ({ ...f, postType: val }))}
                    >
                      <SelectTrigger className="sm:w-48">
                        <SelectValue placeholder="Post type" />
                      </SelectTrigger>
                      <SelectContent>
                        {postTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {labelize(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={createGroup}
                      disabled={
                        groupCreating ||
                        !groupCreateForm.name.trim() ||
                        !groupCreateForm.postType.trim()
                      }
                      className="px-3 py-2 text-sm rounded bg-standout-medium text-on-high disabled:opacity-50"
                    >
                      {groupCreating ? 'Creating…' : 'Create Group'}
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-line border border-line-low rounded bg-backdrop-medium">
                {groupFiltered.length === 0 ? (
                  <div className="p-6 text-neutral-low text-sm">
                    {groupLoading ? 'Loading groups…' : 'No module groups found.'}
                  </div>
                ) : (
                  groupFiltered.map((g) => (
                    <div key={g.id} className="px-6 py-3 grid grid-cols-12 items-center gap-2">
                      <div className="col-span-5">
                        <div className="flex items-center gap-2 group/label">
                          {editingGroupNameId === g.id ? (
                            <Input
                              autoFocus
                              value={editGroupNameValue}
                              onChange={(e) => setEditGroupNameValue(e.target.value)}
                              onBlur={() => saveGroupName(g.id, editGroupNameValue)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveGroupName(g.id, editGroupNameValue)
                                if (e.key === 'Escape') setEditingGroupNameId(null)
                              }}
                              className="h-7 text-sm py-1"
                            />
                          ) : (
                            <>
                              <div className="text-sm text-neutral-high font-medium">
                                {formatGroupName(g)}
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingGroupNameId(g.id)
                                      setEditGroupNameValue(g.name)
                                    }}
                                    className="opacity-40 group-hover/label:opacity-100 p-1 rounded-md hover:bg-backdrop-medium text-neutral-low hover:text-neutral-high transition-all"
                                  >
                                    <FontAwesomeIcon icon={faPencil} className="w-3 h-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit name</p>
                                </TooltipContent>
                              </Tooltip>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-neutral-low">{labelize(g.postType)}</div>
                      </div>
                      <div className="col-span-5 text-xs text-neutral-low">
                        {g.updatedAt ? new Date(g.updatedAt).toLocaleString() : ''}
                      </div>
                      <div className="col-span-2 text-right">
                        <button
                          onClick={() => loadGroupEditor(g)}
                          className="px-3 py-1.5 text-xs border border-line-low rounded hover:bg-backdrop-medium text-neutral-medium"
                          type="button"
                        >
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => deleteGroup(g.id)}
                            className="ml-2 px-3 py-1.5 text-xs border border-line-low rounded hover:bg-backdrop-medium text-danger"
                            type="button"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {selectedGroup && (
                <div className="border border-line-low rounded bg-backdrop-low p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 group/label">
                        {editingGroupNameId === selectedGroup.id ? (
                          <Input
                            autoFocus
                            value={editGroupNameValue}
                            onChange={(e) => setEditGroupNameValue(e.target.value)}
                            onBlur={() => saveGroupName(selectedGroup.id, editGroupNameValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter')
                                saveGroupName(selectedGroup.id, editGroupNameValue)
                              if (e.key === 'Escape') setEditingGroupNameId(null)
                            }}
                            className="h-8 text-lg font-semibold py-1"
                          />
                        ) : (
                          <>
                            <h3 className="text-lg font-semibold text-neutral-high">
                              {formatGroupName(selectedGroup)}
                            </h3>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingGroupNameId(selectedGroup.id)
                                    setEditGroupNameValue(selectedGroup.name)
                                  }}
                                  className="opacity-40 group-hover/label:opacity-100 p-1 rounded-md hover:bg-backdrop-medium text-neutral-low hover:text-neutral-high transition-all"
                                >
                                  <FontAwesomeIcon icon={faPencil} className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit name</p>
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-neutral-low">{labelize(selectedGroup.postType)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={`px-3 py-2 text-sm rounded ${groupDirty ? 'bg-standout-medium text-on-high' : 'border border-line-low text-neutral-medium'}`}
                        onClick={saveGroupChanges}
                        disabled={!groupDirty || groupSaving}
                      >
                        {groupSaving ? 'Saving…' : groupDirty ? 'Save changes' : 'Saved'}
                      </button>
                      {groupDirty && (
                        <button
                          type="button"
                          className="px-3 py-2 text-sm rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
                          onClick={discardGroupChanges}
                          disabled={groupSaving}
                        >
                          Discard
                        </button>
                      )}
                      <ModulePicker
                        postType={selectedGroup.postType}
                        buttonLabel="Add module"
                        onAdd={async ({ type, scope, globalSlug }) => {
                          await addGroupModule(
                            type,
                            scope === 'global' ? 'global' : 'post',
                            globalSlug || null
                          )
                        }}
                      />
                    </div>
                  </div>

                  {groupEditorLoading ? (
                    <div className="text-sm text-neutral-low">Loading group modules…</div>
                  ) : groupOrdered.length === 0 ? (
                    <div className="text-sm text-neutral-low">
                      No modules yet. Click “Add module”.
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={onGroupDragEnd}
                    >
                      <SortableContext
                        items={groupOrderedIds}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="space-y-3">
                          {groupOrdered.map((m) => (
                            <SortableItem key={m.id} id={m.id} disabled={m.locked}>
                              {(listeners: any) => (
                                <li className="bg-backdrop-medium border border-line-low rounded-lg px-4 py-3 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <DragHandle
                                      aria-label="Drag"
                                      disabled={m.locked}
                                      {...(m.locked ? {} : listeners)}
                                    />
                                    <div>
                                      <div className="text-sm font-medium text-neutral-high flex items-center gap-1">
                                        {m.scope === 'global'
                                          ? slugToLabel.get(String(m.globalSlug || '')) ||
                                            String(m.globalSlug || '')
                                          : groupRegistry.find((r) => r.type === m.type)?.name ||
                                            m.type}
                                      </div>
                                      <div className="text-xs text-neutral-low">
                                        {m.scope === 'global' ? (
                                          <>Global · {String(m.globalSlug || '')}</>
                                        ) : (
                                          m.type
                                        )}{' '}
                                        · Order: {m.orderIndex} {m.locked ? '• Locked' : ''}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {groupRegistry.find((r) => r.type === m.type)?.renderingMode ===
                                      'react' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className="inline-flex items-center rounded border border-line-medium bg-backdrop-low px-2 py-1 text-xs text-neutral-high cursor-help"
                                            aria-label="React module"
                                          >
                                            <FontAwesomeIcon
                                              icon={faReact}
                                              className="mr-1 text-sky-400"
                                            />
                                            React
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>React module (client-side interactivity)</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    {m.scope === 'global' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className="inline-flex items-center rounded border border-line-medium bg-backdrop-low px-2 py-1 text-xs text-neutral-high cursor-help"
                                            aria-label="Global module"
                                          >
                                            <Globe size={14} />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Global module</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                    <button
                                      className="text-xs px-2 py-1 rounded border border-line-low bg-backdrop-input text-neutral-high hover:bg-backdrop-medium"
                                      onClick={() => toggleGroupLock(m.id, m.locked)}
                                      type="button"
                                      disabled={groupSaving}
                                    >
                                      {m.locked ? 'Unlock' : 'Lock'}
                                    </button>
                                    <button
                                      className="text-xs px-2 py-1 rounded border border-line-low bg-backdrop-input text-neutral-high hover:bg-backdrop-medium"
                                      onClick={() => removeGroupModule(m.id)}
                                      type="button"
                                      disabled={m.locked || groupSaving}
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
          )}
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>

      {/* Edit panel for a Global module (reuses ModuleEditorPanel) */}
      {editing && (
        <ModuleEditorPanel
          open={true}
          moduleItem={
            {
              id: editing.id,
              type: editing.type,
              scope: 'global',
              props: editing.props || {},
              overrides: null,
              locked: false,
              orderIndex: 0,
            } as ModuleListItem
          }
          processing={false}
          onClose={() => setEditing(null)}
          allowGlobalEditing={true}
          onSave={async (_overrides, edited) => {
            try {
              const res = await fetch(`/api/modules/global/${encodeURIComponent(editing.id)}`, {
                method: 'PUT',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
                },
                credentials: 'same-origin',
                body: JSON.stringify({ props: edited }),
              })
              if (res.ok) {
                toast.success('Saved')
                setEditing(null)
                await load()
              } else {
                const j = await res.json().catch(() => ({}))
                toast.error(j?.error || 'Failed to save')
              }
            } catch {
              toast.error('Failed to save')
            }
          }}
        />
      )}

      <AlertDialog open={usagePopupOpen} onOpenChange={setUsagePopupOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-between">
              <span>Module Usage</span>
              {selectedModuleForUsage && (
                <span className="text-sm font-normal text-neutral-low">
                  {selectedModuleForUsage.globalSlug || selectedModuleForUsage.type}
                </span>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              List of all posts using this global module.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-[60vh] overflow-y-auto">
            {usageLoading ? (
              <div className="flex justify-center py-8">
                <FontAwesomeIcon icon={faReact} spin className="text-2xl text-neutral-low" />
              </div>
            ) : usageData.length === 0 ? (
              <div className="text-center py-8 text-neutral-low italic">
                No posts are currently using this module.
              </div>
            ) : (
              <div className="divide-y divide-line-low border border-line-low rounded-lg overflow-hidden">
                {usageData.map((post) => (
                  <div
                    key={post.id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-backdrop-medium transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-neutral-high">{post.title}</div>
                      <div className="text-[10px] text-neutral-low flex items-center gap-2">
                        <span className="uppercase tracking-wider font-bold">{post.type}</span>
                        <span>•</span>
                        <span>{post.locale.toUpperCase()}</span>
                        <span>•</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            post.status === 'published'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {post.status}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={adminPath(`posts/${post.id}/edit`)}
                      className="text-xs font-semibold text-standout-high hover:underline"
                    >
                      Edit Post
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setUsagePopupOpen(false)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
