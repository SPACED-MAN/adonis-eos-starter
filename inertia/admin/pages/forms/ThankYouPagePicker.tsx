import { useEffect, useState } from 'react'
import { Input } from '../../../components/ui/input'

export function ThankYouPagePicker({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    Array<{ id: string; title: string; slug: string; type: string }>
  >([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        params.set('status', 'published')
        params.set('limit', '20')
        params.set('sortBy', 'updated_at')
        params.set('sortOrder', 'desc')
        if (query) params.set('q', query)
        // Prefer pages for thank-you, but allow any type
        const res = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        if (!alive) return
        const list: Array<any> = Array.isArray(j?.data) ? j.data : []
        setResults(
          list.map((p) => ({
            id: String(p.id),
            title: String(p.title || p.slug || p.id),
            slug: String(p.slug || ''),
            type: String(p.type || ''),
          }))
        )
      } catch {
        if (!alive) setResults([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [query])

  const current = results.find((r) => r.id === value)

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-neutral-medium mb-1">Thank You Page</label>
      <div className="flex flex-col gap-2">
        <Input
          placeholder="Search published posts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-40 overflow-auto border border-line-low rounded bg-backdrop-medium/40">
          {loading ? (
            <div className="px-3 py-2 text-xs text-neutral-low">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-low">No results.</div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onChange(r.id)}
                className={`w-full text-left px-3 py-1.5 text-xs ${
                  value === r.id
                    ? 'bg-backdrop-medium text-neutral-high'
                    : 'hover:bg-backdrop-medium/60 text-neutral-medium'
                }`}
              >
                <span className="font-medium">{r.title}</span>
                <span className="ml-1 text-[11px] text-neutral-low font-mono">
                  /{r.slug} · {r.type}
                </span>
              </button>
            ))
          )}
        </div>
        {current && (
          <p className="text-[11px] text-neutral-low">
            Selected: <span className="font-mono">/{current.slug}</span>
          </p>
        )}
        {value && !current && (
          <button
            type="button"
            className="self-start text-[11px] text-danger hover:underline"
            onClick={() => onChange('')}
          >
            Clear selection
          </button>
        )}
      </div>
      <p className="text-[11px] text-neutral-low mt-1">
        If set, successful submissions will redirect to this page instead of showing an inline
        message.
      </p>
    </div>
  )
}
