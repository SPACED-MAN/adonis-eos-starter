export default {
  // Hide core fields in the editor for this post type
  // Allowed: 'title' | 'excerpt' | 'parent' | 'slug' | 'meta' | 'seo'
  hideCoreFields: ['excerpt'],

  // Enable/disable hierarchy (parent selector, reorder)
  hierarchyEnabled: true,

  // Custom fields attached to this post type (definitions only; values are stored per post)
  // Supported types: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'media' | 'date' | 'url'
  // Example:
  // fields: [
  //   { slug: 'subtitle', label: 'Subtitle', type: 'text' },
  //   { slug: 'hero_image', label: 'Hero image', type: 'media', config: { category: 'Hero images', preferredVariant: 'wide' } },
  // ],
  fields: [
    { slug: 'subtitle', label: 'Subtitle', type: 'text' },
    { slug: 'hero_image', label: 'Hero image', type: 'media', config: { category: 'Hero images', preferredVariant: 'wide' } },
  ],

  // Default template metadata (synced on boot)
  template: { name: 'dolor-sit-default', description: 'Default template for dolor-sit' },

  // URL patterns (synced on boot)
  // Tokens: {locale}, {slug}, {yyyy}, {mm}, {dd}
  urlPatterns: [
    { locale: 'en', pattern: '/{locale}/dolor-sit/{slug}', isDefault: true },
  ],
} as const
