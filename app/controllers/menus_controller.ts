import type { HttpContext } from '@adonisjs/core/http'
import menuTemplates from '#services/menu_template_registry'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import roleRegistry from '#services/role_registry'
import {
  createMenuValidator,
  updateMenuValidator,
  createMenuItemValidator,
  updateMenuItemValidator,
  reorderMenuItemsValidator,
} from '#validators/menu'

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
    // const dynamicDepthLimit = item.dynamicDepthLimit || 1 // Unused for now

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
    const { name, slug, locale, template, meta } = await request.validateUsing(createMenuValidator)
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
          : db.rawQuery(`'{}'::jsonb`).knexQuery,
      created_at: now,
      updated_at: now,
    })
    return response.created({ message: 'Created' })
  }

  async show({ params, request, response }: HttpContext) {
    const { id } = params
    const menu = await db.from('menus').where('id', id).first()
    if (!menu) return response.notFound({ error: 'Menu not found' })
    const editingLocale = String(request.input('locale', (menu as any).locale || 'en') || 'en')
    const q = db.from('menu_items').where('menu_id', id).orderBy('order_index', 'asc')
    if (editingLocale) {
      q.andWhere('locale', editingLocale)
    }
    const items = await q.select(
      'id',
      'parent_id as parentId',
      'order_index as orderIndex',
      'locale',
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
        editingLocale,
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
    const { name, slug, locale, template, meta } = await request.validateUsing(updateMenuValidator)
    const update: any = { updated_at: new Date() }
    if (name !== undefined) update.name = name
    if (slug !== undefined) update.slug = slug
    if (locale !== undefined) update.locale = locale
    if (template !== undefined) update.template = template
    if (meta !== undefined) {
      update.meta_json = meta && typeof meta === 'object' ? JSON.stringify(meta) : JSON.stringify({})
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
    const {
      label: labelInput,
      type,
      locale: itemLocaleInput,
      postId,
      customUrl,
      anchor,
      target,
      rel,
      kind,
      parentId: parentIdInput,
      orderIndex,
      dynamicPostType,
      dynamicParentId,
      dynamicDepthLimit,
    } = await request.validateUsing(createMenuItemValidator)

    // Auto-label from post title if not provided
    let label = labelInput
    if (!label && type === 'post' && postId) {
      const p = await db.from('posts').where('id', postId).select('title').first()
      if (p) label = String((p as any).title || '')
    }
    if (!label) return response.badRequest({ error: 'label is required' })
    // Locale for this item (if supported)
    const itemLocale = itemLocaleInput || (menu as any).locale || 'en'
    const parentId = parentIdInput || null
    // Determine next order index within parent group
    const maxQ = db.from('menu_items').where('menu_id', menuId).max('order_index as max')
    if (itemLocale) {
      maxQ.andWhere('locale', itemLocale)
    }
    if (parentId !== null) {
      maxQ.andWhere('parent_id', parentId)
    } else {
      maxQ.whereNull('parent_id')
    }
    const maxRow = await maxQ.first()
    const maxIndex = Number((maxRow as any)?.max ?? 0)
    const effectiveOrderIndex = orderIndex !== undefined ? orderIndex : (Number.isNaN(maxIndex) ? 0 : maxIndex + 1)
    const now = new Date()
    const row: any = {
      id: randomUUID(),
      menu_id: menuId,
      parent_id: parentId,
      order_index: effectiveOrderIndex,
      label,
      kind: kind || 'item',
      type: kind === 'section' ? 'custom' : type,
      post_id: kind === 'section' ? null : type === 'post' ? postId : null,
      custom_url: kind === 'section' ? null : type === 'custom' ? customUrl : null,
      anchor: anchor || null,
      target: target || null,
      rel: rel || null,
      dynamic_post_type: type === 'dynamic' ? dynamicPostType : null,
      dynamic_parent_id: type === 'dynamic' ? dynamicParentId : null,
      dynamic_depth_limit: type === 'dynamic' ? (dynamicDepthLimit || 1) : null,
      created_at: now,
      updated_at: now,
      locale: itemLocale,
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
    const locale = String(request.input('locale', (menu as any).locale || 'en') || 'en')
    const q = db
      .from('menu_items')
      .where('menu_id', (menu as any).id)
      .orderBy('order_index', 'asc')
    if (locale) q.andWhere('locale', locale)
    const rows = await q.select(
      'id',
      'parent_id as parentId',
      'order_index as orderIndex',
      'locale',
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
    const {
      label,
      type,
      locale,
      postId,
      customUrl,
      anchor,
      target,
      rel,
      parentId,
      orderIndex,
      dynamicPostType,
      dynamicParentId,
      dynamicDepthLimit,
    } = await request.validateUsing(updateMenuItemValidator)
    const update: any = { updated_at: new Date() }
    if (label !== undefined) update.label = label
    if (anchor !== undefined) update.anchor = anchor
    if (target !== undefined) update.target = target
    if (rel !== undefined) update.rel = rel
    if (locale !== undefined) update.locale = locale
    // switch type/post/custom_url/dynamic
    if (type !== undefined) {
      update.type = type
      if (type === 'post') {
        if (!postId) return response.badRequest({ error: 'postId is required for type=post' })
        update.post_id = postId
        update.custom_url = null
        update.dynamic_post_type = null
        update.dynamic_parent_id = null
        update.dynamic_depth_limit = null
      } else if (type === 'custom') {
        if (!customUrl)
          return response.badRequest({ error: 'customUrl is required for type=custom' })
        update.custom_url = customUrl
        update.post_id = null
        update.dynamic_post_type = null
        update.dynamic_parent_id = null
        update.dynamic_depth_limit = null
      } else if (type === 'dynamic') {
        if (!dynamicPostType)
          return response.badRequest({ error: 'dynamicPostType is required for type=dynamic' })
        update.post_id = null
        update.custom_url = null
        update.dynamic_post_type = dynamicPostType
        update.dynamic_parent_id = dynamicParentId || null
        update.dynamic_depth_limit = dynamicDepthLimit || 1
      }
    } else {
      if (postId !== undefined) update.post_id = postId || null
      if (customUrl !== undefined) update.custom_url = customUrl || null
      if (dynamicPostType !== undefined) update.dynamic_post_type = dynamicPostType || null
      if (dynamicParentId !== undefined) update.dynamic_parent_id = dynamicParentId || null
      if (dynamicDepthLimit !== undefined) update.dynamic_depth_limit = dynamicDepthLimit || null
    }
    if (parentId !== undefined) update.parent_id = parentId
    if (orderIndex !== undefined) update.order_index = orderIndex
    await db.from('menu_items').where('id', id).update(update)
    return response.ok({ message: 'Updated' })
  }

  async destroyItem({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    // Deleting menu items is part of editing menus
    if (!roleRegistry.hasPermission(role, 'menus.edit')) {
      return response.forbidden({ error: 'Not allowed to delete items' })
    }
    const { id } = params
    const row = await db.from('menu_items').where('id', id).first()
    if (!row) return response.notFound({ error: 'Menu item not found' })
    // Delete the item and any descendants to avoid orphaned children
    const menuId = String((row as any).menu_id)
    const locale = String((row as any).locale || '')
    const allQ = db.from('menu_items').where('menu_id', menuId).select('id', 'parent_id')
    if (locale) allQ.andWhere('locale', locale)
    const all = await allQ
    const parentToChildren = new Map<string, string[]>()
    for (const it of all) {
      const pid = (it as any).parent_id ? String((it as any).parent_id) : null
      if (!pid) continue
      if (!parentToChildren.has(pid)) parentToChildren.set(pid, [])
      parentToChildren.get(pid)!.push(String((it as any).id))
    }
    const idsToDelete: string[] = []
    const queue: string[] = [String(id)]
    const seen = new Set<string>()
    while (queue.length) {
      const cur = queue.shift()!
      if (seen.has(cur)) continue
      seen.add(cur)
      idsToDelete.push(cur)
      const kids = parentToChildren.get(cur) || []
      for (const k of kids) queue.push(k)
    }
    await db.transaction(async (trx) => {
      await trx.from('menu_items').whereIn('id', idsToDelete).delete()
    })
    return response.noContent()
  }

  /**
   * POST /api/menus/:id/reorder
   * Body: { items: Array<{ id: string; orderIndex: number; parentId?: string | null }> }
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
    const { items } = await request.validateUsing(reorderMenuItemsValidator)
    // Note: The validator validates items structure, but we still need scope info from request
    // for validation against the database
    const scopeRaw = request.input('scope')
    const scopeMenuId = String(scopeRaw?.menuId || menuIdParam || '').trim()
    const scopeParentIdRaw = (scopeRaw as any)?.parentId
    const scopeParentId =
      scopeRaw && (scopeRaw as any).hasOwnProperty('parentId')
        ? scopeParentIdRaw === null || scopeParentIdRaw === ''
          ? null
          : String(scopeParentIdRaw).trim()
        : null
    const scopeLocale = String(scopeRaw?.locale || '').trim()
    if (!scopeMenuId) return response.badRequest({ error: 'scope.menuId is required' })
    if (!scopeLocale) return response.badRequest({ error: 'scope.locale is required' })
    const sanitized: Array<{ id: string; orderIndex: number; parentId?: string | null }> = []
    for (const it of items) {
      const { id, orderIndex, parentId } = it
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
          if (String((row as any).locale) !== scopeLocale) {
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

    // Pre-fetch all source posts and their translation families to avoid N+1 queries
    const sourcePostIds = sourceItems.filter((it) => it.type === 'post' && it.postId).map((it) => it.postId)
    let postTranslationMap = new Map<string, Map<string, { id: string; title: string }>>()

    if (sourcePostIds.length > 0) {
      const sourcePosts = await db.from('posts').whereIn('id', sourcePostIds).select('id', 'translation_of_id', 'type')
      const familyIds = Array.from(new Set(sourcePosts.map((p) => (p as any).translation_of_id || (p as any).id)))
      
      const allRelated = await db
        .from('posts')
        .whereIn('translation_of_id', familyIds)
        .orWhereIn('id', familyIds)
        .select('id', 'translation_of_id', 'locale', 'title')

      for (const srcId of sourcePostIds) {
        const srcPost = sourcePosts.find((p) => String((p as any).id) === String(srcId))
        if (!srcPost) continue
        const baseId = (srcPost as any).translation_of_id || (srcPost as any).id
        
        const familyMap = new Map<string, { id: string; title: string }>()
        allRelated
          .filter((p) => String((p as any).translation_of_id || (p as any).id) === String(baseId))
          .forEach((p) => familyMap.set((p as any).locale, { id: (p as any).id, title: (p as any).title }))
        
        postTranslationMap.set(String(srcId), familyMap)
      }
    }

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
              const familyMap = postTranslationMap.get(String(it.postId))
              const translated = familyMap?.get(loc)
              if (translated) {
                destPostId = translated.id
                destPostTitle = translated.title
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
