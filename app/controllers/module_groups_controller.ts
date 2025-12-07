import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class ModuleGroupsController {
  /**
   * GET /api/module-groups
   */
  async index({ request, response }: HttpContext) {
    const postType = String(request.input('postType', '')).trim()
    const q = String(request.input('q', '')).trim()
    const query = db.from('module_groups').select('*').orderBy('updated_at', 'desc')
    if (postType) query.where('post_type', postType)
    if (q) query.whereILike('name', `%${q}%`)
    const rows = await query
    return response.ok({ data: rows })
  }

  /**
   * POST /api/module-groups
   * Body: { name, postType, description?, locked? }
   */
  async store({ request, response }: HttpContext) {
    const {
      name,
      postType,
      description = null,
      locked = false,
    } = request.only(['name', 'postType', 'description', 'locked'])
    if (!name || !postType) return response.badRequest({ error: 'name and postType are required' })
    const now = new Date()
    const [row] = await db
      .table('module_groups')
      .insert({
        name,
        post_type: postType,
        description,
        locked: !!locked,
        created_at: now,
        updated_at: now,
      })
      .returning('*')
    return response.created({ data: row })
  }

  /**
   * PUT /api/module-groups/:id
   */
  async update({ params, request, response }: HttpContext) {
    const { id } = params
    const payload = request.only(['name', 'postType', 'description', 'locked'])
    const updates: Record<string, any> = { updated_at: new Date() }
    if (payload.name !== undefined) updates.name = payload.name
    if (payload.postType !== undefined) updates.post_type = payload.postType
    if (payload.description !== undefined) updates.description = payload.description
    if (payload.locked !== undefined) updates.locked = !!payload.locked
    const [row] = await db.from('module_groups').where('id', id).update(updates).returning('*')
    if (!row) return response.notFound({ error: 'Module group not found' })
    return response.ok({ data: row })
  }

  /**
   * DELETE /api/module-groups/:id
   */
  async destroy({ params, response }: HttpContext) {
    const { id } = params
    const deleted = await db.from('module_groups').where('id', id).delete()
    if (!deleted) return response.notFound({ error: 'Module group not found' })
    return response.noContent()
  }

  /**
   * GET /api/module-groups/:id/modules
   */
  async listModules({ params, response }: HttpContext) {
    const { id } = params
    const rows = await db
      .from('module_group_modules')
      .where('module_group_id', id)
      .orderBy('order_index', 'asc')
    return response.ok({ data: rows })
  }

  /**
   * POST /api/module-groups/:id/modules
   * Body: { type, defaultProps?, locked? }
   */
  async addModule({ params, request, response }: HttpContext) {
    const { id } = params
    const {
      type,
      defaultProps = {},
      locked = false,
      scope = 'post',
      globalSlug = null,
    } = request.only(['type', 'defaultProps', 'locked', 'scope', 'globalSlug'])
    if (!type) return response.badRequest({ error: 'type is required' })
    const [{ max }] = await db
      .from('module_group_modules')
      .where('module_group_id', id)
      .max('order_index as max')
    const now = new Date()
    const [row] = await db
      .table('module_group_modules')
      .insert({
        module_group_id: id,
        type,
        default_props: defaultProps || {},
        scope: String(scope || 'post'),
        global_slug: globalSlug ? String(globalSlug) : null,
        order_index: (Number(max || 0) | 0) + 1,
        locked: !!locked,
        created_at: now,
        updated_at: now,
      })
      .returning('*')
    return response.created({ data: row })
  }

  /**
   * PUT /api/module-groups/modules/:moduleId
   * Body: { orderIndex?, defaultProps?, locked? }
   */
  async updateModule({ params, request, response }: HttpContext) {
    const { moduleId } = params
    const { orderIndex, defaultProps, locked } = request.only([
      'orderIndex',
      'defaultProps',
      'locked',
    ])
    const updates: Record<string, any> = { updated_at: new Date() }
    if (orderIndex !== undefined) updates.order_index = Number(orderIndex)
    if (defaultProps !== undefined) updates.default_props = defaultProps
    if (locked !== undefined) updates.locked = !!locked
    const [row] = await db
      .from('module_group_modules')
      .where('id', moduleId)
      .update(updates)
      .returning('*')
    if (!row) return response.notFound({ error: 'Module group module not found' })
    return response.ok({ data: row })
  }

  /**
   * DELETE /api/module-groups/modules/:moduleId
   */
  async deleteModule({ params, response }: HttpContext) {
    const { moduleId } = params
    const deleted = await db.from('module_group_modules').where('id', moduleId).delete()
    if (!deleted) return response.notFound({ error: 'Module group module not found' })
    return response.noContent()
  }
}
