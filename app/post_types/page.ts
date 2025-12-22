export default {
  // Hide core fields in the editor for this post type
  // Allowed: 'title' | 'excerpt' | 'parent' | 'slug' | 'meta' | 'seo'
  hideCoreFields: [],

  // Enable hierarchy so pages can have parents
  hierarchyEnabled: true,

  // Custom fields attached to this post type (editorial only)
  fields: [],

  // Default module group metadata (synced on boot)
  moduleGroup: { name: 'page-default', description: 'Default Page Module Group' },

  // URL patterns (synced on boot)
  // Tokens: {locale}, {slug}, {yyyy}, {mm}, {dd}
  urlPatterns: [{ locale: 'en', pattern: '/{path}', isDefault: true }],

  // Permalinks enabled for pages
  permalinksEnabled: true,

  // No taxonomies by default for pages
  taxonomies: [],

  // A/B testing configuration
  abTesting: {
    enabled: true,
    strategy: 'cookie',
    variations: [
      { label: 'Variation A', value: 'A', weight: 50 },
      { label: 'Variation B', value: 'B', weight: 50 },
    ],
  },
} as const
