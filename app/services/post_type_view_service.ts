import hierarchyService from '#services/hierarchy_service'
import urlPatternService from '#services/url_pattern_service'
import type Post from '#models/post'

/**
 * Post Type View Service
 *
 * Handles post-type-specific view logic (additional props for rendering).
 * This keeps the main controller generic and delegates type-specific concerns.
 */
class PostTypeViewService {
  /**
   * Get additional props for a post based on its type
   * @param post - The post instance
   * @param options - Optional context like user permissions
   * @returns Additional props to pass to the view
   */
  async getAdditionalProps(
    post: Post,
    options: { permissions?: string[] } = {}
  ): Promise<Record<string, any>> {
    const additionalProps: Record<string, any> = {}

    // Delegate to type-specific handlers
    switch (post.type) {
      case 'documentation':
        return await this.getDocumentationProps(post, options)
      // Add more post types here as needed
      default:
        return additionalProps
    }
  }

  /**
   * Get additional props for documentation posts (sidebar navigation from Documentation menu)
   */
  private async getDocumentationProps(
    post: Post,
    options: { permissions?: string[] } = {}
  ): Promise<Record<string, any>> {
    const db = (await import('@adonisjs/lucid/services/db')).default

    const canSeeUnpublished =
      options.permissions?.includes('admin.access') ||
      options.permissions?.includes('posts.edit') ||
      options.permissions?.includes('posts.publish')

    try {
      // Fetch the Documentation menu
      const documentationMenu = await db.from('menus').where('slug', 'documentation').first()

      if (!documentationMenu) {
        // Fallback: use direct hierarchical query if menu doesn't exist
        const documentationPosts = await hierarchyService.getPostsHierarchical({
          type: 'documentation',
          locale: post.locale,
          status: canSeeUnpublished ? undefined : 'published',
          fields: ['id', 'title', 'slug', 'parent_id', 'order_index', 'created_at', 'status'],
        })

        const flatItems = await Promise.all(
          documentationPosts.map(async (p: any) => {
            const url = await urlPatternService.buildPostPathForPost(p.id)

            return {
              id: p.id,
              label: p.title,
              parentId: p.parent_id,
              url,
              type: 'post',
              postId: p.id,
              customUrl: url,
              status: p.status,
            }
          })
        )

        const documentationNav = this.buildMenuTree(flatItems)
        return { documentationNav }
      }

      // Fetch menu items from the Documentation menu
      const rows = await db
        .from('menu_items')
        .leftJoin('posts', 'menu_items.post_id', 'posts.id')
        .where('menu_items.menu_id', documentationMenu.id)
        .where('menu_items.locale', post.locale)
        .orderBy('menu_items.order_index', 'asc')
        .select(
          'menu_items.id',
          'menu_items.parent_id as parentId',
          'menu_items.order_index as orderIndex',
          'menu_items.label',
          'menu_items.type',
          'menu_items.post_id as postId',
          'menu_items.custom_url as customUrl',
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

      // Expand dynamic menu items using the same logic as menus controller
      const expandedRows = await this.expandDynamicMenuItems(filteredBaseRows, post.locale, options)

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
              const p = await db
                .from('posts')
                .where('slug', match.slug)
                .where('type', match.postType)
                .where('locale', match.locale)
                .select('status')
                .first()
              if (p) {
                item.postStatus = p.status
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

      // Build tree structure
      const documentationNav = this.buildMenuTree(finalItems)

      return { documentationNav }
    } catch (error) {
      console.error('[PostTypeViewService] Error getting documentation props:', error)
      return { documentationNav: [] }
    }
  }

  /**
   * Expand dynamic menu items (same logic as menus_controller)
   */
  private async expandDynamicMenuItems(
    items: any[],
    locale: string,
    options: { permissions?: string[] } = {}
  ): Promise<any[]> {
    // const db = (await import('@adonisjs/lucid/services/db')).default // Unused for now
    const expanded: any[] = []

    const canSeeUnpublished =
      options.permissions?.includes('admin.access') ||
      options.permissions?.includes('posts.edit') ||
      options.permissions?.includes('posts.publish')

    for (const item of items) {
      // If not dynamic, keep as-is
      if (item.type !== 'dynamic') {
        expanded.push(item)
        continue
      }

      const dynamicPostType = item.dynamicPostType
      if (!dynamicPostType) continue

      // Fetch hierarchical posts
      const posts = await hierarchyService.getPostsHierarchical({
        type: dynamicPostType,
        locale,
        status: canSeeUnpublished ? 'all' : 'published',
        fields: ['id', 'title', 'slug', 'parent_id', 'order_index', 'created_at', 'status'],
      })

      // Convert posts to menu items
      for (const p of posts) {
        const url = await urlPatternService.buildPostPathForPost(p.id)

        expanded.push({
          id: p.id,
          parentId: p.parent_id,
          label: p.title,
          type: 'post',
          postId: p.id,
          customUrl: url,
          url,
          status: p.status,
        })
      }
    }

    return expanded
  }

  /**
   * Build a tree structure from flat menu items
   */
  private buildMenuTree(items: any[]): any[] {
    const idToNode = new Map<string, any>()
    const roots: any[] = []

    // Initialize nodes
    for (const item of items) {
      idToNode.set(item.id, { ...item, children: [] })
    }

    // Build parent-child relationships
    for (const item of items) {
      const node = idToNode.get(item.id)
      if (item.parentId && idToNode.has(item.parentId)) {
        idToNode.get(item.parentId).children.push(node)
      } else {
        roots.push(node)
      }
    }

    return roots
  }
}

const postTypeViewService = new PostTypeViewService()
export default postTypeViewService
