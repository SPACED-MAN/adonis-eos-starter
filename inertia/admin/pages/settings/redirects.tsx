import { useEffect, useState, useMemo } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { useUnsavedChanges } from '~/hooks/useUnsavedChanges'
import { useConfirm } from '~/components/ConfirmDialogProvider'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger, PopoverPortal } from '~/components/ui/popover'
import { Input } from '~/components/ui/input'
import { Checkbox } from '~/components/ui/checkbox'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faTrash, faPlus, faLink, faCopy, faExternalLinkAlt, faFilter } from '@fortawesome/free-solid-svg-icons'
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
  fromPath: string
  toPath: string
  httpStatus: number
  locale: string | null
  postId: string | null
  postTitle: string | null
  createdAt: string
  updatedAt: string
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
  const [form, setForm] = useState<{
    fromPath: string
    toPath: string
    httpStatus: number
    postId: string | null
    locale: string | null
  }>({
    fromPath: '',
    toPath: '',
    httpStatus: 301,
    postId: null,
    locale: null,
  })

  // List of available locales
  const [availableLocales, setAvailableLocales] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/locales', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json?.data)) {
          setAvailableLocales(json.data.map((l: any) => l.code))
        }
      })
      .catch(() => setAvailableLocales(['en']))
  }, [])

  // Post selection states
  const [postSearchQuery, setPostSearchQuery] = useState('')
  const [postOptions, setPostOptions] = useState<Array<{ id: string; title: string; url: string; locale: string }>>([])
  const [isPostPickerLoading, setIsPostPickerLoading] = useState(false)

  // Selection states
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [localeFilter, setLocaleFilter] = useState<string>('all')
  const [linkFilter, setLocaleLinkFilter] = useState<string>('all')

  const filteredItems = useMemo(() => {
    let result = items

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (item) =>
          item.fromPath.toLowerCase().includes(q) ||
          item.toPath.toLowerCase().includes(q) ||
          item.postTitle?.toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((item) => String(item.httpStatus) === statusFilter)
    }

    // Locale filter
    if (localeFilter !== 'all') {
      result = result.filter((item) => (item.locale || 'global') === localeFilter)
    }

    // Link filter
    if (linkFilter === 'linked') {
      result = result.filter((item) => !!item.postId)
    } else if (linkFilter === 'manual') {
      result = result.filter((item) => !item.postId)
    }

    return result
  }, [items, searchQuery, statusFilter, localeFilter, linkFilter])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectAll) {
      setSelected(new Set())
      setSelectAll(false)
    } else {
      setSelected(new Set(filteredItems.map((item) => item.id)))
      setSelectAll(true)
    }
  }

  async function handleBulkAction(action: 'delete' | 'status-301' | 'status-302') {
    if (selected.size === 0) return

    const actionText = action === 'delete' ? 'delete' : 'update'
    const ok = await confirm({
      title: `${action.startsWith('status') ? 'Update' : 'Delete'} selected redirects?`,
      description: `Are you sure you want to ${actionText} ${selected.size} redirect rules? ${action === 'delete' ? 'This action cannot be undone.' : ''}`,
      variant: action === 'delete' ? 'destructive' : 'default',
    })

    if (!ok) return

    try {
      const res = await fetch('/api/redirects/bulk', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          action,
          ids: Array.from(selected),
        }),
      })

      if (res.ok) {
        if (action === 'delete') {
          setItems((prev) => prev.filter((item) => !selected.has(item.id)))
        } else {
          const newStatus = action === 'status-301' ? 301 : 302
          setItems((prev) =>
            prev.map((item) =>
              selected.has(item.id) ? { ...item, httpStatus: newStatus } : item
            )
          )
        }
        setSelected(new Set())
        setSelectAll(false)
        toast.success(
          action === 'delete'
            ? 'Selected redirects deleted'
            : `Selected redirects updated to ${action.split('-')[1]}`
        )
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Bulk action failed')
      }
    } catch (error) {
      console.error('Bulk action failed:', error)
      toast.error('Bulk action failed')
    }
  }

  useEffect(() => {
    if (!postSearchQuery.trim()) {
      setPostOptions([])
      return
    }

    let alive = true
    const timeout = setTimeout(async () => {
      setIsPostPickerLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('q', postSearchQuery)
        params.set('limit', '10')
        params.set('status', 'published')
        const res = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
        const json = await res.json()
        if (!alive) return
        setPostOptions(json?.data || [])
      } catch (error) {
        console.error('Failed to fetch posts:', error)
      } finally {
        if (alive) setIsPostPickerLoading(false)
      }
    }, 300)

    return () => {
      alive = false
      clearTimeout(timeout)
    }
  }, [postSearchQuery])

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
    ; (async () => {
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
          locale: form.locale || inferredLocale,
          postId: form.postId,
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
      setForm({ fromPath: '', toPath: '', httpStatus: 301, postId: null, locale: null })
      setPostSearchQuery('')
      toast.success('Redirect created')
    } finally {
      setCreating(false)
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/redirects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
      },
      credentials: 'same-origin',
    })
    if (res.status === 204) {
      setItems((prev) => prev.filter((r) => r.id !== id))
      toast.success('Redirect rule deleted')
    } else {
      const err = await res.json().catch(() => ({}))
      alert({
        title: 'Error',
        description: err?.error || 'Failed to delete redirect',
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
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-medium uppercase tracking-wider ml-1">
                      From Path
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-line-low rounded-lg bg-backdrop-low text-neutral-high focus:ring-2 focus:ring-standout-high/20 focus:border-standout-high outline-none transition-all"
                      placeholder="/old-path"
                      value={form.fromPath}
                      onChange={(e) => setForm((f) => ({ ...f, fromPath: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-medium uppercase tracking-wider ml-1">
                      To Path
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-line-low rounded-lg bg-backdrop-low text-neutral-high pr-10 focus:ring-2 focus:ring-standout-high/20 focus:border-standout-high outline-none transition-all"
                        placeholder="/new-path or select a post"
                        value={form.toPath}
                        onChange={(e) => setForm((f) => ({ ...f, toPath: e.target.value, postId: null }))}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={`p-1.5 rounded hover:bg-backdrop-medium transition-colors ${form.postId ? 'text-standout-high' : 'text-neutral-low'}`}
                              title="Link to a post"
                            >
                              <FontAwesomeIcon icon={faLink} />
                            </button>
                          </PopoverTrigger>
                          <PopoverPortal>
                            <PopoverContent
                              className="w-80 p-3 border border-line-low shadow-2xl z-100 bg-backdrop-low"
                              align="end"
                            >
                              <div className="space-y-3">
                                <div className="relative">
                                  <Input
                                    type="text"
                                    placeholder="Search published posts..."
                                    value={postSearchQuery}
                                    onChange={(e) => setPostSearchQuery(e.target.value)}
                                    className="h-9 pr-8 bg-backdrop-medium border-line-low"
                                    autoFocus
                                  />
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-low">
                                    <FontAwesomeIcon icon={faSearch} className="text-xs" />
                                  </div>
                                </div>

                                <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                  {isPostPickerLoading ? (
                                    <div className="py-4 text-center text-xs text-neutral-low animate-pulse">
                                      Searching...
                                    </div>
                                  ) : postOptions.length === 0 ? (
                                    <div className="py-4 text-center text-xs text-neutral-low italic">
                                      {postSearchQuery.trim() ? 'No posts found' : 'Start typing to search...'}
                                    </div>
                                  ) : (
                                    postOptions.map((post) => (
                                      <button
                                        key={post.id}
                                        type="button"
                                        className="w-full text-left px-2.5 py-2 rounded-md hover:bg-standout-high/10 text-neutral-high transition-colors group border border-transparent hover:border-standout-high/20"
                                        onClick={() => {
                                          setForm((f) => ({
                                            ...f,
                                            toPath: post.url || `/${post.id}`,
                                            postId: post.id,
                                            locale: post.locale || f.locale
                                          }))
                                          setPostSearchQuery('')
                                        }}
                                      >
                                        <div className="text-sm font-medium leading-tight group-hover:text-standout-high flex items-center justify-between">
                                          <span>{post.title}</span>
                                          <span className="text-[9px] px-1 py-0.5 rounded bg-backdrop-medium uppercase">{post.locale}</span>
                                        </div>
                                        <div className="text-[10px] text-neutral-low font-mono mt-0.5 truncate leading-tight">
                                          {post.url}
                                        </div>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </PopoverPortal>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-end justify-between pt-2">
                  <div className="flex items-center gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-medium uppercase tracking-wider ml-1">
                        HTTP Status
                      </label>
                      <Select
                        defaultValue={String(form.httpStatus)}
                        onValueChange={(val) => setForm((f) => ({ ...f, httpStatus: Number(val) }))}
                      >
                        <SelectTrigger className="w-40 h-10 rounded-lg bg-backdrop-low border-line-low">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-backdrop-low border-line-low">
                          <SelectItem value="301">301 (Permanent)</SelectItem>
                          <SelectItem value="302">302 (Temporary)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-medium uppercase tracking-wider ml-1">
                        Locale (Optional)
                      </label>
                      <Select
                        value={form.locale || 'auto'}
                        onValueChange={(val) => setForm((f) => ({ ...f, locale: val === 'auto' ? null : val }))}
                      >
                        <SelectTrigger className="w-32 h-10 rounded-lg bg-backdrop-low border-line-low">
                          <SelectValue placeholder="Auto" />
                        </SelectTrigger>
                        <SelectContent className="bg-backdrop-low border-line-low">
                          <SelectItem value="auto">Auto-detect</SelectItem>
                          {availableLocales.map((loc) => (
                            <SelectItem key={loc} value={loc}>
                              {loc.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-6">
                      <button
                        type="button"
                        className="h-10 px-4 text-xs font-semibold text-neutral-low hover:text-neutral-high transition-colors"
                        onClick={() => {
                          setForm({ fromPath: '', toPath: '', httpStatus: 301, postId: null, locale: null })
                          setPostSearchQuery('')
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="h-10 px-6 font-bold text-sm rounded-lg bg-standout-high text-on-high hover:shadow-lg hover:shadow-standout-high/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2"
                    disabled={creating || !form.fromPath || !form.toPath}
                    onClick={createRedirect}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    {creating ? 'Creating…' : 'Create Redirect'}
                  </button>
                </div>
              </div>
            </section>

            <section>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-base font-semibold text-neutral-high whitespace-nowrap">Existing Redirects</h3>
                  {selected.size > 0 && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                      <span className="text-xs font-bold text-standout-high bg-standout-high/10 px-2 py-1 rounded-full border border-standout-high/20">
                        {selected.size} selected
                      </span>

                      <div className="flex items-center bg-backdrop-low border border-line-low rounded-lg p-0.5 shadow-sm">
                        <button
                          onClick={() => handleBulkAction('status-301')}
                          className="px-2.5 py-1 text-[10px] font-bold text-neutral-medium hover:text-emerald-600 transition-colors"
                          title="Set to 301"
                        >
                          301
                        </button>
                        <div className="w-px h-3 bg-line-low" />
                        <button
                          onClick={() => handleBulkAction('status-302')}
                          className="px-2.5 py-1 text-[10px] font-bold text-neutral-medium hover:text-sky-600 transition-colors"
                          title="Set to 302"
                        >
                          302
                        </button>
                        <div className="w-px h-3 bg-line-low" />
                        <button
                          onClick={() => handleBulkAction('delete')}
                          className="px-2.5 py-1 text-[10px] font-bold text-neutral-medium hover:text-red-600 transition-colors"
                          title="Delete selected"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setSelected(new Set())
                          setSelectAll(false)
                        }}
                        className="text-[10px] font-bold text-neutral-low hover:text-neutral-high uppercase tracking-tight px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Bar */}
                  <div className="relative w-full md:w-64">
                    <input
                      type="text"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-line-low rounded-xl bg-backdrop-low text-neutral-high focus:ring-2 focus:ring-standout-high/20 focus:border-standout-high outline-none transition-all shadow-sm"
                      placeholder="Search path or title..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-low/60">
                      <FontAwesomeIcon icon={faSearch} className="text-xs" />
                    </div>
                  </div>

                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32 h-9 text-xs rounded-xl bg-backdrop-low border-line-low shadow-sm">
                      <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faFilter} className="text-[10px] text-neutral-low" />
                        <SelectValue placeholder="Status" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-zinc-950 border-line-low">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="301">301 (Perm)</SelectItem>
                      <SelectItem value="302">302 (Temp)</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Locale Filter */}
                  <Select value={localeFilter} onValueChange={setLocaleFilter}>
                    <SelectTrigger className="w-32 h-9 text-xs rounded-xl bg-backdrop-low border-line-low shadow-sm">
                      <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faFilter} className="text-[10px] text-neutral-low" />
                        <SelectValue placeholder="Locale" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-zinc-950 border-line-low">
                      <SelectItem value="all">All Locales</SelectItem>
                      <SelectItem value="global">Global</SelectItem>
                      {availableLocales.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {loc.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Link Filter */}
                  <Select value={linkFilter} onValueChange={setLocaleLinkFilter}>
                    <SelectTrigger className="w-32 h-9 text-xs rounded-xl bg-backdrop-low border-line-low shadow-sm">
                      <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faLink} className="text-[10px] text-neutral-low" />
                        <SelectValue placeholder="Link" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-zinc-950 border-line-low">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="linked">Linked to Post</SelectItem>
                      <SelectItem value="manual">Manual Path</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="text-sm text-neutral-low py-16 text-center border-2 border-dashed border-line-low/50 rounded-2xl bg-backdrop-low/20">
                  <div className="max-w-xs mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-full bg-line-low/20 flex items-center justify-center mx-auto mb-4">
                      <FontAwesomeIcon icon={faSearch} className="text-neutral-low text-xl" />
                    </div>
                    <p className="font-medium text-neutral-medium">
                      {searchQuery || statusFilter !== 'all' || localeFilter !== 'all'
                        ? 'No redirects match your filters.'
                        : 'No redirect rules created yet.'}
                    </p>
                    <p className="text-xs text-neutral-low/80 leading-relaxed">
                      {searchQuery || statusFilter !== 'all' || localeFilter !== 'all'
                        ? 'Try adjusting your search terms or filters to find what you looking for.'
                        : 'Redirects help you manage changed URLs and preserve SEO rankings when moving content.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border border-line-low rounded-2xl overflow-hidden shadow-sm bg-backdrop-low/10">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-backdrop-low/50 border-b border-line-low">
                        <TableHead className="w-[50px] pl-4">
                          <Checkbox
                            checked={selectAll}
                            onCheckedChange={toggleSelectAll}
                            className="translate-y-[2px]"
                          />
                        </TableHead>
                        <TableHead className="text-[10px] font-bold text-neutral-medium uppercase tracking-widest py-4">From Path</TableHead>
                        <TableHead className="text-[10px] font-bold text-neutral-medium uppercase tracking-widest py-4">To Path / Linked Post</TableHead>
                        <TableHead className="text-[10px] font-bold text-neutral-medium uppercase tracking-widest py-4">Status</TableHead>
                        <TableHead className="text-[10px] font-bold text-neutral-medium uppercase tracking-widest py-4">Locale</TableHead>
                        <TableHead className="text-right text-[10px] font-bold text-neutral-medium uppercase tracking-widest py-4 whitespace-nowrap px-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((r) => (
                        <TableRow
                          key={r.id}
                          className={`hover:bg-backdrop-low/40 transition-colors group ${selected.has(r.id) ? 'bg-standout-high/3' : ''}`}
                        >
                          <TableCell className="pl-4">
                            <Checkbox
                              checked={selected.has(r.id)}
                              onCheckedChange={() => toggleSelect(r.id)}
                              className="translate-y-[2px]"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-[13px] text-neutral-high py-5 relative">
                            <div className="flex items-center gap-2">
                              <span>{r.fromPath}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(r.fromPath)
                                  toast.success('Copied to clipboard')
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-neutral-low hover:text-standout-high transition-all"
                                title="Copy path"
                              >
                                <FontAwesomeIcon icon={faCopy} className="text-[10px]" />
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[13px] text-neutral-high">{r.toPath}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(r.toPath)
                                    toast.success('Copied to clipboard')
                                  }}
                                  className="p-1 text-neutral-low hover:text-standout-high"
                                  title="Copy path"
                                >
                                  <FontAwesomeIcon icon={faCopy} className="text-[10px]" />
                                </button>
                                {r.toPath.startsWith('/') && (
                                  <a
                                    href={r.toPath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 text-neutral-low hover:text-standout-high"
                                    title="Open link"
                                  >
                                    <FontAwesomeIcon icon={faExternalLinkAlt} className="text-[10px]" />
                                  </a>
                                )}
                              </div>
                            </div>
                            {r.postTitle && (
                              <div className="text-[10px] text-standout-high font-bold uppercase mt-1.5 flex items-center gap-1.5 bg-standout-high/5 w-fit px-1.5 py-0.5 rounded border border-standout-high/10 shadow-sm">
                                <FontAwesomeIcon icon={faLink} className="text-[9px]" />
                                {r.postTitle}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-col gap-1">
                              <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${r.httpStatus === 301 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400'}`}>
                                {r.httpStatus}
                              </span>
                              <span className="text-[9px] text-neutral-low font-medium">
                                {new Date(r.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            {r.locale ? (
                              <span className="bg-backdrop-medium px-2 py-1 rounded border border-line-low text-[10px] font-bold text-neutral-medium uppercase tracking-tight">
                                {r.locale}
                              </span>
                            ) : (
                              <span className="text-neutral-low italic text-[10px]">Global</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-4 px-6">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center w-8 h-8 text-neutral-low hover:text-red-500 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                  title="Delete rule"
                                >
                                  <FontAwesomeIcon icon={faTrash} className="text-sm" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-backdrop-low border-line-low shadow-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-neutral-high">Delete redirect rule?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-neutral-medium leading-relaxed">
                                    This will permanently remove the redirect from <code className="text-standout-high bg-standout-high/10 px-1.5 py-0.5 rounded font-mono text-xs">{r.fromPath}</code>.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2">
                                  <AlertDialogCancel className="bg-backdrop-medium border-line-low text-neutral-high hover:bg-backdrop-high transition-colors">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => remove(r.id)}
                                    className="bg-red-600 hover:bg-red-700 text-white border-none shadow-lg shadow-red-600/20 active:scale-95 transition-all"
                                  >
                                    Delete Rule
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
