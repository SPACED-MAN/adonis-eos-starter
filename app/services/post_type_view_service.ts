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
   * @returns Additional props to pass to the view
   */
  async getAdditionalProps(post: Post): Promise<Record<string, any>> {
    const additionalProps: Record<string, any> = {}

    // Delegate to type-specific handlers
    switch (post.type) {
      case 'documentation':
        return await this.getDocumentationProps(post)
      // Add more post types here as needed
      default:
        return additionalProps
    }
  }

  /**
   * Get additional props for documentation posts (sidebar navigation from Documentation menu)
   */
  private async getDocumentationProps(post: Post): Promise<Record<string, any>> {
    const db = (await import('@adonisjs/lucid/services/db')).default
    
    try {
      // Fetch the Documentation menu
      const documentationMenu = await db.from('menus').where('slug', 'documentation').first()
      
      if (!documentationMenu) {
      // Fallback: use direct hierarchical query if menu doesn't exist
      const documentationPosts = await hierarchyService.getPostsHierarchical({
        type: 'documentation',
        locale: post.locale,
        status: 'published',
        fields: ['id', 'title', 'slug', 'parent_id', 'order_index', 'created_at'],
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
          }
        })
      )

        const documentationNav = this.buildMenuTree(flatItems)
        return { documentationNav }
      }
      
      // Fetch menu items from the Documentation menu
      const menuItems = await db
        .from('menu_items')
        .where('menu_id', documentationMenu.id)
        .where('locale', post.locale)
        .orderBy('order_index', 'asc')
        .select(
          'id',
          'parent_id as parentId',
          'order_index as orderIndex',
          'label',
          'type',
          'post_id as postId',
          'custom_url as customUrl',
          'dynamic_post_type as dynamicPostType',
          'dynamic_parent_id as dynamicParentId',
          'dynamic_depth_limit as dynamicDepthLimit'
        )
      
      // Expand dynamic menu items using the same logic as menus controller
      const flatItems = await this.expandDynamicMenuItems(menuItems, post.locale)
      
      // Build tree structure
      const documentationNav = this.buildMenuTree(flatItems)

      return { documentationNav }
    } catch (error) {
      console.error('[PostTypeViewService] Error getting documentation props:', error)
      return { documentationNav: [] }
    }
  }

  /**
   * Expand dynamic menu items (same logic as menus_controller)
   */
  private async expandDynamicMenuItems(items: any[], locale: string): Promise<any[]> {
    // const db = (await import('@adonisjs/lucid/services/db')).default // Unused for now
    const expanded: any[] = []
    
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
        status: 'published',
        fields: ['id', 'title', 'slug', 'parent_id', 'order_index', 'created_at'],
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

