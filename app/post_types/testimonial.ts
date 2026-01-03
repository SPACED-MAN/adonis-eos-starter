import type { PostTypeConfig } from '../types/post_type.ts'

const testimonialPostType: PostTypeConfig = {
  type: 'testimonial',
  label: 'Testimonial',
  pluralLabel: 'Testimonials',
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
  ],

  // Template metadata (not used for public pages here, but kept for consistency)
  moduleGroup: { name: 'testimonial-default', description: 'Default Testimonial Module Group' },

  // No URL patterns since permalinks are disabled
  urlPatterns: [],

  // Enable featured image for testimonials (used for author photo)
  featuredImage: {
    enabled: true,
    label: 'Author Photo',
  },
}

export default testimonialPostType
