import { useEffect, useState } from 'react'
import { useInlineEditor } from './InlineEditorContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'

type PostOption = {
  id: string
  title: string
  slug: string
  type: string
  locale?: string
}

type ValueShape =
  | string
  | { id?: string; slug?: string; locale?: string }
  | Array<string | { id?: string; slug?: string; locale?: string }>
  | null
  | undefined

interface EditablePostReferenceProps {
  moduleId: string
  path: string
  multiple?: boolean
  postType?: string
  label?: string
}

export function EditablePostReference({
  moduleId,
  path,
  multiple,
  postType,
  label,
}: EditablePostReferenceProps) {
  const { getValue, setValue, enabled } = useInlineEditor()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<PostOption[]>([])
  const [selectedMeta, setSelectedMeta] = useState<Record<string, PostOption>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = getValue(moduleId, path, multiple ? [] : null) as ValueShape

  const normalize = (val: ValueShape): string[] => {
    if (val == null) return []
    if (Array.isArray(val)) {
      return val.map((v) => (typeof v === 'string' ? v : v.id || v.slug || '')).filter(Boolean)
    }
    if (typeof val === 'string') return [val]
    return [val.id || val.slug || '']
  }

  const selectedIds = normalize(current)

  const selectedLabels = (id: string) => {
    const hit = options.find((o) => o.id === id)
    return hit ? `${hit.title} (${hit.type}${hit.locale ? ` · ${hit.locale}` : ''})` : id
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams()
        params.set('status', 'published')
        params.set('limit', '50')
        if (postType) params.set('type', postType)
        if (query.trim()) params.set('search', query.trim())
        const res = await fetch(`/api/posts?${params.toString()}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) throw new Error('Failed to load posts')
        const j = await res.json().catch(() => null)
        const list: any[] = Array.isArray(j?.data) ? j.data : []
        if (cancelled) return
        setOptions(
          list.map((p) => ({
            id: String(p.id),
            title: p.title || '(untitled)',
            slug: p.slug,
            type: p.type,
            locale: p.locale,
          }))
        )
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message || 'Failed to load posts')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, query])

  // fetch metadata for already-selected ids so badges show titles immediately
  useEffect(() => {
    const missing = selectedIds.filter((id) => !selectedMeta[id])
    if (!missing.length) return
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams()
        params.set('status', 'published')
        params.set('limit', '50')
        params.set('ids', missing.join(','))
        if (postType) params.set('type', postType)
        const res = await fetch(`/api/posts?${params.toString()}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) throw new Error('Failed to load selected posts')
        const j = await res.json().catch(() => null)
        const list: any[] = Array.isArray(j?.data) ? j.data : []
        if (cancelled) return
        setSelectedMeta((prev) => {
          const next = { ...prev }
          list.forEach((p: any) => {
            const id = String(p.id)
            next[id] = {
              id,
              title: p.title || '(untitled)',
              slug: p.slug,
              type: p.type,
              locale: p.locale,
            }
          })
          return next
        })
      } catch {
        // ignore; badges will fall back to id
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedIds, postType, selectedMeta])

  const toggleSelect = (id: string) => {
    if (multiple) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
      setValue(moduleId, path, next)
    } else {
      setValue(moduleId, path, id)
      setOpen(false)
    }
  }

  const buttonLabel = () => {
    if (!selectedIds.length) return 'Select posts'
    if (selectedIds.length === 1) return '1 post selected'
    return `${selectedIds.length} posts selected`
  }

  // prefer fetched metadata or live options for labels
  const labelForId = (id: string) => {
    const fromMeta = selectedMeta[id]
    if (fromMeta)
      return `${fromMeta.title} (${fromMeta.type}${fromMeta.locale ? ` · ${fromMeta.locale}` : ''})`
    const hit = options.find((o) => o.id === id)
    if (hit) return `${hit.title} (${hit.type}${hit.locale ? ` · ${hit.locale}` : ''})`
    return id
  }

  if (!enabled) return null

  return (
    <>
      <button
        type="button"
        className="text-sm text-standout-high underline underline-offset-2"
        onClick={() => setOpen(true)}
        data-inline-path={path}
        data-inline-type="post-reference"
      >
        {label || buttonLabel()}
      </button>
      {selectedIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-backdrop-high border border-line-low px-2 py-1 text-xs text-neutral-high"
            >
              {labelForId(id)}
              <button
                type="button"
                className="text-neutral-medium hover:text-neutral-high"
                onClick={() =>
                  multiple
                    ? setValue(
                        moduleId,
                        path,
                        selectedIds.filter((x) => x !== id)
                      )
                    : setValue(moduleId, path, null)
                }
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{label || 'Select posts'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search posts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9"
            />
            <div className="max-h-64 overflow-auto space-y-1">
              {loading ? (
                <div className="text-xs text-neutral-low px-1 py-2">Loading…</div>
              ) : error ? (
                <div className="text-xs text-danger px-1 py-2">{error}</div>
              ) : options.length === 0 ? (
                <div className="text-xs text-neutral-low px-1 py-2">No posts found.</div>
              ) : (
                options.map((p) => {
                  const isSelected = selectedIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 rounded border text-sm ${
                        isSelected ? 'border-standout-medium bg-standout-medium/5' : 'border-border'
                      } hover:bg-backdrop-low`}
                      onClick={() => toggleSelect(p.id)}
                    >
                      <div className="text-neutral-high">{p.title}</div>
                      <div className="text-[11px] text-neutral-low">
                        {p.type} · {p.locale || 'default'} · {p.slug}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
            {multiple && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded bg-standout-medium text-on-high text-sm"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
