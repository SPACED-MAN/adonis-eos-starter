import type { PostTypeConfig } from '../types/post_type.ts'

const blogPostType: PostTypeConfig = {
  type: 'blog',
  label: 'Blog',
  pluralLabel: 'Blogs',
  // Hide core fields in the editor for this post type
  // Allowed: 'title' | 'excerpt' | 'parent' | 'slug' | 'meta' | 'seo'
  hideCoreFields: [],

  // Enable/disable hierarchy (parent selector, reorder)
  hierarchyEnabled: true,

  // Custom fields attached to this post type (definitions only; values are stored per post)
  fields: [],

  // Featured media enabled
  featuredMedia: {
    enabled: true,
    label: 'Featured Media',
  },

  // Default module group metadata (synced on boot)
  moduleGroup: { name: 'blog-default', description: 'Default Blog Module Group' },

  // URL patterns (synced on boot)
  // Tokens: {locale}, {slug}, {yyyy}, {mm}, {dd}
  urlPatterns: [
    // Use slug-based pattern so previews show the actual path
    { locale: 'en', pattern: '/blog/{slug}', isDefault: true },
  ],
  // Permalinks enabled for this type (set to false to disable public pages)
  permalinksEnabled: true,
  // Taxonomies attached to this post type (shared by slug across post types)
  taxonomies: ['tags'],

  // A/B testing configuration
  abTesting: {
    enabled: true,
    strategy: 'cookie',
    variations: [
      { label: 'Variation A', value: 'A', weight: 50 },
      { label: 'Variation B', value: 'B', weight: 50 },
    ],
  },
}

export default blogPostType
