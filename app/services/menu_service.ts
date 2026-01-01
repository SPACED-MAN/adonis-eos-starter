import db from '@adonisjs/lucid/services/db'

export type MenuItem = {
  id: string
  parentId: string | null
  orderIndex: number
  locale: string
  label: string
  type: 'post' | 'custom' | 'dynamic'
  postId: string | null
  customUrl: string | null
  anchor: string | null
  target: string | null
  rel: string | null
  kind: 'item' | 'section'
  dynamicPostType?: string | null
  dynamicParentId?: string | null
  dynamicDepthLimit?: number | null
  children?: MenuItem[]
  isDynamic?: boolean
}

export type MenuData = {
  id: string
  name: string
  slug: string
  locale: string
  template: string | null
  meta: Record<string, any>
  items: MenuItem[]
  tree: MenuItem[]
}

class MenuService {
  private async expandDynamicMenuItems(
    items: any[],
    locale: string,
    options: { permissions?: string[] } = {}
  ): Promise<any[]> {
    const hierarchyService = (await import('#services/hierarchy_service')).default
    const urlPatternService = (await import('#services/url_pattern_service')).default

    const canSeeUnpublished =
      options.permissions?.includes('admin.access') ||
      options.permissions?.includes('posts.edit') ||
      options.permissions?.includes('posts.publish')

    const expanded: any[] = []

    for (const item of items) {
      if (item.type !== 'dynamic') {
        expanded.push(item)
        continue
      }

      const dynamicPostType = item.dynamicPostType
      const dynamicParentId = item.dynamicParentId

      if (!dynamicPostType) continue

      let posts: any[]
      if (dynamicParentId) {
        const query = db
          .from('posts')
          .where('type', dynamicPostType)
          .where('locale', locale)
          .where('parent_id', dynamicParentId)

        if (!canSeeUnpublished) {
          query.where('status', 'published')
        }

        posts = await query
          .select('id', 'title', 'slug', 'parent_id', 'order_index', 'status')
          .orderBy('order_index', 'asc')
      } else {
        posts = await hierarchyService.getPostsHierarchical({
          type: dynamicPostType,
          locale,
          status: canSeeUnpublished ? 'all' : 'published',
          fields: ['id', 'title', 'slug', 'parent_id', 'order_index', 'status'],
        })
      }

      for (const post of posts) {
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
          status: post.status,
        })
      }
    }

    return expanded
  }

  private buildTree(items: any[]): any[] {
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

  async getBySlug(
    slug: string,
    locale: string = 'en',
    options: { permissions?: string[] } = {}
  ): Promise<MenuData | null> {
    const menu = await db.from('menus').where('slug', slug).first()
    if (!menu) return null

    const canSeeUnpublished =
      options.permissions?.includes('admin.access') ||
      options.permissions?.includes('posts.edit') ||
      options.permissions?.includes('posts.publish')

    const rows = await db
      .from('menu_items')
      .leftJoin('posts', 'menu_items.post_id', 'posts.id')
      .where('menu_items.menu_id', menu.id)
      .andWhere('menu_items.locale', locale)
      .orderBy('menu_items.order_index', 'asc')
      .select(
        'menu_items.id',
        'menu_items.parent_id as parentId',
        'menu_items.order_index as orderIndex',
        'menu_items.locale',
        'menu_items.label',
        'menu_items.type',
        'menu_items.post_id as postId',
        'menu_items.custom_url as customUrl',
        'menu_items.anchor',
        'menu_items.target',
        'menu_items.rel',
        'menu_items.kind',
        'menu_items.dynamic_post_type as dynamicPostType',
        'menu_items.dynamic_parent_id as dynamicParentId',
        'menu_items.dynamic_depth_limit as dynamicDepthLimit',
        'posts.status as postStatus'
      )

    // Filter out items where the linked post is not published, unless authorized
    const filteredBaseRows = rows.filter((row) => {
      if (row.type === 'post' && row.postId) {
        if (row.postStatus !== 'published' && !canSeeUnpublished) {
          return false
        }
      }
      return true
    })

    const expandedRows = await this.expandDynamicMenuItems(filteredBaseRows, locale, options)

    // Resolve URLs for all post-type menu items
    const urlPatternService = (await import('#services/url_pattern_service')).default

    // For custom URLs, try to resolve them to posts to check status (needed for filtering)
    if (!canSeeUnpublished) {
      for (const item of expandedRows) {
        if (
          item.type === 'custom' &&
          item.customUrl &&
          item.customUrl.startsWith('/') &&
          !item.postStatus
        ) {
          const match = await urlPatternService.matchPath(item.customUrl)
          if (match) {
            const post = await db
              .from('posts')
              .where('slug', match.slug)
              .where('type', match.postType)
              .where('locale', match.locale)
              .select('status')
              .first()
            if (post) {
              item.postStatus = post.status
            }
          }
        }
      }
    }

    // Final filter pass: covers resolved custom URLs and dynamic items (which have .status)
    const finalItems = expandedRows.filter((item) => {
      const status = item.postStatus || item.status
      if (status && status !== 'published' && !canSeeUnpublished) {
        return false
      }
      return true
    })

    const postIdsToResolve = finalItems
      .filter((item) => item.type === 'post' && item.postId && !item.customUrl)
      .map((item) => String(item.postId))

    if (postIdsToResolve.length > 0) {
      const urlMap = await urlPatternService.buildPostPaths(postIdsToResolve)
      for (const item of finalItems) {
        if (item.type === 'post' && item.postId && !item.customUrl) {
          item.customUrl = urlMap.get(String(item.postId)) || `/posts/${item.postId}`
        }
      }
    }

    return {
      id: menu.id,
      name: menu.name,
      slug: menu.slug,
      locale: menu.locale,
      template: menu.template || null,
      meta: menu.meta_json || {},
      items: finalItems,
      tree: this.buildTree(finalItems),
    }
  }
}

const menuService = new MenuService()
export default menuService
