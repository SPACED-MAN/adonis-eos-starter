export default {
  // Hide no core fields by default; we want title and optional excerpt
  hideCoreFields: [],

  // Companies are a flat list (no hierarchy)
  hierarchyEnabled: false,

  // Custom fields attached to this post type (editorial only)
  fields: [
    {
      slug: 'address',
      label: 'Business Address',
      type: 'textarea',
      config: {
        placeholder: '123 Main St, City, State, ZIP',
      },
    },
    {
      slug: 'phone',
      label: 'Phone Number',
      type: 'text',
      config: {
        placeholder: '+1 (555) 000-0000',
      },
    },
    {
      slug: 'openingHours',
      label: 'Opening Hours',
      type: 'textarea',
      config: {
        placeholder: 'Mo-Fr 09:00-17:00',
      },
    },
    {
      slug: 'geo',
      label: 'Coordinates (Lat, Lng)',
      type: 'text',
      config: {
        placeholder: '40.7128, -74.0060',
      },
    },
  ],

  // Featured image enabled with custom label
  featuredImage: {
    enabled: true,
    label: 'Logo',
  },

  // Default module group metadata (not used publicly since permalinks are disabled)
  moduleGroup: { name: 'company-default', description: 'Default Company Module Group' },

  // URL patterns (ignored when permalinks are disabled, but defined for completeness)
  urlPatterns: [{ locale: 'en', pattern: '/company/{slug}', isDefault: true }],

  // Permalinks disabled – companies are only surfaced via modules/lists
  permalinksEnabled: false,

  // No taxonomies by default
  taxonomies: [],
} as const
