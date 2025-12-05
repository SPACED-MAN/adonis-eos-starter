import type { HttpContext } from '@adonisjs/core/http'
import menuTemplates from '#services/menu_template_registry'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import roleRegistry from '#services/role_registry'
import urlPatternService from '#services/url_pattern_service'

function buildTree(items: any[]): any[] {
  const idToNode = new Map<string, any>()
  const roots: any[] = []
  for (const it of items) {
    idToNode.set(String(it.id), { ...it, children: [] })
  }
  for (const it of items) {
    const node = idToNode.get(String(it.id))
    const pid = it.parentId ?? null
    if (pid && idToNode.has(String(pid))) {
      idToNode.get(String(pid)).children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortChildren = (arr: any[]) => {
    arr.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    for (const n of arr) sortChildren(n.children || [])
  }
  sortChildren(roots)
  return roots
}

async function expandDynamicMenuItems(items: any[], locale: string): Promise<any[]> {
  const hierarchyService = (await import('#services/hierarchy_service')).default
  const urlPatternService = (await import('#services/url_pattern_service')).default

  const expanded: any[] = []

  for (const item of items) {
    // If not dynamic, keep as-is
    if (item.type !== 'dynamic') {
      expanded.push(item)
      continue
    }

    // Dynamic item: fetch posts and expand
    const dynamicPostType = item.dynamicPostType
    const dynamicParentId = item.dynamicParentId
    const dynamicDepthLimit = item.dynamicDepthLimit || 1

    if (!dynamicPostType) {
      // Invalid dynamic item, skip
      continue
    }

    // Fetch hierarchical posts
    let posts: any[]

    if (dynamicParentId) {
      // Fetch children of specific parent
      posts = await db
        .from('posts')
        .where('type', dynamicPostType)
        .where('locale', locale)
        .where('status', 'published')
        .where('parent_id', dynamicParentId)
        .select('id', 'title', 'slug', 'parent_id', 'order_index')
        .orderBy('order_index', 'asc')
    } else {
      // Fetch all posts of this type (with hierarchy if applicable)
      posts = await hierarchyService.getPostsHierarchical({
        type: dynamicPostType,
        locale,
        status: 'published',
        fields: ['id', 'title', 'slug', 'parent_id', 'order_index'],
      })
    }

    // Convert posts to menu items
    for (const post of posts) {
      // Use hierarchical path for posts with parents
      const url = await urlPatternService.buildPostPathForPost(post.id)

      expanded.push({
        id: `dynamic-${item.id}-${post.id}`,
        parentId: item.parentId,
        orderIndex: expanded.length,
        locale: item.locale,
        label: post.title,
        type: 'post',
        postId: post.id,
        customUrl: url,
        anchor: null,
        target: null,
        rel: null,
        kind: 'item',
        depth: post.depth || 0,
        isDynamic: true,
      })
    }
  }

  return expanded
}

export default class MenusController {
  private async menuItemLocaleColumnExists(): Promise<boolean> {
    try {
      const row = await db
        .from('information_schema.columns')
        .where('table_schema', 'public')
        .andWhere('table_name', 'menu_items')
        .andWhere('column_name', 'locale')
        .first()
      return !!row
    } catch {
      return false
    }
  }

  async index({ response }: HttpContext) {
    const rows = await db.from('menus').orderBy('updated_at', 'desc')
    return response.ok({
      data: rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        locale: r.locale,
        template: (r as any).template || null,
        meta: (r as any).meta_json || {},
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    })
  }

  /**
   * GET /api/menu-templates
   * Returns list of code-first menu templates
   */
  async templates({ response }: HttpContext) {
    const list = menuTemplates.list()
    return response.ok({ data: list })
  }

  async store({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'menus.edit')) {
      return response.forbidden({ error: 'Not allowed to create menus' })
    }
    const name = String(request.input('name', '')).trim()
    const slug = String(request.input('slug', '')).trim()
    const locale = String(request.input('locale', '')).trim() || null
    const template = request.input('template') ? String(request.input('template')) : null
    const meta = request.input('meta')
    if (!name || !slug) return response.badRequest({ error: 'name and slug are required' })
    const now = new Date()
    await db.table('menus').insert({
      id: randomUUID(),
      name,
      slug,
      locale,
      template,
      meta_json:
        meta && typeof meta === 'object'
          ? JSON.stringify(meta)
          : this.db?.rawQuery
            ? this.db.rawQuery(`'{}'::jsonb`).knexQuery
            : '{}',
      created_at: now,
      updated_at: now,
    })
    return response.created({ message: 'Created' })
  }

  async show({ params, request, response }: HttpContext) {
    const { id } = params
    const menu = await db.from('menus').where('id', id).first()
    if (!menu) return response.notFound({ error: 'Menu not found' })
    const hasLocale = await this.menuItemLocaleColumnExists()
    const editingLocale = hasLocale
      ? String(request.input('locale', (menu as any).locale || 'en') || 'en')
      : ''
    const q = db.from('menu_items').where('menu_id', id).orderBy('order_index', 'asc')
    if (hasLocale && editingLocale) {
      q.andWhere('locale', editingLocale)
    }
    const items = await q.select(
      'id',
      'parent_id as parentId',
      'order_index as orderIndex',
      ...(hasLocale ? ['locale'] : []),
      'label',
      'type',
      'post_id as postId',
      'custom_url as customUrl',
      'anchor',
      'target',
      'rel',
      'kind',
      'dynamic_post_type as dynamicPostType',
      'dynamic_parent_id as dynamicParentId',
      'dynamic_depth_limit as dynamicDepthLimit'
    )
    return response.ok({
      data: {
        id: menu.id,
        name: menu.name,
        slug: menu.slug,
        locale: menu.locale,
        template: (menu as any).template || null,
        meta: (menu as any).meta_json || {},
        editingLocale: hasLocale ? editingLocale : undefined,
        itemsTree: buildTree(items),
        items,
      },
    })
  }

  async update({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'menus.edit')) {
      return response.forbidden({ error: 'Not allowed to update menus' })
    }
    const { id } = params
    const row = await db.from('menus').where('id', id).first()
    if (!row) return response.notFound({ error: 'Menu not found' })
    const name = request.input('name')
    const slug = request.input('slug')
    const locale = request.input('locale')
    const update: any = { updated_at: new Date() }
    if (name !== undefined) update.name = String(name)
    if (slug !== undefined) update.slug = String(slug)
    if (locale !== undefined) update.locale = locale ? String(locale) : null
    if (request.input('template') !== undefined) {
      const t = request.input('template')
      update.template = t ? String(t) : null
    }
    if (request.input('meta') !== undefined) {
      const meta = request.input('meta')
      update.meta_json =
        meta && typeof meta === 'object' ? JSON.stringify(meta) : JSON.stringify({})
    }
    await db.from('menus').where('id', id).update(update)
    return response.ok({ message: 'Updated' })
  }

  async destroy({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'menus.delete')) {
      return response.forbidden({ error: 'Admin only' })
    }
    const { id } = params
    const exists = await db.from('menus').where('id', id).first()
    if (!exists) return response.notFound({ error: 'Menu not found' })
    await db.from('menus').where('id', id).delete()
    return response.noContent()
  }

  async storeItem({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'menus.edit')) {
      return response.forbidden({ error: 'Not allowed to add items' })
    }
    const { id: menuId } = params
    const menu = await db.from('menus').where('id', menuId).first()
    if (!menu) return response.notFound({ error: 'Menu not found' })
    const type = String(request.input('type', 'custom')).trim() as 'post' | 'custom' | 'dynamic'
    const kind = String(request.input('kind', 'item')).trim() as 'item' | 'section'
    let label = String(request.input('label', '')).trim()
    const parentIdRaw = request.input('parentId')
    const parentId = parentIdRaw ? String(parentIdRaw) : null
    const postId = request.input('postId') ? String(request.input('postId')) : null
    const customUrl = request.input('customUrl') ? String(request.input('customUrl')) : null
    const anchor = request.input('anchor') ? String(request.input('anchor')) : null
    const target = request.input('target') ? String(request.input('target')) : null
    const rel = request.input('rel') ? String(request.input('rel')) : null

    // Dynamic menu item fields
    const dynamicPostType = request.input('dynamicPostType')
      ? String(request.input('dynamicPostType'))
      : null
    const dynamicParentId = request.input('dynamicParentId')
      ? String(request.input('dynamicParentId'))
      : null
    const dynamicDepthLimit = request.input('dynamicDepthLimit')
      ? Number(request.input('dynamicDepthLimit'))
      : 1

    // Auto-label from post title if not provided
    if (!label && type === 'post' && postId) {
      const p = await db.from('posts').where('id', postId).select('title').first()
      if (p) label = String((p as any).title || '')
    }
    if (!label) return response.badRequest({ error: 'label is required' })
    const hasLocale = await this.menuItemLocaleColumnExists()
    // Locale for this item (if supported)
    const itemLocale = hasLocale
      ? String(request.input('locale', (menu as any).locale || 'en') || 'en')
      : null
    if (kind !== 'section') {
      if (type === 'post' && !postId)
        return response.badRequest({ error: 'postId is required for type=post' })
      if (type === 'custom' && !customUrl)
        return response.badRequest({ error: 'customUrl is required for type=custom' })
      if (type === 'dynamic' && !dynamicPostType)
        return response.badRequest({ error: 'dynamicPostType is required for type=dynamic' })
    }
    // Determine next order index within parent group
    const maxQ = db.from('menu_items').where('menu_id', menuId).max('order_index as max')
    if (hasLocale && itemLocale) {
      maxQ.andWhere('locale', itemLocale)
    }
    if (parentId !== null) {
      maxQ.andWhere('parent_id', parentId)
    } else {
      maxQ.whereNull('parent_id')
    }
    const maxRow = await maxQ.first()
    const maxIndex = Number((maxRow as any)?.max ?? 0)
    const now = new Date()
    const row: any = {
      id: randomUUID(),
      menu_id: menuId,
      parent_id: parentId,
      order_index: Number.isNaN(maxIndex) ? 0 : maxIndex + 1,
      label,
      kind,
      type: kind === 'section' ? 'custom' : type,
      post_id: kind === 'section' ? null : type === 'post' ? postId : null,
      custom_url: kind === 'section' ? null : type === 'custom' ? customUrl : null,
      anchor,
      target,
      rel,
      dynamic_post_type: type === 'dynamic' ? dynamicPostType : null,
      dynamic_parent_id: type === 'dynamic' ? dynamicParentId : null,
      dynamic_depth_limit: type === 'dynamic' ? dynamicDepthLimit : null,
      created_at: now,
      updated_at: now,
    }
    if (hasLocale && itemLocale) {
      row.locale = itemLocale
    }
    await db.table('menu_items').insert(row)
    return response.created({ message: 'Created' })
  }

  /**
   * GET /api/menus/by-slug/:slug
   * Optional: ?locale=xx
   */
  async bySlug({ params, request, response }: HttpContext) {
    const slug = String(params.slug || '').trim()
    const menu = await db.from('menus').where('slug', slug).first()
    if (!menu) return response.notFound({ error: 'Menu not found' })
    const hasLocale = await this.menuItemLocaleColumnExists()
    const locale = String(request.input('locale', (menu as any).locale || 'en') || 'en')
    const q = db
      .from('menu_items')
      .where('menu_id', (menu as any).id)
      .orderBy('order_index', 'asc')
    if (hasLocale && locale) q.andWhere('locale', locale)
    const rows = await q.select(
      'id',
      'parent_id as parentId',
      'order_index as orderIndex',
      ...(hasLocale ? ['locale'] : []),
      'label',
      'type',
      'post_id as postId',
      'custom_url as customUrl',
      'anchor',
      'target',
      'rel',
      'kind',
      'dynamic_post_type as dynamicPostType',
      'dynamic_parent_id as dynamicParentId',
      'dynamic_depth_limit as dynamicDepthLimit'
    )

    // Expand dynamic menu items
    const expandedRows = await expandDynamicMenuItems(rows, locale)

    return response.ok({
      data: {
        id: (menu as any).id,
        name: (menu as any).name,
        slug: (menu as any).slug,
        locale: (menu as any).locale,
        template: (menu as any).template || null,
        meta: (menu as any).meta_json || {},
        items: expandedRows,
        tree: buildTree(expandedRows),
      },
    })
  }

  async updateItem({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'menus.edit')) {
      return response.forbidden({ error: 'Not allowed to update items' })
    }
    const { id } = params
    const row = await db.from('menu_items').where('id', id).first()
    if (!row) return response.notFound({ error: 'Menu item not found' })
    const update: any = { updated_at: new Date() }
    const fields = ['label', 'anchor', 'target', 'rel'] as const
    for (const f of fields) {
      if (request.input(f) !== undefined) update[f] = request.input(f)
    }
    // switch type/post/custom_url/dynamic
    if (request.input('type') !== undefined) {
      const type = String(request.input('type')).trim() as 'post' | 'custom' | 'dynamic'
      update.type = type
      if (type === 'post') {
        const postId = String(request.input('postId') || '')
        if (!postId) return response.badRequest({ error: 'postId is required for type=post' })
        update.post_id = postId
        update.custom_url = null
        update.dynamic_post_type = null
        update.dynamic_parent_id = null
        update.dynamic_depth_limit = null
      } else if (type === 'custom') {
        const customUrl = String(request.input('customUrl') || '')
        if (!customUrl)
          return response.badRequest({ error: 'customUrl is required for type=custom' })
        update.custom_url = customUrl
        update.post_id = null
        update.dynamic_post_type = null
        update.dynamic_parent_id = null
        update.dynamic_depth_limit = null
      } else if (type === 'dynamic') {
        const dynamicPostType = String(request.input('dynamicPostType') || '')
        if (!dynamicPostType)
          return response.badRequest({ error: 'dynamicPostType is required for type=dynamic' })
        update.post_id = null
        update.custom_url = null
        update.dynamic_post_type = dynamicPostType
        update.dynamic_parent_id = request.input('dynamicParentId')
          ? String(request.input('dynamicParentId'))
          : null
        update.dynamic_depth_limit = request.input('dynamicDepthLimit')
          ? Number(request.input('dynamicDepthLimit'))
          : 1
      }
    } else {
      if (request.input('postId') !== undefined)
        update.post_id = request.input('postId') ? String(request.input('postId')) : null
      if (request.input('customUrl') !== undefined)
        update.custom_url = request.input('customUrl') ? String(request.input('customUrl')) : null
      if (request.input('dynamicPostType') !== undefined)
        update.dynamic_post_type = request.input('dynamicPostType')
          ? String(request.input('dynamicPostType'))
          : null
      if (request.input('dynamicParentId') !== undefined)
        update.dynamic_parent_id = request.input('dynamicParentId')
          ? String(request.input('dynamicParentId'))
          : null
      if (request.input('dynamicDepthLimit') !== undefined)
        update.dynamic_depth_limit = request.input('dynamicDepthLimit')
          ? Number(request.input('dynamicDepthLimit'))
          : null
    }
    if ((request.all() as any).hasOwnProperty('parentId')) {
      const pidRaw = request.input('parentId')
      update.parent_id =
        pidRaw === undefined ? undefined : pidRaw === null || pidRaw === '' ? null : String(pidRaw)
    }
    if (request.input('orderIndex') !== undefined) {
      const oi = Number(request.input('orderIndex'))
      if (Number.isNaN(oi)) return response.badRequest({ error: 'orderIndex must be a number' })
      update.order_index = oi
    }
    await db.from('menu_items').where('id', id).update(update)
    return response.ok({ message: 'Updated' })
  }

  async destroyItem({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'menus.delete')) {
      return response.forbidden({ error: 'Not allowed to delete items' })
    }
    const { id } = params
    const row = await db.from('menu_items').where('id', id).first()
    if (!row) return response.notFound({ error: 'Menu item not found' })
    await db.from('menu_items').where('id', id).delete()
    return response.noContent()
  }

  /**
   * POST /api/menus/:id/reorder
   * Body: { scope: { menuId: string; parentId: string | null; locale: string }, items: Array<{ id: string; orderIndex: number; parentId?: string | null }> }
   */
  async reorder({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'menus.edit')) {
      return response.forbidden({ error: 'Not allowed to reorder menu items' })
    }
    const { id: menuIdParam } = params
    const scopeRaw = request.input('scope')
    const scopeMenuId = String(scopeRaw?.menuId || menuIdParam || '').trim()
    const scopeParentIdRaw = (scopeRaw as any)?.parentId
    const scopeParentId =
      scopeRaw && (scopeRaw as any).hasOwnProperty('parentId')
        ? scopeParentIdRaw === null || scopeParentIdRaw === ''
          ? null
          : String(scopeParentIdRaw).trim()
        : null
    const hasLocale = await this.menuItemLocaleColumnExists()
    const scopeLocale = hasLocale ? String(scopeRaw?.locale || '').trim() : ''
    if (!scopeMenuId) return response.badRequest({ error: 'scope.menuId is required' })
    if (hasLocale && !scopeLocale) return response.badRequest({ error: 'scope.locale is required' })
    const items: Array<{ id: string; orderIndex: number; parentId?: string | null }> =
      Array.isArray(request.input('items')) ? request.input('items') : []
    if (!Array.isArray(items) || items.length === 0) {
      return response.badRequest({ error: 'items must be a non-empty array' })
    }
    const sanitized: Array<{ id: string; orderIndex: number; parentId?: string | null }> = []
    for (const it of items) {
      const id = String((it as any)?.id || '').trim()
      const oiRaw = (it as any)?.orderIndex
      const orderIndex = Number(oiRaw)
      const parentIdRaw = (it as any)?.parentId
      const hasParent = (it as any)?.hasOwnProperty('parentId')
      const parentId = hasParent
        ? parentIdRaw === null || parentIdRaw === ''
          ? null
          : String(parentIdRaw).trim()
        : undefined
      if (!id || Number.isNaN(orderIndex)) {
        return response.badRequest({ error: 'Each item must include valid id and orderIndex' })
      }
      if (parentId !== undefined && parentId === id) {
        return response.badRequest({ error: 'Cannot set an item as its own parent' })
      }
      sanitized.push({ id, orderIndex, parentId })
    }
    try {
      const now = new Date()
      await db.transaction(async (trx) => {
        // Preload rows once for validation
        const ids = sanitized.map((s) => s.id)
        const rows = await trx.from('menu_items').whereIn('id', ids)
        const idToRow = new Map<string, any>()
        for (const r of rows) idToRow.set(String((r as any).id), r)
        for (const it of sanitized) {
          const row = idToRow.get(it.id)
          if (!row) throw new Error(`Menu item not found: ${it.id}`)
          if (String((row as any).menu_id) !== scopeMenuId) {
            throw new Error('Reorder items must belong to the same menu')
          }
          if (hasLocale && String((row as any).locale) !== scopeLocale) {
            throw new Error('Reorder items must belong to the same locale')
          }
          const currentParent: string | null = (row as any).parent_id ?? null
          const effectiveParent = (it as any).hasOwnProperty('parentId')
            ? it.parentId === undefined
              ? currentParent
              : (it.parentId ?? null)
            : currentParent
          if ((effectiveParent ?? null) !== (scopeParentId ?? null)) {
            throw new Error('Reorder items must be in the same parent group as scope')
          }
        }
        for (const it of sanitized) {
          const update: any = { order_index: it.orderIndex, updated_at: now }
          if ((it as any).hasOwnProperty('parentId')) {
            update.parent_id = it.parentId === undefined ? undefined : it.parentId
          }
          await trx.from('menu_items').where('id', it.id).update(update)
        }
      })
      return response.ok({ updated: sanitized.length })
    } catch (e: any) {
      return response.badRequest({ error: e?.message || 'Failed to reorder menu items' })
    }
  }

  /**
   * POST /api/menus/:id/generate-variations
   * Body: { fromLocale: string, toLocales: string[], mode?: 'replace'|'merge' }
   */
  async generateVariations({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'menus.edit')) {
      return response.forbidden({ error: 'Not allowed' })
    }
    const hasLocale = await this.menuItemLocaleColumnExists()
    if (!hasLocale) {
      return response.badRequest({
        error:
          'Locale-aware menu variations require menu_items.locale column. Run latest migrations.',
      })
    }
    const { id } = params
    const menu = await db.from('menus').where('id', id).first()
    if (!menu) return response.notFound({ error: 'Menu not found' })
    const fromLocale = String(request.input('fromLocale', (menu as any).locale || 'en') || 'en')
    const toLocales: string[] = Array.isArray(request.input('toLocales'))
      ? (request.input('toLocales') as any[]).map((x) => String(x).trim()).filter(Boolean)
      : []
    const mode = String(request.input('mode', 'replace') || 'replace')
    if (!toLocales.length)
      return response.badRequest({ error: 'toLocales must be a non-empty array' })
    // Load source items (flat)
    const sourceItems = await db
      .from('menu_items')
      .where({ menu_id: id, locale: fromLocale })
      .orderBy('order_index', 'asc')
      .select(
        'id',
        'parent_id as parentId',
        'order_index as orderIndex',
        'label',
        'type',
        'post_id as postId',
        'custom_url as customUrl',
        'anchor',
        'target',
        'rel'
      )
    // Build adjacency for parent relations
    for (const loc of toLocales) {
      await db.transaction(async (trx) => {
        if (mode === 'replace') {
          await trx.from('menu_items').where({ menu_id: id, locale: loc }).delete()
        }
        // Map source id -> new id for maintaining hierarchy
        const idMap = new Map<string, string>()
        // Compute order_index per sibling group
        const byParent = new Map<string | null, Array<any>>()
        for (const it of sourceItems) {
          const key = it.parentId ? String(it.parentId) : null
          if (!byParent.has(key)) byParent.set(key, [])
          byParent.get(key)!.push(it)
        }
        const insertQueue: any[] = []
        const process = async (parentId: string | null) => {
          const group = byParent.get(parentId) || []
          group.sort((a, b) => a.orderIndex - b.orderIndex)
          let oi = 0
          for (const it of group) {
            let destPostId: string | null = null
            let destPostTitle: string | null = null
            if (it.type === 'post' && it.postId) {
              // Find translated post for this locale
              const src = await trx.from('posts').where('id', it.postId).first()
              if (src) {
                const baseId = (src as any).translation_of_id || (src as any).id
                const translated = await trx
                  .from('posts')
                  .where({ locale: loc })
                  .andWhere((qb) => qb.where('translation_of_id', baseId).orWhere('id', baseId))
                  .select('id', 'title')
                  .first()
                if (translated) {
                  destPostId = String((translated as any).id)
                  destPostTitle = String((translated as any).title || '')
                } else {
                  destPostId = null
                }
              }
            }
            if (it.type === 'post' && !destPostId) {
              // omit if translation missing
              continue
            }
            const computedLabel = it.type === 'post' && destPostTitle ? destPostTitle : it.label
            const newId = randomUUID()
            idMap.set(String(it.id), newId)
            insertQueue.push({
              id: newId,
              menu_id: id,
              parent_id: it.parentId ? idMap.get(String(it.parentId)) || null : null,
              locale: loc,
              order_index: oi++,
              label: computedLabel,
              type: it.type,
              post_id: it.type === 'post' ? destPostId : null,
              custom_url: it.type === 'custom' ? it.customUrl : null,
              anchor: it.anchor,
              target: it.target,
              rel: it.rel,
              created_at: new Date(),
              updated_at: new Date(),
            })
            // Recurse children
            await process(String(it.id))
          }
        }
        await process(null)
        if (insertQueue.length) {
          // fix parent_id mapping for children now that idMap contains all
          for (const row of insertQueue) {
            if (row.parent_id && idMap.has(row.parent_id)) {
              row.parent_id = idMap.get(row.parent_id)
            }
          }
          await trx.table('menu_items').insert(insertQueue)
        }
      })
    }
    return response.ok({ generated: toLocales.length })
  }
}
