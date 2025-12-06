import { useEffect, useMemo, useState } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { toast } from 'sonner'
import { usePage } from '@inertiajs/react'
import { FormField, FormLabel } from '../../../components/forms/field'
import { Input } from '../../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'
import { ModuleEditorPanel, type ModuleListItem } from '../../components/modules/ModuleEditorPanel'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogDescription } from '../../../components/ui/alert-dialog'

type GlobalModuleItem = {
  id: string
  scope: 'global' | 'static'
  type: string
  globalSlug: string | null
  props: Record<string, any>
  updatedAt: string
  usageCount: number
}

export default function GlobalModulesIndex() {
  const page = usePage<{ isAdmin?: boolean }>()
  const isAdmin = !!page.props?.isAdmin
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

  const xsrfToken: string | undefined = (() => {
    if (typeof document === 'undefined') return undefined
    const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : undefined
  })()

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
      const types = Array.isArray(regJ?.data) ? (regJ.data as any[]).map((m) => m.type).filter(Boolean) : []
      setRegistryTypes(Array.from(new Set(types)).sort((a, b) => a.localeCompare(b)))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [q, typeFilter])

  const availableTypes = useMemo(() => registryTypes, [registryTypes])

  async function createGlobal() {
    if (!newType || !newSlug) {
      toast.error('Please select a module type and enter a slug')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/modules/global', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}) },
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

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <AdminHeader title="Global Modules" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low rounded-lg shadow border border-line-low p-6 space-y-6">
          <div className="flex items-end gap-3">
            <FormField className="flex-1">
              <FormLabel>Search (slug)</FormLabel>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by slug..." />
            </FormField>
            <FormField>
              <FormLabel>Type</FormLabel>
              <Select value={typeFilter || undefined} onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-48"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {availableTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-high">Global Modules</h3>
              {isAdmin && (
                <button
                  className="px-3 py-1.5 text-xs rounded bg-standout text-on-standout cursor-pointer"
                  onClick={() => setCreateOpen(true)}
                  type="button"
                >
                  Add
                </button>
              )}
            </div>
            <div className="border border-line-low rounded">
              <table className="w-full text-sm">
                <thead className="bg-backdrop-medium text-neutral-medium">
                  <tr>
                    <th className="text-left px-3 py-2 border-b border-line-low">Label</th>
                    <th className="text-left px-3 py-2 border-b border-line-low">Slug</th>
                    <th className="text-left px-3 py-2 border-b border-line-low">Type</th>
                    <th className="text-left px-3 py-2 border-b border-line-low">Updated</th>
                    <th className="text-left px-3 py-2 border-b border-line-low">Usage</th>
                    <th className="text-right px-3 py-2 border-b border-line-low">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {globals.length === 0 ? (
                    <tr><td className="px-3 py-3 text-xs text-neutral-low" colSpan={6}>{loading ? 'Loading…' : 'No global modules.'}</td></tr>
                  ) : globals.map((m) => (
                    <tr key={m.id} className="border-b border-line-low">
                      <td className="px-3 py-2">{(m as any).label || '-'}</td>
                      <td className="px-3 py-2">{m.globalSlug || '-'}</td>
                      <td className="px-3 py-2">{m.type}</td>
                      <td className="px-3 py-2">{new Date(m.updatedAt).toLocaleString()}</td>
                      <td className="px-3 py-2">{m.usageCount}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium" onClick={() => setEditing(m)}>Edit</button>
                          <button className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium disabled:opacity-50"
                            disabled={m.usageCount > 0}
                            onClick={() => deleteGlobal(m.id)}
                            title={m.usageCount > 0 ? 'Cannot delete while referenced' : 'Delete'}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {isAdmin && (
            <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
              {createOpen && (
                <AlertDialogContent className="w-full max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Create Global Module</AlertDialogTitle>
                    <AlertDialogDescription>Pick a base module type and a unique slug to create a reusable Global module.</AlertDialogDescription>
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
                      <label className="block text-xs text-neutral-medium mb-1">Base type</label>
                      <Select value={newType} onValueChange={setNewType}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Choose base type" /></SelectTrigger>
                        <SelectContent>
                          {availableTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-medium mb-1">Global slug</label>
                      <Input
                        value={newSlug}
                        onChange={(e) => { setNewSlug(e.target.value); setSlugTouched(true) }}
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
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>

      {/* Edit panel for a Global module (reuses ModuleEditorPanel) */}
      {editing && (
        <ModuleEditorPanel
          open={true}
          moduleItem={{
            id: editing.id,
            type: editing.type,
            scope: 'global',
            props: editing.props || {},
            overrides: null,
            locked: false,
            orderIndex: 0,
          } as ModuleListItem}
          processing={false}
          onClose={() => setEditing(null)}
          onSave={async (_overrides, edited) => {
            try {
              const res = await fetch(`/api/modules/global/${encodeURIComponent(editing.id)}`, {
                method: 'PUT',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}) },
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
    </div>
  )
}


