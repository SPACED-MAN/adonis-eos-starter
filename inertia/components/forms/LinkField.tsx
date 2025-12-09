import * as React from 'react'
import { Input } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { FormField, FormLabel, FormHelper } from './field'

export type LinkKind = 'post' | 'url'

export type LinkFieldValue =
  | { kind: 'post'; postId: string; postType?: string; slug?: string; locale?: string; target?: '_self' | '_blank' }
  | { kind: 'url'; url: string; target?: '_self' | '_blank' }
  | null

type PostOption = {
  id: string
  title: string
  slug: string
  type: string
  locale: string
  status: string
}

function normalizeLinkValue(raw: any): LinkFieldValue {
  if (!raw) return null
  if (typeof raw === 'string') {
    const url = raw.trim()
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

  React.useEffect(() => {
    onChange(link)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link])

  React.useEffect(() => {
    if (mode !== 'post') return
    let cancelled = false
    setLoading(true)
    setError(null)
      ; (async () => {
        try {
          const params = new URLSearchParams()
          params.set('status', 'published')
          if (currentLocale) params.set('locale', currentLocale)
          params.set('limit', '200')
          const res = await fetch(`/api/posts?${params.toString()}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
          })
          if (!res.ok) {
            throw new Error('Failed to load posts')
          }
          const j = await res.json().catch(() => null)
          const list: any[] = Array.isArray(j?.data) ? j.data : []
          if (cancelled) return
          setPosts(
            list.map((p: any) => ({
              id: String(p.id),
              title: p.title || '(untitled)',
              slug: p.slug,
              type: p.type,
              locale: p.locale,
              status: p.status,
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
  }, [mode, currentLocale])

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
      <FormLabel>{label}</FormLabel>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-low">Link to</span>
          <select
            className="text-xs px-2 py-1 border border-border rounded bg-backdrop-low text-neutral-high"
            value={mode}
            onChange={(e) => {
              const nextMode = e.target.value === 'post' ? 'post' : 'url'
              setMode(nextMode)
              const prevTarget =
                link && (link as any).target === '_blank' ? '_blank' : '_self'
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
        </div>

        {mode === 'url' ? (
          <div className="space-y-1">
            <Input
              type="url"
              placeholder="https://example.com"
              value={link && link.kind === 'url' ? link.url : ''}
              onChange={(e) => {
                const val = e.target.value
                const validationError = validateUrl(val)
                setUrlError(validationError)

                setLink((prev) => {
                  const baseTarget =
                    prev && (prev as any).target === '_blank' ? '_blank' : '_self'
                  const trimmed = val.trim()
                  // Only set the link if validation passes
                  if (validationError) return prev
                  return trimmed ? { kind: 'url', url: trimmed, target: baseTarget } : null
                })
              }}
            />
            {urlError ? (
              <FormHelper className="text-danger">{urlError}</FormHelper>
            ) : (
              <FormHelper>
                Enter a full URL. Use this for external destinations only. For internal links, use &quot;Post&quot;.
              </FormHelper>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
                >
                  {loading
                    ? 'Loading…'
                    : selectedPostId
                      ? (() => {
                          const p = posts.find((x) => x.id === selectedPostId)
                          return p
                            ? `${p.title} (${p.type}, ${p.locale})`
                            : 'Select a post…'
                        })()
                      : 'Select a post…'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-96">
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Search posts… (title, slug, type, locale)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <div className="max-h-64 overflow-auto space-y-2">
                    {loading ? (
                      <div className="text-xs text-neutral-low">Loading…</div>
                    ) : filteredPosts.length === 0 ? (
                      <div className="text-xs text-neutral-low">No posts found.</div>
                    ) : (
                      filteredPosts.map((p) => {
                        const isSelected = selectedPostId === p.id
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 rounded border ${
                              isSelected ? 'border-standout bg-standout/5' : 'border-border'
                            } hover:bg-backdrop-low`}
                            onClick={() => {
                              setLink({
                                kind: 'post',
                                postId: p.id,
                                postType: p.type,
                                slug: p.slug,
                                locale: p.locale,
                              })
                            }}
                          >
                            <div className="text-sm text-neutral-high">{p.title}</div>
                            <div className="text-[11px] text-neutral-low">
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
              <FormHelper className="text-danger">{error}</FormHelper>
            ) : (
              <FormHelper>
                Choose an existing post. The actual URL will be generated from the post&apos;s permalink pattern.
              </FormHelper>
            )}
          </div>
        )}

        {/* Target selection */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-low">Open in</span>
            <select
              className="text-xs px-2 py-1 border border-border rounded bg-backdrop-low text-neutral-high"
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
          </div>
          <FormHelper>
            Use a new tab for outbound links or flows that temporarily take visitors away from the site.
          </FormHelper>
        </div>

        {helperText && <FormHelper>{helperText}</FormHelper>}
      </div>
    </FormField>
  )
}


