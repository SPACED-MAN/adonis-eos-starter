export default {
  // Hide core fields in the editor for this post type
  // Allowed: 'title' | 'excerpt' | 'parent' | 'slug' | 'meta' | 'seo'
  hideCoreFields: [],

  // Enable/disable hierarchy (parent selector, reorder)
  hierarchyEnabled: true,

  // Custom fields attached to this post type (definitions only; values are stored per post)
  fields: [{ slug: 'subtitle', label: 'Subtitle', type: 'text' }],

  // Featured image enabled
  featuredImage: {
    enabled: true,
    label: 'Featured Image',
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
  taxonomies: ['lipsum', 'dolor'],
} as const
