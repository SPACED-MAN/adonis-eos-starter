import { useEffect, useMemo, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

type ModuleGroup = {
  id: string
  name: string
  post_type: string
  description: string | null
  locked: boolean
  is_default: boolean
  updated_at: string
}
type ModuleGroupModule = {
  id: string
  type: string
  default_props: any
  order_index: number
  locked: boolean
}

function getXsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

function labelize(type: string): string {
  const withSpaces = type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
  return withSpaces
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function ModuleGroupsSettingsPage() {
  const [moduleGroups, setModuleGroups] = useState<ModuleGroup[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modules, setModules] = useState<ModuleGroupModule[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [postTypes, setPostTypes] = useState<string[]>([])
  const [createForm, setCreateForm] = useState<{ name: string; postType: string; isDefault: boolean }>({
    name: '',
    postType: '',
    isDefault: false,
  })
  const [registry, setRegistry] = useState<Array<{ type: string; name: string }>>([])
  const selected = useMemo(
    () => moduleGroups.find((t) => t.id === selectedId) || null,
    [moduleGroups, selectedId]
  )
  const [pickerOpen, setPickerOpen] = useState(false)

  async function loadModuleGroups() {
    setLoading(true)
    try {
      const r = await fetch('/api/module-groups', { credentials: 'same-origin' })
      const json = await r.json().catch(() => ({}))
      setModuleGroups(Array.isArray(json?.data) ? json.data : [])
    } finally {
      setLoading(false)
    }
  }
  async function loadModules(id: string) {
    const r = await fetch(`/api/module-groups/${encodeURIComponent(id)}/modules`, {
      credentials: 'same-origin',
    })
    const json = await r.json().catch(() => ({}))
    setModules(Array.isArray(json?.data) ? json.data : [])
  }
  useEffect(() => {
    loadModuleGroups()
  }, [])
  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('/api/post-types', { credentials: 'same-origin' })
        const json = await r.json().catch(() => ({}))
        const list: string[] = Array.isArray(json?.data) ? json.data : []
        setPostTypes(list)
        if (!createForm.postType && list.length) {
          setCreateForm((f) => ({ ...f, postType: list[0] }))
        }
      } catch {
        setPostTypes([])
      }
    })()
  }, [])
  useEffect(() => {
    if (selectedId) {
      loadModules(selectedId)
      // Load registry for the module group's post type
      const t = moduleGroups.find((x) => x.id === selectedId)
      const url = t
        ? `/api/modules/registry?post_type=${encodeURIComponent(t.post_type)}`
        : '/api/modules/registry'
      fetch(url, { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((json) => {
          const list = Array.isArray(json?.data) ? json.data : []
          setRegistry(list.map((m: any) => ({ type: m.type, name: m.name || m.type })))
        })
        .catch(() => setRegistry([]))
    } else {
      setModules([])
    }
  }, [selectedId, moduleGroups])

  async function submitCreateModuleGroup() {
    const name = createForm.name.trim()
    const postType = createForm.postType.trim()
    const isDefault = createForm.isDefault
    if (!name || !postType) return
    setCreating(true)
    try {
      const res = await fetch('/api/module-groups', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ name, postType, isDefault }),
      })
      if (res.ok) {
        await loadModuleGroups()
        setIsCreateOpen(false)
        setCreateForm({ name: '', postType: postTypes[0] || '', isDefault: false })
      } else {
        alert('Failed to create module group')
      }
    } finally {
      setCreating(false)
    }
  }

  async function updateModuleGroup(id: string, patch: Partial<ModuleGroup>) {
    try {
      const res = await fetch(`/api/module-groups/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        await loadModuleGroups()
      } else {
        alert('Failed to update module group')
      }
    } catch {
      alert('Error updating module group')
    }
  }

  async function addModule(type: string) {
    if (!selectedId) return
    const res = await fetch(`/api/module-groups/${encodeURIComponent(selectedId)}/modules`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
      },
      credentials: 'same-origin',
      body: JSON.stringify({ type }),
    })
    if (res.ok) {
      await loadModules(selectedId)
      setPickerOpen(false)
    } else {
      alert('Failed to add module')
    }
  }

  async function removeModule(id: string) {
    if (!selectedId) return
    const res = await fetch(`/api/module-groups/modules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
      },
      credentials: 'same-origin',
    })
    if (res.status === 204) {
      await loadModules(selectedId)
    } else {
      alert('Failed to remove module')
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Module Groups" />
      <AdminHeader title="Module Groups" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low border border-line-low rounded-lg">
          <div className="px-6 py-4 border-b border-line-low flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-high">Module Group Builder</h2>
            <div className="flex items-center gap-2">
              {loading && <span className="text-sm text-neutral-low">Loading…</span>}
              <button
                className="px-3 py-2 text-sm rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium disabled:opacity-50"
                disabled={creating}
                onClick={() => setIsCreateOpen(true)}
              >
                Create Module Group
              </button>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Module Groups list */}
            <div className="md:col-span-1">
              <h3 className="text-sm font-semibold text-neutral-high mb-3">Module Groups</h3>
              <div className="border border-line-low rounded divide-y divide-line">
                {moduleGroups.length === 0 ? (
                  <p className="p-3 text-neutral-low">No module groups.</p>
                ) : (
                  moduleGroups.map((t) => (
                    <button
                      key={t.id}
                      className={`w-full text-left p-3 hover:bg-backdrop-medium ${selectedId === t.id ? 'bg-backdrop-medium' : ''}`}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-neutral-high font-medium">{t.name}</div>
                        {t.is_default && (
                          <span className="text-[10px] bg-standout-medium text-on-standout px-1.5 py-0.5 rounded uppercase font-bold">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-low">{labelize(t.post_type)}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
            {/* Modules editor */}
            <div className="md:col-span-2">
              {!selected ? (
                <p className="text-neutral-low">Select a module group to edit modules.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                    <div>
                      <div className="text-neutral-high font-semibold">{selected.name}</div>
                        <div className="text-xs text-neutral-low">
                          {labelize(selected.post_type)}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-neutral-high cursor-pointer">
                        <Checkbox
                          checked={selected.is_default}
                          onCheckedChange={(checked) =>
                            updateModuleGroup(selected.id, { isDefault: !!checked } as any)
                          }
                        />
                        <span>Default Template</span>
                      </label>
                    </div>
                    <div className="relative">
                      <button
                        className="px-3 py-2 text-sm rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
                        onClick={() => setPickerOpen((v) => !v)}
                        type="button"
                      >
                        Add Module
                      </button>
                      {pickerOpen && (
                        <div className="absolute right-0 mt-2 w-[28rem] max-h-[24rem] overflow-auto rounded-lg border border-line-low bg-backdrop-input shadow-lg z-20">
                          <div className="sticky top-0 bg-backdrop-low border-b border-line-low px-3 py-2 text-sm font-medium">
                            Available Modules
                          </div>
                          <div className="divide-y divide-line">
                            {registry.length === 0 && (
                              <div className="px-4 py-6 text-neutral-low text-sm">
                                No modules available
                              </div>
                            )}
                            {registry.map((m) => (
                              <div
                                key={m.type}
                                className="px-3 py-3 hover:bg-backdrop-medium flex items-start justify-between gap-3"
                              >
                                <div>
                                  <div className="text-sm font-medium text-neutral-high">
                                    {m.name || m.type}
                                  </div>
                                  <div className="text-xs text-neutral-low mt-1">{m.type}</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => addModule(m.type)}
                                  className="shrink-0 inline-flex items-center rounded border border-line-medium bg-backdrop-low px-2.5 py-1.5 text-xs text-neutral-high hover:bg-backdrop-medium"
                                >
                                  Add
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border border-line-low rounded divide-y divide-line">
                    {modules.length === 0 ? (
                      <p className="p-3 text-neutral-low">No modules in this module group.</p>
                    ) : (
                      modules.map((m) => (
                        <div key={m.id} className="p-3 flex items-center justify-between">
                          <div>
                            <div className="text-neutral-high">{m.type}</div>
                            <div className="text-xs text-neutral-low">Order: {m.order_index}</div>
                          </div>
                          <button
                            className="px-3 py-1.5 text-xs rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
                            onClick={() => removeModule(m.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
      {/* Create Module Group Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsCreateOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-line-low bg-backdrop-input p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-neutral-high">Create Module Group</h3>
              <button
                className="text-neutral-medium hover:text-neutral-high"
                onClick={() => setIsCreateOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-neutral-medium mb-1">Name (unique)</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-line-low rounded bg-backdrop-low text-neutral-high"
                  placeholder="blog-default"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-medium mb-1">Post Type</label>
                <Select
                  defaultValue={createForm.postType}
                  onValueChange={(val) => setCreateForm((f) => ({ ...f, postType: val }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select post type" />
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
              <div>
                <label className="flex items-center gap-2 text-sm text-neutral-medium cursor-pointer">
                  <Checkbox
                    checked={createForm.isDefault}
                    onCheckedChange={(checked) =>
                      setCreateForm((f) => ({ ...f, isDefault: !!checked }))
                    }
                  />
                  <span>Set as default template for this post type</span>
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="px-3 py-2 text-sm rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
                  onClick={() => setIsCreateOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-2 text-sm rounded bg-standout-medium text-on-standout disabled:opacity-50"
                  disabled={creating || !createForm.name.trim() || !createForm.postType.trim()}
                  onClick={submitCreateModuleGroup}
                  type="button"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
