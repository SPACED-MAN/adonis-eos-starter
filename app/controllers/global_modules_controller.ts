import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class GlobalModulesController {
  /**
   * GET /api/modules/global
   * GET /api/modules/static
   * Query: q?, type?
   */
  async index({ request, response, route }: HttpContext) {
    const scope: 'global' | 'static' = (route?.pattern || '').includes('/static')
      ? 'static'
      : 'global'
    const q = String(request.input('q', '')).trim()
    const type = String(request.input('type', '')).trim()
    const query = db.from('module_instances').where('scope', scope)
    if (q) {
      query.andWhereILike('global_slug', `%${q}%`)
    }
    if (type) {
      query.andWhere('type', type)
    }
    const rows = await query.orderBy('updated_at', 'desc')
    // Fetch usage counts in one shot
    const ids = rows.map((r: any) => r.id)
    let usageMap = new Map<string, number>()
    if (ids.length > 0) {
      const usageRows = await db
        .from('post_modules')
        .whereIn('module_id', ids)
        .groupBy('module_id')
        .select('module_id')
        .count('* as cnt')
      usageMap = new Map(usageRows.map((r: any) => [String(r.module_id), Number(r.cnt || 0)]))
    }
    return response.ok({
      data: rows.map((r: any) => ({
        id: r.id,
        scope: r.scope,
        type: r.type,
        globalSlug: r.global_slug || null,
        label: (r as any).global_label || null,
        props: r.props || {},
        updatedAt: r.updated_at,
        usageCount: usageMap.get(String(r.id)) || 0,
      })),
    })
  }

  /**
   * POST /api/modules/global
   * Body: { type: string, globalSlug: string, props?: any }
   * Admin only; editors cannot create global/static modules
   */
  async create({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (role !== 'admin') return response.forbidden({ error: 'Admin only' })
    const type = String(request.input('type', '')).trim()
    const labelRaw = request.input('label')
    const globalSlugRaw = request.input('globalSlug')
    const label = labelRaw === undefined || labelRaw === null ? null : String(labelRaw).trim()
    let globalSlug =
      globalSlugRaw === undefined || globalSlugRaw === null ? '' : String(globalSlugRaw).trim()
    if (!globalSlug && label) {
      globalSlug = label
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')
    }
    const props = request.input('props') || {}
    if (!type) return response.badRequest({ error: 'type is required' })
    if (!globalSlug) return response.badRequest({ error: 'globalSlug is required' })
    try {
      const now = new Date()
      // Ensure unique per constraint (scope, global_slug)
      const [row] = await db
        .table('module_instances')
        .insert({
          scope: 'global',
          type,
          global_slug: globalSlug,
          global_label: label,
          props,
          created_at: now,
          updated_at: now,
        })
        .returning('*')
      return response.created({
        data: {
          id: (row as any).id,
          scope: (row as any).scope,
          type: (row as any).type,
          globalSlug: (row as any).global_slug,
          label: (row as any).global_label || null,
          props: (row as any).props || {},
          updatedAt: (row as any).updated_at,
          usageCount: 0,
        },
      })
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase()
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return response.badRequest({ error: 'A global module with that slug already exists' })
      }
      return response.badRequest({ error: e?.message || 'Failed to create' })
    }
  }

  /**
   * PUT /api/modules/global/:id
   * Body: { globalSlug?, props? }
   */
  async update({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (role !== 'admin') return response.forbidden({ error: 'Admin only' })
    const { id } = params
    const globalSlugRaw = request.input('globalSlug')
    const labelRaw = request.input('label')
    const propsRaw = request.input('props')
    const update: any = { updated_at: new Date() }
    if (globalSlugRaw !== undefined) update.global_slug = String(globalSlugRaw).trim()
    if (labelRaw !== undefined)
      update.global_label = labelRaw === null ? null : String(labelRaw).trim()
    if (propsRaw !== undefined) update.props = propsRaw
    try {
      const count = await db
        .from('module_instances')
        .where('id', id)
        .andWhere('scope', 'global')
        .update(update)
      if (!count) return response.notFound({ error: 'Global module not found' })
      return response.ok({ message: 'Updated' })
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase()
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return response.badRequest({ error: 'A global module with that slug already exists' })
      }
      return response.badRequest({ error: e?.message || 'Failed to update' })
    }
  }

  /**
   * DELETE /api/modules/global/:id
   * Only allowed when usageCount = 0
   */
  async destroy({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (role !== 'admin') return response.forbidden({ error: 'Admin only' })
    const { id } = params
    const usage = await db.from('post_modules').where('module_id', id).count('* as cnt')
    const cnt = Number((usage?.[0] as any)?.cnt || 0)
    if (cnt > 0)
      return response.badRequest({ error: 'Cannot delete a module while it is referenced' })
    const deleted = await db
      .from('module_instances')
      .where('id', id)
      .andWhere('scope', 'global')
      .delete()
    if (!deleted) return response.notFound({ error: 'Global module not found' })
    return response.noContent()
  }
}
