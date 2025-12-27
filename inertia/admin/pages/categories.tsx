import { useEffect, useMemo, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../components/AdminHeader'
import { AdminFooter } from '../components/AdminFooter'
import { Input } from '../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { DragHandle } from '../components/ui/DragHandle'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { CustomFieldRenderer } from '../components/CustomFieldRenderer'
import type { CustomFieldDefinition } from '~/types/custom_field'

type Taxonomy = {
  id: string
  slug: string
  name: string
  hierarchical?: boolean
  customFieldDefs?: CustomFieldDefinition[]
}
type TermNode = {
  id: string
  taxonomyId: string
  parentId: string | null
  slug: string
  name: string
  description: string | null
  orderIndex: number
  children: TermNode[]
  customFields?: Record<string, any>
}

function getXsrf(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

export default function CategoriesPage() {
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([])
  const [selectedTaxonomy, setSelectedTaxonomy] = useState<string>('') // slug
  const [terms, setTerms] = useState<TermNode[]>([])
  const [selectedTermId, setSelectedTermId] = useState<string>('')
  const [posts, setPosts] = useState<
    Array<{
      id: string
      title: string
      slug: string
      locale: string
      type: string
      status: string
      updatedAt: string
    }>
  >([])
  const [newTermName, setNewTermName] = useState<string>('')
  const [viewMode, setViewMode] = useState<'terms' | 'termPosts'>('terms')
  const [editingTerm, setEditingTerm] = useState<TermNode | null>(null)
  const [editingTermDraft, setEditingTermDraft] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/taxonomies', { credentials: 'same-origin' })
        const json = await res.json().catch(() => ({}))
        const list: Taxonomy[] = Array.isArray(json?.data) ? json.data : []
        setTaxonomies(list)
        if (!selectedTaxonomy && list.length > 0) {
          setSelectedTaxonomy(list[0].slug)
        }
      } catch {
        setTaxonomies([])
      }
    })()
  }, [])

  async function loadTerms(slug: string) {
    if (!slug) {
      setTerms([])
      return
    }
    const res = await fetch(`/api/taxonomies/${encodeURIComponent(slug)}/terms`, {
      credentials: 'same-origin',
    })
    const json = await res.json().catch(() => ({}))
    const tree: TermNode[] = Array.isArray(json?.data) ? json.data : []
    setTerms(tree)
    setSelectedTermId('')
    setEditingTerm(null)
    setPosts([])
    setViewMode('terms')
  }

  useEffect(() => {
    loadTerms(selectedTaxonomy)
  }, [selectedTaxonomy])

  async function loadPostsForTerm(id: string) {
    if (!id) {
      setPosts([])
      return
    }
    const res = await fetch(
      `/api/taxonomy-terms/${encodeURIComponent(id)}/posts?includeDescendants=1`,
      { credentials: 'same-origin' }
    )
    const json = await res.json().catch(() => ({}))
    const list: any[] = Array.isArray(json?.data) ? json.data : []
    setPosts(list as any)
  }

  function flattenTerms(nodes: TermNode[]): TermNode[] {
    const out: TermNode[] = []
    const walk = (arr: TermNode[]) => {
      for (const n of arr) {
        out.push(n)
        if (n.children?.length) walk(n.children)
      }
    }
    walk(nodes)
    return out
  }

  const allTerms = useMemo(() => flattenTerms(terms), [terms])

  const flatRows = useMemo(() => {
    const out: Array<{ term: TermNode; level: number }> = []
    const walk = (nodes: TermNode[], level: number) => {
      for (const n of nodes) {
        out.push({ term: n, level })
        if (n.children?.length) walk(n.children, level + 1)
      }
    }
    walk(terms, 0)
    return out
  }, [terms])

  async function createTerm(parentId: string | null) {
    if (!selectedTaxonomy) return
    const name = newTermName.trim()
    if (!name) {
      toast.error('Enter a name first')
      return
    }
    const res = await fetch(`/api/taxonomies/${encodeURIComponent(selectedTaxonomy)}/terms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
      },
      body: JSON.stringify({ name, parentId }),
      credentials: 'same-origin',
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j?.error || 'Failed to create term')
      return
    }
    setNewTermName('')
    await loadTerms(selectedTaxonomy)
    toast.success('Term created')
  }

  async function moveTerm(termId: string, newParentId: string | null) {
    const res = await fetch(`/api/taxonomy-terms/${encodeURIComponent(termId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
      },
      body: JSON.stringify({ parentId: newParentId }),
      credentials: 'same-origin',
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j?.error || 'Failed to move term')
      return
    }
    await loadTerms(selectedTaxonomy)
    toast.success('Updated')
  }

  async function saveTermCustomFields() {
    if (!editingTerm) return
    try {
      setSaving(true)
      const res = await fetch(`/api/taxonomy-terms/${encodeURIComponent(editingTerm.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        body: JSON.stringify({ customFields: editingTermDraft }),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'Failed to save')
      }
      toast.success('Fields saved')
      await loadTerms(selectedTaxonomy)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTerm(termId: string) {
    if (!confirm('Delete this term?')) return
    const res = await fetch(`/api/taxonomy-terms/${encodeURIComponent(termId)}`, {
      method: 'DELETE',
      headers: {
        ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
      },
      credentials: 'same-origin',
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j?.error || 'Failed to delete term')
      return
    }
    if (selectedTermId === termId) {
      setSelectedTermId('')
      setPosts([])
    }
    await loadTerms(selectedTaxonomy)
    toast.success('Deleted')
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const selectedTax = taxonomies.find((t) => t.slug === selectedTaxonomy)
    if (selectedTax && selectedTax.hierarchical === false) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const idToParent = new Map<string, string | null>()
    allTerms.forEach((t) => idToParent.set(t.id, t.parentId))
    const activeParent = idToParent.get(activeId) ?? null
    const overParent = idToParent.get(overId) ?? null
    // Only reorder within the same parent (re-nesting still uses the Move selector)
    if (activeParent !== overParent) return
    const siblings = allTerms
      .filter((t) => (t.parentId ?? null) === (activeParent ?? null))
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((t) => t.id)
    const fromIndex = siblings.indexOf(activeId)
    const toIndex = siblings.indexOf(overId)
    if (fromIndex === -1 || toIndex === -1) return
    const next = siblings.slice()
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    // Persist new order indices for this sibling group
    try {
      await Promise.all(
        next.map((id, index) =>
          fetch(`/api/taxonomy-terms/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
            },
            credentials: 'same-origin',
            body: JSON.stringify({ orderIndex: index }),
          })
        )
      )
      await loadTerms(selectedTaxonomy)
    } catch {
      toast.error('Failed to update order')
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Categories" />
      <AdminHeader title="Categories" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mt-4 bg-backdrop-low rounded-lg shadow border border-line-low p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-64">
              <Select value={selectedTaxonomy || ''} onValueChange={(v) => setSelectedTaxonomy(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select taxonomy" />
                </SelectTrigger>
                <SelectContent>
                  {taxonomies.map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={newTermName}
                onChange={(e) => setNewTermName(e.target.value)}
                placeholder="New term name"
              />
              <button
                className="px-3 py-1.5 text-sm border border-line-low rounded bg-standout-medium text-on-standout whitespace-nowrap"
                onClick={() => createTerm(null)}
              >
                Add term
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold mb-2">Terms</h3>
              {terms.length === 0 ? (
                <div className="text-sm text-neutral-low">No terms yet.</div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={flatRows.map((r) => r.term.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {flatRows.map(({ term, level }) => (
                        <SortableTermRow
                          key={term.id}
                          term={term}
                          level={level}
                          allTerms={allTerms}
                          isSelected={selectedTermId === term.id}
                          onSelect={() => {
                            setSelectedTermId(term.id)
                          }}
                          onEdit={async () => {
                            setSelectedTermId(term.id)
                            setEditingTerm(term)
                            setEditingTermDraft(term.customFields || {})
                            setViewMode('termPosts')
                            await loadPostsForTerm(term.id)
                          }}
                          onMove={async (targetId) => {
                            if (targetId === '__root__') await moveTerm(term.id, null)
                            else if (targetId && targetId !== '__stay__')
                              await moveTerm(term.id, targetId)
                          }}
                          onAddChild={() => createTerm(term.id)}
                          onDelete={() => deleteTerm(term.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
          {viewMode === 'termPosts' && editingTerm && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-neutral-high">Custom Fields</h3>
                  <button
                    type="button"
                    className="px-3 py-1 text-xs bg-standout-medium text-on-standout rounded hover:opacity-90 disabled:opacity-50"
                    onClick={saveTermCustomFields}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save Fields'}
                  </button>
                </div>
                <div className="bg-backdrop-medium/10 border border-line-low rounded-xl p-5">
                  {(() => {
                    const tax = taxonomies.find((t) => t.slug === selectedTaxonomy)
                    const defs = tax?.customFieldDefs || []
                    if (defs.length === 0) {
                      return (
                        <p className="text-xs text-neutral-low italic">
                          No custom fields defined for this taxonomy.
                        </p>
                      )
                    }

                    return (
                      <CustomFieldRenderer
                        definitions={defs}
                        values={editingTermDraft}
                        onChange={(slug, val) =>
                          setEditingTermDraft((prev) => ({
                            ...prev,
                            [slug]: val,
                          }))
                        }
                      />
                    )
                  })()}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-neutral-high">Posts in “{editingTerm.name}”</h3>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs border border-line-low rounded text-neutral-medium hover:bg-backdrop-medium"
                    onClick={() => {
                      setViewMode('terms')
                      setEditingTerm(null)
                      setSelectedTermId('')
                      setPosts([])
                    }}
                  >
                    Back to terms
                  </button>
                </div>
                {posts.length === 0 ? (
                  <div className="text-sm text-neutral-low italic bg-backdrop-medium/10 border border-line-low rounded-xl p-8 text-center">
                    No posts in this term yet.
                  </div>
                ) : (
                  <div className="bg-backdrop-low border border-line-low rounded-xl overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider">
                            Title
                          </TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">
                            Type
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {posts.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              <a
                                className="text-standout-medium hover:text-standout-high transition-colors"
                                href={`/admin/posts/${p.id}/edit`}
                              >
                                {p.title}
                              </a>
                              <div className="text-[10px] text-neutral-low mt-0.5 uppercase tracking-tighter">
                                {p.locale} · {p.status}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-backdrop-medium text-neutral-medium uppercase tracking-tight">
                                {p.type}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}

function SortableTermRow({
  term,
  level,
  allTerms,
  isSelected,
  onSelect,
  onEdit,
  onMove,
  onAddChild,
  onDelete,
}: {
  term: TermNode
  level: number
  allTerms: TermNode[]
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onMove: (targetId: string) => void
  onAddChild: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: term.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between gap-2">
      <div
        className={`flex-1 cursor-pointer ${isSelected ? 'font-semibold' : ''}`}
        style={{ paddingLeft: level * 12 }}
        onClick={onSelect}
      >
        <DragHandle className="mr-2" {...listeners} {...attributes} aria-label="Drag to reorder" />
        <span>{term.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium"
          onClick={onEdit}
        >
          Edit
        </button>
        <Select
          value="__move__"
          onValueChange={(v) => {
            if (v === '__stay__') return
            onMove(v)
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Move to…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__stay__">Move to…</SelectItem>
            <SelectItem value="__root__">Root</SelectItem>
            {allTerms
              .filter((t) => t.id !== term.id)
              .map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium"
          onClick={onAddChild}
        >
          Add Child
        </button>
        <button
          type="button"
          className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-red-600"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
