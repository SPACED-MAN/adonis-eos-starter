import { useEffect, useMemo, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from '~/components/ui/alert-dialog'
// Select import removed (no add-pattern form)

type Pattern = {
  id: string
  postType: string
  locale: string
  pattern: string
  isDefault: boolean
  aggregatePostId: string | null
  createdAt: string
  updatedAt: string
}

type PageOption = {
  id: string
  title: string
  locale: string
}

function getXsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

export default function UrlPatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savingAggregate, setSavingAggregate] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [aggregateDrafts, setAggregateDrafts] = useState<Record<string, string | null>>({})
  const [pages, setPages] = useState<PageOption[]>([])
  const [defaultLocale, setDefaultLocale] = useState<string>('en')
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')

  useEffect(() => {
    let mounted = true
    setLoading(true)

    const fetchPatterns = fetch('/api/url-patterns', { credentials: 'same-origin' }).then((r) =>
      r.json()
    )
    const fetchPages = fetch('/api/posts?type=page&limit=500', { credentials: 'same-origin' }).then(
      (r) => r.json()
    )
    const fetchLocales = fetch('/api/locales', { credentials: 'same-origin' }).then((r) => r.json())

    Promise.all([fetchPatterns, fetchPages, fetchLocales])
      .then(([patternsJson, pagesJson, localesJson]) => {
        if (!mounted) return
        const list: Pattern[] = patternsJson?.data ?? []
        setPatterns(list)
        setPages(pagesJson?.data ?? [])

        const defLoc = localesJson?.data?.find((l: any) => l.isDefault)?.code || 'en'
        setDefaultLocale(defLoc)

        const nextDrafts: Record<string, string> = {}
        const nextAggregates: Record<string, string | null> = {}
        for (const p of list) {
          if (p.isDefault) {
            const key = `${p.postType}:${p.locale}`
            nextDrafts[key] = p.pattern
            // Shared per post type
            nextAggregates[p.postType] = p.aggregatePostId
          }
        }
        setDrafts(nextDrafts)
        setAggregateDrafts(nextAggregates)
      })
      .finally(() => setLoading(false))

    return () => {
      mounted = false
    }
  }, [])

  // Removed Add Pattern form; defaults are auto-managed by boot logic

  const showError = (message: string) => {
    setAlertMessage(message)
    setAlertOpen(true)
  }

  const groups = useMemo(() => {
    const map = new Map<string, Pattern[]>()
    for (const p of patterns) {
      const key = `${p.postType}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return map
  }, [patterns])

  async function save(postType: string, locale: string) {
    const key = `${postType}:${locale}`
    const pattern = drafts[key]
    const aggregatePostId = aggregateDrafts[postType] ?? null
    if (pattern === undefined) return
    setSavingKey(key)
    try {
      const res = await fetch(`/api/url-patterns/${encodeURIComponent(locale)}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ postType, pattern, isDefault: true, aggregatePostId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showError(err?.error || 'Failed to save pattern')
        return
      }
      const json = await res.json()
      // Update local list
      setPatterns((prev) => {
        const next = prev.slice()
        // Update all patterns for this postType since aggregatePostId is shared
        next.forEach((p, idx) => {
          if (p.postType === postType) {
            next[idx] = { ...p, aggregatePostId: json.data.aggregatePostId }
            if (p.locale === locale && p.isDefault) {
              next[idx] = json.data
            }
          }
        })
        return next
      })
      toast.success('Pattern saved successfully')
    } finally {
      setSavingKey(null)
    }
  }

  async function saveAggregate(postType: string) {
    const aggregatePostId = aggregateDrafts[postType] ?? null
    // Find the first available pattern for this post type to fulfill API requirements
    const patternEntry = patterns.find((p) => p.postType === postType && p.isDefault)
    if (!patternEntry) return

    const key = `${postType}:aggregate`
    setSavingAggregate(postType)
    try {
      const res = await fetch(`/api/url-patterns/${encodeURIComponent(patternEntry.locale)}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrfToken() ? { 'X-XSRF-TOKEN': getXsrfToken()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          postType,
          pattern: drafts[`${postType}:${patternEntry.locale}`] || patternEntry.pattern,
          isDefault: true,
          aggregatePostId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showError(err?.error || 'Failed to save aggregate page')
        return
      }
      const json = await res.json()
      // Update local list
      setPatterns((prev) => {
        const next = prev.slice()
        next.forEach((p, idx) => {
          if (p.postType === postType) {
            next[idx] = { ...p, aggregatePostId: json.data.aggregatePostId }
          }
        })
        return next
      })
      toast.success('Aggregate page updated')
    } finally {
      setSavingAggregate(null)
    }
  }

  const isPatternDirty = (postType: string, locale: string) => {
    const key = `${postType}:${locale}`
    const current = patterns.find(
      (p) => p.postType === postType && p.locale === locale && p.isDefault
    )
    if (!current) return false
    return (drafts[key] ?? current.pattern) !== current.pattern
  }

  const isAggregateDirty = (postType: string) => {
    const current = patterns.find((p) => p.postType === postType && p.isDefault)
    const initialValue = current?.aggregatePostId ?? null
    const currentValue = aggregateDrafts[postType] ?? null
    // Normalize empty strings to null for comparison
    return (currentValue || null) !== (initialValue || null)
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="URL Patterns" />
      <AdminHeader title="URL Patterns" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low border border-line-low rounded-lg">
          <div className="px-6 py-4 border-b border-line-low flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-high">
              Default Patterns by Post Type and Locale
            </h2>
            {loading && <span className="text-sm text-neutral-low">Loading…</span>}
          </div>
          <div className="p-6">
            <section className="mb-6">
              <h3 className="text-base font-semibold text-neutral-high mb-1">Available tokens</h3>
              <ul className="text-sm text-neutral-medium list-disc pl-5 space-y-1">
                <li>
                  <code className="text-neutral-high">{'{slug}'}</code> — the post’s slug
                </li>
                <li>
                  <code className="text-neutral-high">{'{path}'}</code> — hierarchical path of
                  parents and slug (enabled when post type hierarchy is on)
                </li>
                <li>
                  <code className="text-neutral-high">{'{locale}'}</code> — the locale code (e.g.,
                  en)
                </li>
                <li>
                  <code className="text-neutral-high">{'{yyyy}'}</code> — 4-digit year from
                  createdAt
                </li>
                <li>
                  <code className="text-neutral-high">{'{mm}'}</code> — 2-digit month from createdAt
                </li>
                <li>
                  <code className="text-neutral-high">{'{dd}'}</code> — 2-digit day from createdAt
                </li>
              </ul>
              <p className="mt-2 text-xs text-neutral-low">
                Note: For the default locale, patterns are created without the {'{locale}'} segment
                by default. Non-default locales include {'{locale}'} at the start.
              </p>
            </section>
            {/* Add Pattern form removed; defaults are created automatically */}
            {Array.from(groups.entries()).length === 0 && !loading ? (
              <p className="text-neutral-low">No patterns yet.</p>
            ) : (
              <div className="space-y-8">
                {Array.from(groups.entries()).map(([postType, list]) => {
                  const locales = Array.from(new Set(list.map((p) => p.locale))).sort()
                  return (
                    <section key={postType} className="border-b border-line-low pb-8 last:border-0">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-neutral-high uppercase tracking-wider">
                          {postType}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-neutral-medium uppercase">
                            Aggregate Page:
                          </span>
                          <Select
                            value={aggregateDrafts[postType] || 'none'}
                            onValueChange={(val) =>
                              setAggregateDrafts((d) => ({
                                ...d,
                                [postType]: val === 'none' ? null : val,
                              }))
                            }
                          >
                            <SelectTrigger className="h-9 text-sm w-[300px] bg-backdrop-low">
                              <SelectValue placeholder="Select an aggregate page..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {pages
                                .filter((p) => p.locale === defaultLocale)
                                .map((page) => (
                                  <SelectItem key={page.id} value={page.id}>
                                    {page.title}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          {isAggregateDirty(postType) && (
                            <button
                              type="button"
                              className="px-3 py-1 text-xs font-semibold rounded bg-standout-medium text-on-standout disabled:opacity-50 transition-all hover:opacity-90"
                              disabled={savingAggregate === postType}
                              onClick={() => saveAggregate(postType)}
                            >
                              {savingAggregate === postType ? 'Saving…' : 'Save'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4 pl-4">
                        {locales.map((loc) => {
                          const key = `${postType}:${loc}`
                          const current = list.find((p) => p.locale === loc && p.isDefault)
                          return (
                            <div key={key} className="flex items-center gap-3">
                              <div className="w-24 text-sm font-bold text-neutral-medium">
                                {loc.toUpperCase()}
                              </div>
                              <input
                                type="text"
                                className="flex-1 px-3 py-2 border border-border rounded bg-backdrop-low text-neutral-high font-mono text-sm"
                                placeholder="/posts/{slug}"
                                value={drafts[key] ?? current?.pattern ?? ''}
                                onChange={(e) =>
                                  setDrafts((d) => ({ ...d, [key]: e.target.value }))
                                }
                              />
                              {isPatternDirty(postType, loc) && (
                                <button
                                  type="button"
                                  className="px-4 py-2 text-sm font-semibold rounded bg-standout-medium text-on-standout disabled:opacity-50 min-w-[100px] transition-all hover:opacity-90"
                                  disabled={savingKey === key}
                                  onClick={() => save(postType, loc)}
                                >
                                  {savingKey === key ? 'Saving…' : 'Save Pattern'}
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>

      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAlertOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
