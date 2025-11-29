import db from '@adonisjs/lucid/services/db'

export type Taxonomy = { id: string; slug: string; name: string }
export type TaxonomyTerm = {
  id: string
  taxonomyId: string
  parentId: string | null
  slug: string
  name: string
  description: string | null
  orderIndex: number
}

export type TaxonomyTermNode = TaxonomyTerm & { children: TaxonomyTermNode[] }

class TaxonomyService {
  async listTaxonomies(): Promise<Taxonomy[]> {
    const rows = await db.from('taxonomies').select('*').orderBy('name', 'asc')
    return rows.map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
    }))
  }

  async getTaxonomyBySlug(slug: string): Promise<Taxonomy | null> {
    const row = await db.from('taxonomies').where('slug', slug).first()
    if (!row) return null
    return { id: (row as any).id, slug: (row as any).slug, name: (row as any).name }
  }

  async listTermsFlat(taxonomyId: string): Promise<TaxonomyTerm[]> {
    const rows = await db
      .from('taxonomy_terms')
      .where('taxonomy_id', taxonomyId)
      .orderBy('order_index', 'asc')
      .orderBy('name', 'asc')
    return rows.map((r: any) => ({
      id: r.id,
      taxonomyId: r.taxonomy_id,
      parentId: r.parent_id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      orderIndex: r.order_index,
    }))
  }

  async getTermsTreeBySlug(slug: string): Promise<TaxonomyTermNode[]> {
    const tax = await this.getTaxonomyBySlug(slug)
    if (!tax) return []
    const flat = await this.listTermsFlat(tax.id)
    return this.buildTree(flat)
  }

  buildTree(flat: TaxonomyTerm[]): TaxonomyTermNode[] {
    const idToNode = new Map<string, TaxonomyTermNode>()
    const roots: TaxonomyTermNode[] = []
    for (const t of flat) {
      idToNode.set(t.id, { ...t, children: [] })
    }
    for (const t of flat) {
      const node = idToNode.get(t.id)!
      if (t.parentId && idToNode.has(t.parentId)) {
        idToNode.get(t.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }

  async getDescendantIds(termId: string): Promise<string[]> {
    const term = await db.from('taxonomy_terms').where('id', termId).first()
    if (!term) return []
    const taxonomyId = (term as any).taxonomy_id as string
    const flat = await this.listTermsFlat(taxonomyId)
    const childrenByParent = new Map<string, TaxonomyTerm[]>()
    for (const t of flat) {
      const pid = t.parentId || '__root__'
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
      childrenByParent.get(pid)!.push(t)
    }
    const out: string[] = []
    const stack: string[] = [termId]
    while (stack.length) {
      const cur = stack.pop()!
      const kids = childrenByParent.get(cur) || []
      for (const k of kids) {
        out.push(k.id)
        stack.push(k.id)
      }
    }
    return out
  }
}

const taxonomyService = new TaxonomyService()
export default taxonomyService



