import type { PostTypeDefinition } from '#types/post_types'

const supportPostType: PostTypeDefinition = {
  type: 'support',
  label: 'Support',
  pluralLabel: 'Support',
  description: 'Documentation and help pages',
  icon: 'circle-question',
  hierarchical: false,
  hasExcerpt: false,
  hasCategories: false,
  hasTags: false,
  hasFeaturedImage: false,
  urlPatterns: [
    { locale: 'en', pattern: '/support/{slug}', isDefault: true },
  ],
  allowedModules: [
    'hero',
    'prose',
    'features-list',
    'features-list-expanded',
    'accordion',
    'blockquote',
  ],
  fields: [],
}

export default supportPostType
