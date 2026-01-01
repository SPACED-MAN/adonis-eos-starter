import { useEffect, useState, useMemo } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { useUnsavedChanges } from '~/hooks/useUnsavedChanges'
import { useConfirm } from '~/components/ConfirmDialogProvider'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'

type Redirect = {
  id: string
  from_path: string
  to_path: string
  http_status: number
  locale: string | null
  created_at: string
  updated_at: string
}

function getXsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

export default function RedirectsPage() {
  const { confirm, alert } = useConfirm()
  const [items, setItems] = useState<Redirect[]>([])
  const [postTypes, setPostTypes] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [autoRedirectEnabled, setAutoRedirectEnabled] = useState<boolean>(false)
  const [savedAutoRedirectEnabled, setSavedAutoRedirectEnabled] = useState<boolean>(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<{ fromPath: string; toPath: string; httpStatus: number }>({
    fromPath: '',
    toPath: '',
    httpStatus: 301,
  })

  const isDirty = useMemo(() => {
    const settingDirty = autoRedirectEnabled !== savedAutoRedirectEnabled
    const formDirty = form.fromPath !== '' || form.toPath !== ''
    return settingDirty || formDirty
  }, [autoRedirectEnabled, savedAutoRedirectEnabled, form])

  useUnsavedChanges(isDirty)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const params = new URLSearchParams()
    if (typeFilter) params.set('type', typeFilter)
    fetch(`/api/redirects?${params.toString()}`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return
        setItems(json?.data ?? [])
      })
      .finally(() => setLoading(false))
    // Load setting for selected type (only if it's a valid post type)
    if (typeFilter && postTypes.includes(typeFilter)) {
      fetch(`/api/redirect-settings/${encodeURIComponent(typeFilter)}`, {
        credentials: 'same-origin',
      })
        .then((r) => r.json())
        .then((json) => {
          if (!mounted) return
          const enabled = !!json?.data?.autoRedirectOnSlugChange
          setAutoRedirectEnabled(enabled)
          setSavedAutoRedirectEnabled(enabled)
        })
        .catch(() => {
          if (!mounted) return
          setAutoRedirectEnabled(false)
          setSavedAutoRedirectEnabled(false)
        })
    } else {
      // Reset when "All post types" is selected or no valid type
      setAutoRedirectEnabled(false)
      setSavedAutoRedirectEnabled(false)
      setSaveSuccess(false)
    }
    return () => {
      mounted = false
    }
  }, [typeFilter, postTypes])

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('/api/post-types', { credentials: 'same-origin' })
        const json = await r.json().catch(() => ({}))
        const list: string[] = Array.isArray(json?.data) ? json.data : []
        setPostTypes(list)
        // Load initial setting for the first type if present
        if (list.length > 0 && !typeFilter) {
          setTypeFilter(list[0])
        }
      } catch {
        setPostTypes([])
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

  function inferLocale(path: string): string | null {
    if (!path || path[0] !== '/') return null
    const seg = path.split('/')[1]?.trim().toLowerCase()
    if (!seg) return null
    if (/^[a-z]{2}(-[a-z]{2})?$/.test(seg)) return seg
    return null
  }

  async function createRedirect() {
    if (!form.fromPath || !form.toPath) {
      alert({
        title: 'Validation Error',
        description: 'fromPath and toPath are required',
      })
      return
    }
    const inferredLocale = inferLocale(form.fromPath) ?? inferLocale(form.toPath)
    setCreating(true)
    try {
      const res = await fetch('/api/redirects', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          fromPath: form.fromPath,
          toPath: form.toPath,
          httpStatus: form.httpStatus,
          locale: inferredLocale,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert({
          title: 'Error',
          description: err?.error || 'Failed to create redirect',
        })
        return
      }
      const json = await res.json()
      setItems((prev) => [json.data, ...prev])
      setForm({ fromPath: '', toPath: '', httpStatus: 301 })
      toast.success('Redirect created')
    } finally {
      setCreating(false)
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: 'Delete Redirect?',
      description: 'Are you sure you want to delete this redirect?',
      variant: 'destructive',
    })
    if (!ok) return
    const res = await fetch(`/api/redirects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
      },
      credentials: 'same-origin',
    })
    if (res.status === 204) {
      setItems((prev) => prev.filter((r) => r.id !== id))
    } else {
      alert({
        title: 'Error',
        description: 'Failed to delete redirect',
      })
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Redirects" />
      <AdminHeader title="Redirects" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low border border-line-low rounded-lg">
          <div className="px-6 py-4 border-b border-line-low flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-high">Redirect Rules</h2>
            <div className="flex items-center gap-3">
              <Select
                value={typeFilter || 'all'}
                onValueChange={(val) => {
                  const newFilter = val === 'all' ? '' : val
                  setTypeFilter(newFilter)
                  // Reset settings state when changing filter
                  setAutoRedirectEnabled(false)
                  setSavedAutoRedirectEnabled(false)
                  setSaveSuccess(false)
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select a post type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select a post type</SelectItem>
                  {postTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {labelize(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {typeFilter && postTypes.includes(typeFilter) && (
                <div className="inline-flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-neutral-high">
                    <input
                      type="checkbox"
                      checked={autoRedirectEnabled}
                      onChange={(e) => {
                        setAutoRedirectEnabled(e.target.checked)
                        setSaveSuccess(false)
                      }}
                      className="rounded border-line-medium"
                    />
                    <span className="text-neutral-medium">
                      Auto-redirect on slug change
                      <span className="text-xs text-neutral-low ml-1">
                        (for {labelize(typeFilter)} posts)
                      </span>
                    </span>
                  </label>
                  {autoRedirectEnabled !== savedAutoRedirectEnabled && (
                    <button
                      onClick={async () => {
                        setSaving(true)
                        setSaveSuccess(false)
                        try {
                          const response = await fetch(
                            `/api/redirect-settings/${encodeURIComponent(typeFilter)}`,
                            {
                              method: 'POST',
                              headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                ...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
                              },
                              credentials: 'same-origin',
                              body: JSON.stringify({
                                autoRedirectOnSlugChange: autoRedirectEnabled,
                              }),
                            }
                          )
                          if (response.ok) {
                            setSavedAutoRedirectEnabled(autoRedirectEnabled)
                            setSaveSuccess(true)
                            setTimeout(() => setSaveSuccess(false), 2000)
                          }
                        } catch (error) {
                          console.error('Failed to save setting:', error)
                        } finally {
                          setSaving(false)
                        }
                      }}
                      disabled={saving}
                      className="px-3 py-1 text-sm bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  )}
                  {saveSuccess && <span className="text-sm text-green-600">✓ Saved</span>}
                </div>
              )}
              {loading && <span className="text-sm text-neutral-low">Loading…</span>}
            </div>
          </div>
          <div className="p-6 space-y-8">
            <section>
              <h3 className="text-base font-semibold text-neutral-high mb-3">Create Redirect</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                <input
                  type="text"
                  className="md:col-span-2 px-3 py-2 border border-line-low rounded bg-backdrop-low text-neutral-high"
                  placeholder="/from/path"
                  value={form.fromPath}
                  onChange={(e) => setForm((f) => ({ ...f, fromPath: e.target.value }))}
                />
                <input
                  type="text"
                  className="md:col-span-2 px-3 py-2 border border-line-low rounded bg-backdrop-low text-neutral-high"
                  placeholder="/to/path"
                  value={form.toPath}
                  onChange={(e) => setForm((f) => ({ ...f, toPath: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Select
                    defaultValue={String(form.httpStatus)}
                    onValueChange={(val) => setForm((f) => ({ ...f, httpStatus: Number(val) }))}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="301">301 (Permanent)</SelectItem>
                      <SelectItem value="302">302 (Temporary)</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm rounded bg-standout-high text-on-high disabled:opacity-50"
                    disabled={creating}
                    onClick={createRedirect}
                  >
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold text-neutral-high mb-3">Existing Redirects</h3>
              {items.length === 0 ? (
                <div className="text-sm text-neutral-low">No redirects.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Locale</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono">{r.from_path}</TableCell>
                        <TableCell className="font-mono">{r.to_path}</TableCell>
                        <TableCell className="text-neutral-medium">{r.http_status}</TableCell>
                        <TableCell className="text-neutral-medium">{r.locale || '—'}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                type="button"
                                className="px-3 py-1.5 text-xs rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
                              >
                                Delete
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete redirect?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove(r.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </div>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}
