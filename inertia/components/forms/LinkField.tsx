import * as React from 'react'
import { Input } from '~/components/ui/input'
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
  const [mode, setMode] = React.useState<LinkKind>(initial?.kind === 'post' ? 'post' : 'url')
  const [link, setLink] = React.useState<LinkFieldValue>(initial)
  const [posts, setPosts] = React.useState<PostOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    onChange(link)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link])

  React.useEffect(() => {
    if (mode !== 'post') return
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const params = new URLSearchParams()
        params.set('status', 'published')
        if (currentLocale) params.set('locale', currentLocale)
        params.set('limit', '50')
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
            <option value="url">Custom URL</option>
            <option value="post">Existing post</option>
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
                setLink((prev) => {
                  const baseTarget =
                    prev && (prev as any).target === '_blank' ? '_blank' : '_self'
                  const trimmed = val.trim()
                  return trimmed ? { kind: 'url', url: trimmed, target: baseTarget } : null
                })
              }}
            />
            <FormHelper>
              Enter a full URL. Use this for external destinations or when you don&apos;t want to bind to a specific post.
            </FormHelper>
          </div>
        ) : (
          <div className="space-y-1">
            <select
              className="w-full px-2 py-1 text-sm border border-border rounded bg-backdrop-low text-neutral-high"
              value={selectedPostId}
              disabled={loading}
              onChange={(e) => {
                const postId = e.target.value
                if (!postId) {
                  setLink(null)
                  return
                }
                const p = posts.find((x) => x.id === postId)
                setLink({
                  kind: 'post',
                  postId,
                  postType: p?.type,
                  slug: p?.slug,
                  locale: p?.locale,
                })
              }}
            >
              <option value="">{loading ? 'Loading…' : 'Select a post…'}</option>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.type}, {p.locale})
                </option>
              ))}
            </select>
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


