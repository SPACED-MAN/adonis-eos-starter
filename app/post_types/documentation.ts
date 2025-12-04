import type { PostTypeDefinition } from '#types/post_types'

const documentationPostType: PostTypeDefinition = {
  type: 'documentation',
  label: 'Documentation',
  pluralLabel: 'Documentation',
  description: 'Documentation and help pages',
  icon: 'circle-question',
  hierarchical: true,
  hasExcerpt: false,
  hasCategories: false,
  hasTags: false,
  hasFeaturedImage: false,
  urlPatterns: [
    { locale: 'en', pattern: '/docs/{slug}', isDefault: true },
    { locale: '*', pattern: '/{locale}/docs/{slug}', isDefault: false },
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

export default documentationPostType
