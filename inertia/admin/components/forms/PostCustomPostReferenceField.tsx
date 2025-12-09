import { useEffect, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Input } from '~/components/ui/input'
import { Checkbox } from '~/components/ui/checkbox'

type Props = {
  label: string
  value: any
  onChange: (val: any) => void
  config?: Record<string, any>
}

export default function PostCustomPostReferenceField({ label, value, onChange, config }: Props) {
  const allowedTypes: string[] = Array.isArray((config as any)?.postTypes) ? (config as any).postTypes : []
  const allowMultiple = (config as any)?.allowMultiple !== false
  const initialVals: string[] = Array.isArray(value) ? value.map((v: any) => String(v)) : value ? [String(value)] : []
  const [vals, setVals] = useState<string[]>(initialVals)
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    onChange(allowMultiple ? vals : (vals[0] ?? null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals, allowMultiple])

  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const params = new URLSearchParams()
          params.set('status', 'published')
          params.set('limit', '100')
          params.set('sortBy', 'published_at')
          params.set('sortOrder', 'desc')
          if (allowedTypes.length > 0) {
            params.set('types', allowedTypes.join(','))
          }
          const res = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
          const j = await res.json().catch(() => ({}))
          const list: Array<{ id: string; title: string; slug?: string }> = Array.isArray(j?.data) ? j.data : []
          if (!alive) return
          setOptions(list.map((p) => ({ label: p.title || p.slug || String(p.id), value: String(p.id) })))
        } catch {
          if (!alive) return
          setOptions([])
        }
      })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allowedTypes)])

  const filteredOptions =
    query.trim().length === 0
      ? options
      : options.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      {vals.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {vals.map((v) => {
            const opt = options.find((o) => o.value === v)
            const text = opt?.label || v
            return (
              <button
                key={v}
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-backdrop-low border border-border px-3 py-1 text-sm text-neutral-high hover:bg-backdrop-medium"
                onClick={() =>
                  setVals((prev) => prev.filter((id) => id !== v))
                }
              >
                <span>{text}</span>
                <span className="text-neutral-low">✕</span>
              </button>
            )
          })}
        </div>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full text-left px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
          >
            {vals.length === 0 ? 'Select posts' : `${vals.length} selected`}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Search posts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="max-h-64 overflow-auto space-y-2">
              {filteredOptions.length === 0 ? (
                <div className="text-xs text-neutral-low">No posts found.</div>
              ) : (
                filteredOptions.map((opt) => {
                  const checked = vals.includes(opt.value)
                  return (
                    <label key={opt.value} className="flex items-center gap-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          setVals((prev) => {
                            if (allowMultiple) {
                              const next = new Set(prev)
                              if (c) next.add(opt.value)
                              else next.delete(opt.value)
                              return Array.from(next)
                            }
                            return c ? [opt.value] : []
                          })
                        }}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}


