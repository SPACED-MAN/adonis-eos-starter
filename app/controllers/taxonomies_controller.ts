import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import taxonomyService from '#services/taxonomy_service'

export default class TaxonomiesController {
  /**
   * GET /api/taxonomies
   */
  async list({ response }: HttpContext) {
    const taxonomies = await taxonomyService.listTaxonomies()
    return response.ok({ data: taxonomies })
  }

  /**
   * GET /api/taxonomies/:slug/terms
   */
  async termsBySlug({ params, response }: HttpContext) {
    const { slug } = params
    const tree = await taxonomyService.getTermsTreeBySlug(String(slug))
    return response.ok({ data: tree })
  }

  /**
   * GET /api/taxonomy-terms/:id/posts
   * List posts assigned to a taxonomy term (does not include descendants by default)
   * Optional query: includeDescendants=1
   */
  async postsForTerm({ params, request, response }: HttpContext) {
    const { id } = params
    const includeDescendants = String(request.input('includeDescendants', '0')).trim() === '1'
    const termIds: string[] = [String(id)]
    if (includeDescendants) {
      const children = await taxonomyService.getDescendantIds(String(id))
      termIds.push(...children)
    }
    const rows = await db
      .from('post_taxonomy_terms as ptt')
      .join('posts as p', 'ptt.post_id', 'p.id')
      .whereIn('ptt.taxonomy_term_id', termIds)
      .select('p.id', 'p.title', 'p.slug', 'p.locale', 'p.type', 'p.status', 'p.updated_at')
      .orderBy('p.updated_at', 'desc')

    return response.ok({
      data: rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        locale: r.locale,
        type: r.type,
        status: r.status,
        updatedAt: r.updated_at,
      })),
      meta: { count: rows.length },
    })
  }

  /**
   * POST /api/taxonomies/:slug/terms
   * Body: { name: string, slug?: string, parentId?: string | null }
   */
  async createTerm({ params, request, response }: HttpContext) {
    const { slug } = params
    const tax = await taxonomyService.getTaxonomyBySlug(String(slug))
    if (!tax) return response.notFound({ error: 'Taxonomy not found' })
    const nameRaw = request.input('name')
    const slugRaw = request.input('slug')
    const parentIdRaw = request.input('parentId')
    const name = String(nameRaw || '').trim()
    if (!name) return response.badRequest({ error: 'name is required' })
    const existingByName = await db
      .from('taxonomy_terms')
      .where('taxonomy_id', tax.id)
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first()
    if (existingByName) {
      return response.badRequest({ error: 'A term with this name already exists in this taxonomy' })
    }
    const parentId = parentIdRaw ? String(parentIdRaw).trim() : null
    const makeSlug = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    let termSlug = String(slugRaw || '').trim() || makeSlug(name)
    if (!termSlug) termSlug = makeSlug(name)
    // Ensure unique within taxonomy by appending -n if needed
    let candidate = termSlug
    let n = 2
    while (true) {
      const exists = await db
        .from('taxonomy_terms')
        .where({ taxonomy_id: tax.id, slug: candidate })
        .first()
      if (!exists) break
      candidate = `${termSlug}-${n++}`
    }
    termSlug = candidate
    // Determine order_index at end of siblings
    let orderIndex = 0
    const query = db.from('taxonomy_terms').where({ taxonomy_id: tax.id })
    if (parentId) {
      query.where('parent_id', parentId)
    } else {
      query.whereNull('parent_id')
    }
    const row = await query.max('order_index as max').first()
    orderIndex = (Number((row as any)?.max) || 0) + 1
    const now = new Date()
    const [created] = await db
      .table('taxonomy_terms')
      .insert({
        taxonomy_id: tax.id,
        parent_id: parentId,
        slug: termSlug,
        name,
        description: null,
        order_index: orderIndex,
        created_at: now,
        updated_at: now,
      })
      .returning('*')
    return response.created({ data: created })
  }

  /**
   * PATCH /api/taxonomy-terms/:id
   * Body: { name?, slug?, parentId?, orderIndex? }
   */
  async updateTerm({ params, request, response }: HttpContext) {
    const { id } = params
    const term = await db.from('taxonomy_terms').where('id', id).first()
    if (!term) return response.notFound({ error: 'Term not found' })
    const nameRaw = request.input('name')
    const slugRaw = request.input('slug')
    const parentIdRaw = request.input('parentId')
    const orderIndexRaw = request.input('orderIndex')
    const updates: Record<string, any> = { updated_at: new Date() }
    if (typeof nameRaw === 'string') updates.name = String(nameRaw).trim()
    if (typeof slugRaw === 'string') {
      const makeSlug = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      let nextSlug = String(slugRaw).trim()
      if (!nextSlug) nextSlug = makeSlug(String(nameRaw || (term as any).name))
      updates.slug = nextSlug
    }
    if (parentIdRaw !== undefined) {
      updates.parent_id = parentIdRaw ? String(parentIdRaw).trim() : null
    }
    if (orderIndexRaw !== undefined && orderIndexRaw !== null) {
      updates.order_index = Number(orderIndexRaw) || 0
    }
    await db.from('taxonomy_terms').where('id', id).update(updates)
    const updated = await db.from('taxonomy_terms').where('id', id).first()
    return response.ok({ data: updated })
  }

  /**
   * DELETE /api/taxonomy-terms/:id
   */
  async destroyTerm({ params, response }: HttpContext) {
    const { id } = params
    await db.from('taxonomy_terms').where('id', id).delete()
    return response.noContent()
  }
}
