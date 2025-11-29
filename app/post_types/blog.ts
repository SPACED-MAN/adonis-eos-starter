export default {
	// Hide core fields in the editor for this post type
	// Allowed: 'title' | 'excerpt' | 'parent' | 'slug' | 'meta' | 'seo'
	hideCoreFields: [],

	// Enable/disable hierarchy (parent selector, reorder)
	hierarchyEnabled: true,

	// Custom fields attached to this post type (definitions only; values are stored per post)
	fields: [
		{ slug: 'subtitle', label: 'Subtitle', type: 'text' },
		{ slug: 'hero_image', label: 'Hero image', type: 'media', config: { category: 'Hero images', preferredVariant: 'wide' } },
	],

	// Default template metadata (synced on boot)
	template: { name: 'blog-default', description: 'Default Blog Template' },

	// URL patterns (synced on boot)
	// Tokens: {locale}, {slug}, {yyyy}, {mm}, {dd}
	urlPatterns: [
		{ locale: 'en', pattern: '/blog/{path}', isDefault: true },
	],
	// Permalinks enabled for this type (set to false to disable public pages)
	permalinksEnabled: true,
	// Taxonomies attached to this post type (shared by slug across post types)
	taxonomies: ['lipsum'],
} as const


