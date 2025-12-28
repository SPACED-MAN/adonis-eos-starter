// PostTypeDefinition is defined inline in post_type_config_service
type PostTypeDefinition = {
  type: string
  label: string
  pluralLabel: string
  description?: string
  icon?: string
  hierarchical?: boolean
  hasExcerpt?: boolean
  hasCategories?: boolean
  hasTags?: boolean
  hasFeaturedImage?: boolean
  urlPatterns?: Array<{ locale: string; pattern: string; isDefault?: boolean }>
  allowedModules?: string[]
  fields?: any[]
}

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
  urlPatterns: [{ locale: 'en', pattern: '/docs/{path}', isDefault: true }],
  allowedModules: [
    'hero',
    'prose',
    'features-list',
    'features-list-expanded',
    'accordions',
    'callout',
    'blockquote',
  ],
  fields: [],
}

export default documentationPostType
