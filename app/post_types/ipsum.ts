export default {
  // Hide core fields in the editor for this post type
  // Allowed: 'title' | 'excerpt' | 'parent' | 'slug' | 'meta' | 'seo'
  hideCoreFields: [],

  // Enable/disable hierarchy (parent selector, reorder)
  hierarchyEnabled: true,

  // Example fields for demo
  fields: [
    { slug: 'subtitle', label: 'Subtitle', type: 'text' },
  ],

  // Default template and URL pattern (synced on boot)
  template: { name: 'ipsum-default', description: 'Default Ipsum Template' },
  urlPatterns: [
    { locale: 'en', pattern: '/ipsum/{slug}', isDefault: true },
  ],
} as const
