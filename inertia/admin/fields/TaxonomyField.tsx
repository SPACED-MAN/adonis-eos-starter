import { useEffect, useState } from 'react'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'

type Props = {
  value: string | string[] | null
  onChange: (val: string | string[] | null) => void
  taxonomySlug?: string
  multiple?: boolean
}

type Term = { id: string; name: string }

export default function TaxonomyField({ value, onChange, taxonomySlug, multiple }: Props) {
  const [terms, setTerms] = useState<Term[]>([])

  useEffect(() => {
    if (!taxonomySlug) {
      setTerms([])
      return
    }
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/taxonomies/${encodeURIComponent(taxonomySlug)}/terms`, {
          credentials: 'same-origin',
        })
        const j = await res.json().catch(() => ({}))
        if (!alive) return
        const list: Term[] = Array.isArray(j?.data)
          ? j.data.map((t: any) => ({ id: String(t.id), name: String(t.name) }))
          : []
        setTerms(list)
      } catch {
        if (alive) setTerms([])
      }
    })()
    return () => {
      alive = false
    }
  }, [taxonomySlug])

  if (!taxonomySlug || terms.length === 0) {
    return (
      <Input
        value={Array.isArray(value) ? value.join(', ') : value ?? ''}
        onChange={(e) => onChange(e.target.value ? e.target.value.split(',').map((s) => s.trim()) : null)}
        placeholder="Enter term IDs"
      />
    )
  }

  const selected = new Set(Array.isArray(value) ? value : value ? [value] : [])

  const toggle = (id: string, checked: boolean) => {
    if (multiple) {
      const next = new Set(selected)
      if (checked) next.add(id)
      else next.delete(id)
      onChange(Array.from(next))
    } else {
      onChange(checked ? id : null)
    }
  }

  return (
    <div className="space-y-2">
      {terms.map((t) => {
        const checked = selected.has(t.id)
        return (
          <label key={t.id} className="flex items-center gap-2 text-sm text-neutral-high">
            <Checkbox checked={checked} onCheckedChange={(c) => toggle(t.id, !!c)} />
            <span>{t.name}</span>
          </label>
        )
      })}
    </div>
  )
}

