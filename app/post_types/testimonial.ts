export default {
	// For testimonials, we don't need public pages
	permalinksEnabled: false,

	// Keep hierarchy off
	hierarchyEnabled: false,

	// Hide fields that don't matter without permalinks
	hideCoreFields: ['parent', 'excerpt', 'meta', 'seo'],

	// Custom fields suited for testimonial content
	fields: [
		{ slug: 'author_name', label: 'Author name', type: 'text' },
		{ slug: 'author_title', label: 'Author title', type: 'text' },
		{ slug: 'quote', label: 'Quote', type: 'textarea' },
		{ slug: 'photo', label: 'Photo', type: 'media', config: { preferredVariant: 'square' } },
	],

	// Template metadata (not used for public pages here, but kept for consistency)
	template: { name: 'testimonial-default', description: 'Default Testimonial Template' },

	// No URL patterns since permalinks are disabled
	urlPatterns: [],
} as const



