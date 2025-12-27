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
  private async expandDynamicMenuItems(items: any[], locale: string): Promise<any[]> {
    const hierarchyService = (await import('#services/hierarchy_service')).default
    const urlPatternService = (await import('#services/url_pattern_service')).default

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
        posts = await db
          .from('posts')
          .where('type', dynamicPostType)
          .where('locale', locale)
          .where('status', 'published')
          .where('parent_id', dynamicParentId)
          .select('id', 'title', 'slug', 'parent_id', 'order_index')
          .orderBy('order_index', 'asc')
      } else {
        posts = await hierarchyService.getPostsHierarchical({
          type: dynamicPostType,
          locale,
          status: 'published',
          fields: ['id', 'title', 'slug', 'parent_id', 'order_index'],
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

  async getBySlug(slug: string, locale: string = 'en'): Promise<MenuData | null> {
    const menu = await db.from('menus').where('slug', slug).first()
    if (!menu) return null

    const rows = await db
      .from('menu_items')
      .where('menu_id', menu.id)
      .andWhere('locale', locale)
      .orderBy('order_index', 'asc')
      .select(
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

    const expandedRows = await this.expandDynamicMenuItems(rows, locale)

    // Resolve URLs for all post-type menu items
    const urlPatternService = (await import('#services/url_pattern_service')).default
    const postIdsToResolve = expandedRows
      .filter((item) => item.type === 'post' && item.postId && !item.customUrl)
      .map((item) => String(item.postId))

    if (postIdsToResolve.length > 0) {
      const urlMap = await urlPatternService.buildPostPaths(postIdsToResolve)
      for (const item of expandedRows) {
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
      items: expandedRows,
      tree: this.buildTree(expandedRows),
    }
  }
}

const menuService = new MenuService()
export default menuService
