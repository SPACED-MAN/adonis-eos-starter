import { Head, Link, usePage } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import { AdminHeader } from '../components/AdminHeader'
import { AdminFooter } from '../components/AdminFooter'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { Checkbox } from '~/components/ui/checkbox'

interface DashboardProps { }

export default function Dashboard({ }: DashboardProps) {
  const inertiaPage = usePage()
  const role: string | undefined =
    (inertiaPage.props as any)?.currentUser?.role ??
    (inertiaPage.props as any)?.auth?.user?.role
  const isAdmin = role === 'admin'
  const isEditor = role === 'editor'
  const isTranslator = role === 'translator'
  const [posts, setPosts] = useState<Array<{ id: string; title: string; slug: string; status: string; locale: string; updatedAt: string }>>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('')
  const [locale, setLocale] = useState<string>('')
  const [postType, setPostType] = useState<string>('')
  const [postTypes, setPostTypes] = useState<string[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'title' | 'slug' | 'status' | 'locale' | 'updated_at' | 'created_at'>('updated_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)

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
      params.set('limit', String(limit))
      params.set('page', String(page))
      params.set('withTranslations', '1')
      const res = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      const list: Array<{ id: string; title: string; slug: string; status: string; locale: string; updatedAt: string; translationOfId?: string | null; familyLocales?: string[]; hasReviewDraft?: boolean }> =
        Array.isArray(json?.data) ? json.data : []
      setPosts(list)
      setTotal(Number(json?.meta?.total || 0))
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
  }, [q, status, locale, postType, sortBy, sortOrder, page, limit])

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
    setSelected((prev) => {
      if (!selectAll) {
        return new Set(posts.map((p) => p.id))
      }
      return new Set()
    })
  }

  async function applyBulk(action: 'publish' | 'draft' | 'archive' | 'delete') {
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
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-low">
      <Head title="Admin Dashboard" />

      <AdminHeader title="Admin Dashboard" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low rounded-lg shadow border border-line">
          {/* Posts Header */}
          <div className="px-6 py-4 border-b border-line">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-neutral-high">
                Posts
              </h2>
              <div className="flex items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search title or slug..."
                  className="px-3 py-2 text-sm border border-line rounded bg-backdrop-low text-neutral-high"
                />
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value)
                    setPage(1)
                  }}
                  className="px-2 py-2 text-sm border border-line rounded bg-backdrop-low text-neutral-high"
                >
                  <option value="">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="__in_review__">In Review</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
                <select
                  value={locale}
                  onChange={(e) => {
                    setLocale(e.target.value)
                    setPage(1)
                  }}
                  className="px-2 py-2 text-sm border border-line rounded bg-backdrop-low text-neutral-high"
                >
                  <option value="">All locales</option>
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                  <option value="fr">FR</option>
                  <option value="pt">PT</option>
                </select>
                <select
                  value={postType}
                  onChange={(e) => {
                    setPostType(e.target.value)
                    setPage(1)
                  }}
                  className="px-2 py-2 text-sm border border-line rounded bg-backdrop-low text-neutral-high"
                >
                  <option value="">All post types</option>
                  {postTypes.map((t) => (
                    <option key={t} value={t}>
                      {labelize(t)}
                    </option>
                  ))}
                </select>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value) || 20)
                    setPage(1)
                  }}
                  className="px-2 py-2 text-sm border border-line rounded bg-backdrop-low text-neutral-high"
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
                {(isAdmin || isEditor) && (
                  <button
                    onClick={() => setIsCreateOpen(true)}
                    className="px-3 py-2 text-sm border border-line rounded bg-standout text-on-standout"
                  >
                    Create New
                  </button>
                )}
                <button
                  onClick={() => {
                    setPage(1)
                    fetchPosts()
                  }}
                  className="px-3 py-2 text-sm border border-line rounded bg-backdrop-low text-neutral-high"
                >
                  Search
                </button>
              </div>
            </div>
            {/* Bulk actions */}
            <div className="mt-3 flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-medium">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={toggleSelectAll}
                  className="rounded border-line"
                />
                Select All
              </label>
              <select
                defaultValue=""
                onChange={(e) => {
                  const val = e.target.value as any
                  if (!val) return
                  applyBulk(val)
                  e.currentTarget.value = ''
                }}
                className="px-2 py-2 text-sm border border-line rounded bg-backdrop-low text-neutral-high"
              >
                <option value="">Bulk actions...</option>
                {(isAdmin || isEditor) && <option value="publish">Publish</option>}
                <option value="draft">Move to Draft</option>
                {(isAdmin || isEditor) && <option value="archive">Archive</option>}
                {isAdmin && <option value="delete">Delete (archived only)</option>}
              </select>
              {loading && <span className="text-xs text-neutral-low">Loading...</span>}
            </div>
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
            <TableBody>
              {posts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="py-12 text-center">
                      <p className="text-neutral-low">No posts yet.</p>
                      <p className="text-sm text-neutral-low mt-2">Run the seeder to create test posts.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                posts.map((post) => {
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
                        <div className="text-sm font-medium text-neutral-high">{post.title}</div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-neutral-medium">{post.slug}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(supportedLocales.length > 1 ? supportedLocales : [post.locale]).map((loc) => {
                            const exists = (post.familyLocales || [post.locale]).includes(loc)
                            return (
                              <span
                                key={`${post.id}-${loc}`}
                                className={`px-1.5 py-0.5 rounded text-[10px] border ${exists ? 'bg-standout/10 text-standout border-standout/40' : 'bg-backdrop-low text-neutral-medium border-line'
                                  }`}
                                title={exists ? `Has ${loc.toUpperCase()}` : `Missing ${loc.toUpperCase()}`}
                              >
                                {loc.toUpperCase()}
                              </span>
                            )
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{post.status}</span>
                        {post.hasReviewDraft && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-backdrop-medium text-neutral-high border border-line align-middle">
                            In Review
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-neutral-low">
                          {new Date(post.updatedAt).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
          </Table>
          {/* Pagination */}
          <div className="px-6 py-3 border-t border-line flex items-center justify-between text-sm">
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


