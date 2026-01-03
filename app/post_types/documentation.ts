import type { PostTypeConfig } from '../types/post_type.ts'

const documentationPostType: PostTypeConfig = {
  type: 'documentation',
  label: 'Documentation',
  pluralLabel: 'Documentation',
  description: 'Documentation and help pages',
  icon: 'circle-question',
  hierarchyEnabled: true,
  urlPatterns: [{ locale: 'en', pattern: '/docs/{path}', isDefault: true }],
  seoDefaults: {
    noindex: true,
    nofollow: true,
    robotsJson: { index: false, follow: false },
  },
  fields: [],
}

export default documentationPostType
