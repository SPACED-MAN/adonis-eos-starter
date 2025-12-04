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
      case 'support':
        return await this.getSupportProps(post)
      // Add more post types here as needed
      default:
        return additionalProps
    }
  }

  /**
   * Get additional props for support posts (sidebar navigation)
   */
  private async getSupportProps(post: Post): Promise<Record<string, any>> {
    const supportPosts = await hierarchyService.getPostsHierarchical({
      type: 'support',
      locale: post.locale,
      status: 'published',
      fields: ['id', 'title', 'slug', 'parent_id', 'order_index'],
    })

    // Build URLs dynamically using url_pattern_service
    const supportNav = await Promise.all(
      supportPosts.map(async (p: any) => {
        const url = await urlPatternService.buildPostPath(
          'support',
          p.slug,
          post.locale,
          p.created_at
        )
        
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          url,
          parentId: p.parent_id,
          depth: p.depth || 0,
        }
      })
    )

    return { supportNav }
  }
}

const postTypeViewService = new PostTypeViewService()
export default postTypeViewService

