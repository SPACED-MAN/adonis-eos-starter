export default {
  // Hide no core fields by default; we want title and optional excerpt
  hideCoreFields: [],

  // Companies are a flat list (no hierarchy)
  hierarchyEnabled: false,

  // Custom fields attached to this post type (editorial only)
  fields: [
    {
      slug: 'logo',
      label: 'Logo',
      type: 'media',
      config: { category: 'Company logos', preferredVariant: 'thumb' },
    },
  ],

  // Default template metadata (not used publicly since permalinks are disabled)
  template: { name: 'company-default', description: 'Default Company Template' },

  // URL patterns (ignored when permalinks are disabled, but defined for completeness)
  urlPatterns: [
    { locale: 'en', pattern: '/company/{slug}', isDefault: true },
  ],

  // Permalinks disabled – companies are only surfaced via modules/lists
  permalinksEnabled: false,

  // No taxonomies by default
  taxonomies: [],
} as const


