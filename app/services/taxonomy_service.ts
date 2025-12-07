import taxonomyRegistry, { type RegisteredTaxonomyConfig } from '#services/taxonomy_registry'
import Taxonomy from '#models/taxonomy'
import TaxonomyTerm from '#models/taxonomy_term'

export type Taxonomy = {
  id: string
  slug: string
  name: string
  hierarchical: boolean
  freeTagging: boolean
  maxSelections: number | null
}
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
  getConfig(slug: string): RegisteredTaxonomyConfig | undefined {
    return taxonomyRegistry.get(slug)
  }

  async listTaxonomies(): Promise<Taxonomy[]> {
    const rows = await Taxonomy.query().orderBy('name', 'asc')
    return rows.map((r) => {
      const cfg = taxonomyRegistry.get(r.slug)
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        hierarchical: !!cfg?.hierarchical,
        freeTagging: !!cfg?.freeTagging,
        maxSelections:
          cfg?.maxSelections === undefined || cfg?.maxSelections === null
            ? null
            : Number(cfg.maxSelections),
      }
    })
  }

  async getTaxonomyBySlug(slug: string): Promise<Taxonomy | null> {
    return Taxonomy.query().where('slug', slug).first()
  }

  async listTermsFlat(taxonomyId: string): Promise<TaxonomyTerm[]> {
    return TaxonomyTerm.query()
      .where('taxonomyId', taxonomyId)
      .orderBy('orderIndex', 'asc')
      .orderBy('name', 'asc')
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
    const term = await TaxonomyTerm.query().where('id', termId).first()
    if (!term) return []
    const flat = await this.listTermsFlat(term.taxonomyId)
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
