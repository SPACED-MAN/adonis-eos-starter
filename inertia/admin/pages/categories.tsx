import { useEffect, useMemo, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../components/AdminHeader'
import { AdminFooter } from '../components/AdminFooter'
import { AdminBreadcrumbs } from '../components/AdminBreadcrumbs'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { toast } from 'sonner'

type Taxonomy = { id: string; slug: string; name: string }
type TermNode = {
  id: string
  taxonomyId: string
  parentId: string | null
  slug: string
  name: string
  description: string | null
  orderIndex: number
  children: TermNode[]
}

export default function CategoriesPage() {
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([])
  const [selectedTaxonomy, setSelectedTaxonomy] = useState<string>('') // slug
  const [terms, setTerms] = useState<TermNode[]>([])
  const [selectedTermId, setSelectedTermId] = useState<string>('')
  const [posts, setPosts] = useState<Array<{ id: string; title: string; slug: string; locale: string; type: string; status: string; updatedAt: string }>>([])
  const [newTermName, setNewTermName] = useState<string>('')

  useEffect(() => {
    ; (async () => {
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
    if (!slug) { setTerms([]); return }
    const res = await fetch(`/api/taxonomies/${encodeURIComponent(slug)}/terms`, { credentials: 'same-origin' })
    const json = await res.json().catch(() => ({}))
    const tree: TermNode[] = Array.isArray(json?.data) ? json.data : []
    setTerms(tree)
    setSelectedTermId('')
    setPosts([])
  }

  useEffect(() => {
    loadTerms(selectedTaxonomy)
  }, [selectedTaxonomy])

  async function loadPostsForTerm(id: string) {
    if (!id) { setPosts([]); return }
    const res = await fetch(`/api/taxonomy-terms/${encodeURIComponent(id)}/posts?includeDescendants=1`, { credentials: 'same-origin' })
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

  async function createTerm(parentId: string | null) {
    if (!selectedTaxonomy) return
    const name = newTermName.trim()
    if (!name) {
      toast.error('Enter a name first')
      return
    }
    const res = await fetch(`/api/taxonomies/${encodeURIComponent(selectedTaxonomy)}/terms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
      credentials: 'same-origin',
    })
    if (!res.ok) {
      toast.error('Failed to create term')
      return
    }
    setNewTermName('')
    await loadTerms(selectedTaxonomy)
    toast.success('Term created')
  }

  async function moveTerm(termId: string, newParentId: string | null) {
    const res = await fetch(`/api/taxonomy-terms/${encodeURIComponent(termId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: newParentId }),
      credentials: 'same-origin',
    })
    if (!res.ok) {
      toast.error('Failed to move term')
      return
    }
    await loadTerms(selectedTaxonomy)
    toast.success('Updated')
  }

  async function deleteTerm(termId: string) {
    if (!confirm('Delete this term?')) return
    const res = await fetch(`/api/taxonomy-terms/${encodeURIComponent(termId)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    if (!res.ok) {
      toast.error('Failed to delete term')
      return
    }
    if (selectedTermId === termId) {
      setSelectedTermId('')
      setPosts([])
    }
    await loadTerms(selectedTaxonomy)
    toast.success('Deleted')
  }

  function TermTree({ nodes, depth = 0 }: { nodes: TermNode[]; depth?: number }) {
    return (
      <div className="space-y-1">
        {nodes.map((n) => (
          <div key={n.id} className="flex items-center justify-between gap-2">
            <div
              className={`pl-${Math.min(depth * 4, 24)} flex-1 cursor-pointer ${selectedTermId === n.id ? 'font-semibold' : ''}`}
              onClick={() => {
                setSelectedTermId(n.id)
                loadPostsForTerm(n.id)
              }}
            >
              {n.name}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value="__move__"
                onValueChange={(v) => {
                  if (v === '__stay__') return
                  if (v === '__root__') moveTerm(n.id, null)
                  else moveTerm(n.id, v)
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Move to…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__stay__">Move to…</SelectItem>
                  <SelectItem value="__root__">Root</SelectItem>
                  {allTerms
                    .filter((t) => t.id !== n.id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <button className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium" onClick={() => createTerm(n.id)}>Add Child</button>
              <button className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-red-600" onClick={() => deleteTerm(n.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Head title="Categories" />
      <AdminHeader />
      <main className="flex-1">
        <div className="container mx-auto px-6 py-6">
          <AdminBreadcrumbs items={[{ href: '/admin', label: 'Dashboard' }, { href: '/admin/categories', label: 'Categories' }]} />
          <div className="flex items-center gap-4 mb-4">
            <div className="w-64">
              <Select value={selectedTaxonomy || ''} onValueChange={(v) => setSelectedTaxonomy(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select taxonomy" />
                </SelectTrigger>
                <SelectContent>
                  {taxonomies.map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Input value={newTermName} onChange={(e) => setNewTermName(e.target.value)} placeholder="New term name" />
              <button className="px-3 py-2 text-sm border border-line rounded bg-standout text-on-standout" onClick={() => createTerm(null)}>Add to root</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold mb-2">Terms</h3>
              {terms.length === 0 ? (
                <div className="text-sm text-neutral-low">No terms yet.</div>
              ) : (
                <TermTree nodes={terms} />
              )}
            </div>
            <div>
              <h3 className="font-semibold mb-2">Posts in selected category</h3>
              {selectedTermId ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Locale</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <a className="text-link hover:underline" href={`/admin/posts/${p.id}/edit`}>{p.title}</a>
                        </TableCell>
                        <TableCell>{p.type}</TableCell>
                        <TableCell>{p.locale}</TableCell>
                        <TableCell className="capitalize">{p.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-sm text-neutral-low">Select a term to see its posts.</div>
              )}
            </div>
          </div>
        </div>
      </main>
      <AdminFooter />
    </div>
  )
}



