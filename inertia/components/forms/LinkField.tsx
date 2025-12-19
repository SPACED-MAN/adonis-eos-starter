import * as React from 'react'
import { Input } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { FormField, FormLabel, FormHelper } from './field'

export type LinkKind = 'post' | 'url'

export type LinkFieldValue =
  | {
    kind: 'post'
    postId: string
    postType?: string
    slug?: string
    locale?: string
    url?: string // Resolved URL path (from server)
    target?: '_self' | '_blank'
  }
  | { kind: 'url'; url: string; target?: '_self' | '_blank' }
  | null

type PostOption = {
  id: string
  title: string
  slug: string
  type: string
  locale: string
  status: string
  url?: string // Resolved URL from server
}

function normalizeLinkValue(raw: any): LinkFieldValue {
  if (!raw) return null
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    // Check if it's a stringified JSON object (malformed case)
    if (trimmed.startsWith('{') && trimmed.includes('"kind"')) {
      try {
        const parsed = JSON.parse(trimmed)
        // Recursively normalize the parsed object
        return normalizeLinkValue(parsed)
      } catch {
        // If parsing fails, treat as regular URL string
      }
    }
    // Regular string URL
    const url = trimmed
    return url ? { kind: 'url', url } : null
  }
  if (typeof raw === 'object') {
    const anyVal: any = raw
    if (anyVal.kind === 'post' && anyVal.postId) {
      return {
        kind: 'post',
        postId: String(anyVal.postId),
        postType: anyVal.postType ? String(anyVal.postType) : undefined,
        slug: anyVal.slug ? String(anyVal.slug) : undefined,
        locale: anyVal.locale ? String(anyVal.locale) : undefined,
        url: anyVal.url ? String(anyVal.url) : undefined,
        target: anyVal.target === '_blank' ? '_blank' : '_self',
      }
    }
    if (anyVal.kind === 'url' && anyVal.url) {
      return {
        kind: 'url',
        url: String(anyVal.url),
        target: anyVal.target === '_blank' ? '_blank' : '_self',
      }
    }
    // Also support shapes like { url } or { postId }
    if (anyVal.url) {
      const url = String(anyVal.url).trim()
      if (!url) return null
      return {
        kind: 'url',
        url,
        target: anyVal.target === '_blank' ? '_blank' : '_self',
      }
    }
    if (anyVal.postId) {
      return {
        kind: 'post',
        postId: String(anyVal.postId),
        postType: anyVal.postType ? String(anyVal.postType) : undefined,
        slug: anyVal.slug ? String(anyVal.slug) : undefined,
        locale: anyVal.locale ? String(anyVal.locale) : undefined,
        url: anyVal.url ? String(anyVal.url) : undefined,
        target: anyVal.target === '_blank' ? '_blank' : '_self',
      }
    }
  }
  return null
}

export interface LinkFieldProps {
  label: string
  value: any
  onChange: (val: LinkFieldValue) => void
  currentLocale?: string
  helperText?: string
}

export const LinkField: React.FC<LinkFieldProps> = ({
  label,
  value,
  onChange,
  currentLocale,
  helperText,
}) => {
  const initial = React.useMemo(() => normalizeLinkValue(value), [value])
  // Default to 'post' mode unless explicitly set to 'url'
  const [mode, setMode] = React.useState<LinkKind>(initial?.kind === 'url' ? 'url' : 'post')
  const [link, setLink] = React.useState<LinkFieldValue>(initial)
  const [posts, setPosts] = React.useState<PostOption[]>([])
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [urlError, setUrlError] = React.useState<string | null>(null)

  // Track previous normalized value to avoid unnecessary updates
  const prevNormalizedValue = React.useRef<string | null>(null)

  // Update link and mode when value prop changes (only if different)
  React.useEffect(() => {
    const normalized = normalizeLinkValue(value)
    const normalizedStr = JSON.stringify(normalized)

    // Only update if the normalized value is actually different
    if (prevNormalizedValue.current !== normalizedStr) {
      prevNormalizedValue.current = normalizedStr

      if (normalized) {
        setLink(normalized)
        // Update mode based on normalized value
        if (normalized.kind === 'url') {
          setMode('url')
        } else if (normalized.kind === 'post') {
          setMode('post')
        }
      } else {
        setLink(null)
        // If value is cleared, default to post mode
        setMode('post')
      }
    }
  }, [value])

  // Only call onChange when link changes from user interaction (not from prop sync)
  // We use a ref to track if this is the initial mount
  const isInitialMount = React.useRef(true)
  React.useEffect(() => {
    // Skip onChange on initial mount (value is already set)
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Compare current link with normalized value to see if this is a user change
    const normalized = normalizeLinkValue(value)
    const linkStr = JSON.stringify(link)
    const normalizedStr = JSON.stringify(normalized)

    // Only call onChange if link differs from the normalized value (user changed it)
    if (linkStr !== normalizedStr) {
      onChange(link)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link])

  React.useEffect(() => {
    if (mode !== 'post') return
    let cancelled = false
    setLoading(true)
    setError(null)
      ; (async () => {
        try {
          // If we have a selected post, fetch it first to ensure it's in the list
          const selectedPostId = link && link.kind === 'post' && link.postId ? String(link.postId) : ''

          // Fetch posts list
          const params = new URLSearchParams()
          params.set('status', 'published')
          if (currentLocale) params.set('locale', currentLocale)
          params.set('limit', '200')

          // If we have a selected post, also fetch it specifically (in case it's not published)
          const fetchPromises = [
            fetch(`/api/posts?${params.toString()}`, {
              credentials: 'same-origin',
              headers: { Accept: 'application/json' },
            }),
          ]

          if (selectedPostId) {
            fetchPromises.push(
              fetch(`/api/posts?ids=${encodeURIComponent(selectedPostId)}`, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
              })
            )
          }

          const responses = await Promise.all(fetchPromises)
          const results = await Promise.all(
            responses.map((res) => {
              if (!res.ok) return []
              return res.json().catch(() => ({ data: [] }))
            })
          )

          if (cancelled) return

          // Combine all posts and deduplicate by id
          const allPosts = results.flatMap((j: any) => Array.isArray(j?.data) ? j.data : [])
          const uniquePosts = new Map<string, any>()
          for (const p of allPosts) {
            uniquePosts.set(String(p.id), p)
          }

          setPosts(
            Array.from(uniquePosts.values()).map((p: any) => ({
              id: String(p.id),
              title: p.title || '(untitled)',
              slug: p.slug,
              type: p.type,
              locale: p.locale,
              status: p.status,
              url: p.url, // Include resolved URL if available
            }))
          )
        } catch (e) {
          if (!cancelled) setError('Failed to load posts')
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [mode, currentLocale, link])

  const selectedPostId: string | '' =
    link && link.kind === 'post' && link.postId ? String(link.postId) : ''

  const currentTarget: '_self' | '_blank' =
    link && (link as any).target === '_blank' ? '_blank' : '_self'

  // Validate URL to reject internal relative paths or same-domain URLs
  const validateUrl = (url: string): string | null => {
    const trimmed = url.trim()
    if (!trimmed) return null

    // Reject relative paths
    if (trimmed.startsWith('/')) {
      return 'Internal links should use "Post" instead of relative URLs'
    }

    // Reject same-domain URLs
    try {
      const urlObj = new URL(trimmed)
      const currentDomain = window.location.hostname
      if (urlObj.hostname === currentDomain) {
        return 'Internal links should use "Post" instead of full URLs to this site'
      }
    } catch {
      // Invalid URL format - let the browser's native validation handle it
    }

    return null
  }

  const filteredPosts =
    query.trim().length === 0
      ? posts
      : posts.filter((p) => {
        const needle = query.toLowerCase()
        return (
          (p.title || '').toLowerCase().includes(needle) ||
          (p.slug || '').toLowerCase().includes(needle) ||
          (p.type || '').toLowerCase().includes(needle) ||
          (p.locale || '').toLowerCase().includes(needle)
        )
      })

  return (
    <FormField>
      <FormLabel className="block text-[11px] font-bold text-neutral-medium uppercase tracking-wider mb-1.5 ml-1">{label}</FormLabel>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-medium">Link to</span>
          <div className="relative">
            <select
              className="text-xs px-3 py-1.5 border border-line-medium rounded-lg bg-backdrop-low text-neutral-high outline-none focus:ring-2 focus:ring-standout-medium/20 focus:border-standout-medium transition-all appearance-none pr-8"
              value={mode}
              onChange={(e) => {
                const nextMode = e.target.value === 'post' ? 'post' : 'url'
                setMode(nextMode)
                const prevTarget = link && (link as any).target === '_blank' ? '_blank' : '_self'
                if (nextMode === 'url') {
                  const currentUrl = link && link.kind === 'url' ? link.url : ''
                  setLink(currentUrl ? { kind: 'url', url: currentUrl, target: prevTarget } : null)
                } else {
                  // switch to post mode, but keep previous selection if any
                  if (link && link.kind === 'post') {
                    setLink({ ...link, target: prevTarget })
                  } else {
                    setLink(null)
                  }
                }
              }}
            >
              <option value="post">Post</option>
              <option value="url">Custom URL (external only)</option>
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-low">
              <span className="iconify" data-icon="lucide:chevron-down" />
            </div>
          </div>
        </div>

        {mode === 'url' ? (
          <div className="space-y-1.5">
            <Input
              type="url"
              placeholder="https://example.com"
              className="rounded-xl border-line-medium focus:ring-standout-medium/20 focus:border-standout-medium"
              value={link && link.kind === 'url' ? link.url : ''}
              onChange={(e) => {
                const val = e.target.value
                const validationError = validateUrl(val)
                setUrlError(validationError)

                setLink((prev) => {
                  const baseTarget = prev && (prev as any).target === '_blank' ? '_blank' : '_self'
                  const trimmed = val.trim()
                  // Only set the link if validation passes
                  if (validationError) return prev
                  return trimmed ? { kind: 'url', url: trimmed, target: baseTarget } : null
                })
              }}
            />
            {urlError ? (
              <FormHelper className="text-danger ml-1">{urlError}</FormHelper>
            ) : (
              <FormHelper className="ml-1 opacity-70">
                Enter a full URL. Use this for external destinations only. For internal links, use
                &quot;Post&quot;.
              </FormHelper>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2.5 border border-line-medium rounded-xl bg-backdrop-low text-neutral-high hover:bg-backdrop-medium transition-all shadow-sm flex items-center justify-between group"
                >
                  <span className="truncate">
                    {loading
                      ? 'Loading…'
                      : selectedPostId
                        ? (() => {
                          const p = posts.find((x) => x.id === selectedPostId)
                          return p ? `${p.title} (${p.type}, ${p.locale})` : 'Select a post…'
                        })()
                        : 'Select a post…'}
                  </span>
                  <span className="iconify text-neutral-low group-hover:text-neutral-medium transition-colors" data-icon="lucide:search" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-2 rounded-2xl border-line-low shadow-2xl bg-backdrop-low">
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Search posts… (title, slug, type, locale)"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="h-9 text-xs rounded-lg pl-9"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-low">
                      <span className="iconify" data-icon="lucide:search" />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-auto space-y-1 pr-1 custom-scrollbar">
                    {loading ? (
                      <div className="text-xs text-neutral-low p-4 text-center">Loading…</div>
                    ) : filteredPosts.length === 0 ? (
                      <div className="text-xs text-neutral-low p-4 text-center">No posts found.</div>
                    ) : (
                      filteredPosts.map((p) => {
                        const isSelected = selectedPostId === p.id
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${isSelected
                                ? 'border-standout-medium bg-standout-medium/5 ring-1 ring-standout-medium/20'
                                : 'border-transparent hover:bg-backdrop-medium'
                              }`}
                            onClick={() => {
                              setLink({
                                kind: 'post',
                                postId: p.id,
                                postType: p.type,
                                slug: p.slug,
                                locale: p.locale,
                                url: p.url, // Store the resolved URL if available
                              })
                            }}
                          >
                            <div className="text-sm font-semibold text-neutral-high">{p.title}</div>
                            <div className="text-[10px] text-neutral-low font-medium uppercase tracking-tight mt-0.5">
                              {p.type} · {p.locale} · {p.slug}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {error ? (
              <FormHelper className="text-danger ml-1">{error}</FormHelper>
            ) : (
              <FormHelper className="ml-1 opacity-70">
                Choose an existing post. The actual URL will be generated from the post&apos;s
                permalink pattern.
              </FormHelper>
            )}
          </div>
        )}

        {/* Target selection */}
        <div className="space-y-1.5 pt-2 border-t border-line-low/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-medium">Open in</span>
            <div className="relative">
              <select
                className="text-xs px-3 py-1.5 border border-line-medium rounded-lg bg-backdrop-low text-neutral-high outline-none focus:ring-2 focus:ring-standout-medium/20 focus:border-standout-medium transition-all appearance-none pr-8"
                value={currentTarget}
                onChange={(e) => {
                  const nextTarget: '_self' | '_blank' =
                    e.target.value === '_blank' ? '_blank' : '_self'
                  setLink((prev) => {
                    if (!prev) return prev
                    return { ...prev, target: nextTarget }
                  })
                }}
              >
                <option value="_self">Same tab</option>
                <option value="_blank">New tab</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-low">
                <span className="iconify" data-icon="lucide:chevron-down" />
              </div>
            </div>
          </div>
          <FormHelper className="ml-1 opacity-70">
            Use a new tab for outbound links or flows that temporarily take visitors away from the
            site.
          </FormHelper>
        </div>

        {helperText && <FormHelper className="ml-1">{helperText}</FormHelper>}
      </div>
    </FormField>
  )
}
