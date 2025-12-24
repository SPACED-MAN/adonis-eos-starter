import type { HttpContext } from '@adonisjs/core/http'
import ModuleGroup from '#models/module_group'
import ModuleGroupModule from '#models/module_group_module'
import roleRegistry from '#services/role_registry'

export default class ModuleGroupsController {
  /**
   * GET /api/module-groups
   */
  async index({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'globals.view')) {
      return response.forbidden({ error: 'Not allowed to view module groups' })
    }
    const postType = String(request.input('postType', '')).trim()
    const q = String(request.input('q', '')).trim()
    const query = ModuleGroup.query().orderBy('updatedAt', 'desc')
    if (postType) query.where('postType', postType)
    if (q) query.whereILike('name', `%${q}%`)
    const rows = await query
    return response.ok({ data: rows })
  }

  /**
   * POST /api/module-groups
   * Body: { name, postType, description?, locked? }
   */
  async store({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'globals.edit')) {
      return response.forbidden({ error: 'Not allowed to create module groups' })
    }
    const {
      name,
      postType,
      description = null,
      locked = false,
    } = request.only(['name', 'postType', 'description', 'locked'])
    if (!name || !postType) return response.badRequest({ error: 'name and postType are required' })
    const row = await ModuleGroup.create({
      name,
      postType,
      description,
      locked: !!locked,
    })
    return response.created({ data: row })
  }

  /**
   * PUT /api/module-groups/:id
   */
  async update({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'globals.edit')) {
      return response.forbidden({ error: 'Not allowed to edit module groups' })
    }
    const { id } = params
    const payload = request.only(['name', 'postType', 'description', 'locked'])
    const row = await ModuleGroup.find(id)
    if (!row) return response.notFound({ error: 'Module group not found' })
    if (payload.name !== undefined) row.name = payload.name
    if (payload.postType !== undefined) row.postType = payload.postType
    if (payload.description !== undefined) row.description = payload.description
    if (payload.locked !== undefined) row.locked = !!payload.locked
    await row.save()
    return response.ok({ data: row })
  }

  /**
   * DELETE /api/module-groups/:id
   */
  async destroy({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'globals.delete')) {
      return response.forbidden({ error: 'Not allowed to delete module groups' })
    }
    const { id } = params
    const deleted = await ModuleGroup.query().where('id', id).delete()
    if (!deleted) return response.notFound({ error: 'Module group not found' })
    return response.noContent()
  }

  /**
   * GET /api/module-groups/:id/modules
   */
  async listModules({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'globals.view')) {
      return response.forbidden({ error: 'Not allowed to view module group modules' })
    }
    const { id } = params
    const rows = await ModuleGroupModule.query()
      .where('moduleGroupId', id)
      .orderBy('orderIndex', 'asc')
    return response.ok({ data: rows })
  }

  /**
   * POST /api/module-groups/:id/modules
   * Body: { type, defaultProps?, locked? }
   */
  async addModule({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'globals.edit')) {
      return response.forbidden({ error: 'Not allowed to add modules to group' })
    }
    const { id } = params
    const {
      type,
      defaultProps = {},
      locked = false,
      scope = 'post',
      globalSlug = null,
    } = request.only(['type', 'defaultProps', 'locked', 'scope', 'globalSlug'])
    if (!type) return response.badRequest({ error: 'type is required' })
    const maxOrder = await ModuleGroupModule.query()
      .where('moduleGroupId', id)
      .max('orderIndex', 'maxOrder')
      .first()
    const nextOrder = ((maxOrder as any)?.$extras?.maxOrder || 0) + 1
    const row = await ModuleGroupModule.create({
      moduleGroupId: id,
      type,
      defaultProps: defaultProps || {},
      scope: String(scope || 'post'),
      globalSlug: globalSlug ? String(globalSlug) : null,
      orderIndex: nextOrder,
      locked: !!locked,
    })
    return response.created({ data: row })
  }

  /**
   * PUT /api/module-groups/modules/:moduleId
   * Body: { orderIndex?, defaultProps?, locked? }
   */
  async updateModule({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'globals.edit')) {
      return response.forbidden({ error: 'Not allowed to update module group module' })
    }
    const { moduleId } = params
    const { orderIndex, defaultProps, locked } = request.only([
      'orderIndex',
      'defaultProps',
      'locked',
    ])
    const row = await ModuleGroupModule.find(moduleId)
    if (!row) return response.notFound({ error: 'Module group module not found' })
    if (orderIndex !== undefined) row.orderIndex = Number(orderIndex)
    if (defaultProps !== undefined) row.defaultProps = defaultProps
    if (locked !== undefined) row.locked = !!locked
    await row.save()
    return response.ok({ data: row })
  }

  /**
   * DELETE /api/module-groups/modules/:moduleId
   */
  async deleteModule({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'globals.edit')) {
      return response.forbidden({ error: 'Not allowed to remove module from group' })
    }
    const { moduleId } = params
    const deleted = await ModuleGroupModule.query().where('id', moduleId).delete()
    if (!deleted) return response.notFound({ error: 'Module group module not found' })
    return response.noContent()
  }
}
