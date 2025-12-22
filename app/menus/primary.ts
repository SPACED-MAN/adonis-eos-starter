import menuTemplates, { type MenuTemplate } from '#services/menu_template_registry'

export const primaryMenuTemplate: MenuTemplate = {
  slug: 'primary',
  name: 'Primary',
  description: 'Primary site navigation. Supports mega menu Sections.',
  fields: [
    { slug: 'tagline', label: 'Tagline', type: 'text', category: 'General' },
    { slug: 'ctaText', label: 'CTA Text', type: 'text', category: 'Call to Action' },
    { slug: 'ctaUrl', label: 'CTA URL', type: 'url', category: 'Call to Action' },
    { slug: 'showSearch', label: 'Show search', type: 'boolean', category: 'General' },
  ],
  render: {
    variant: 'primary',
    sections: [
      {
        key: 'featured',
        label: 'Featured area',
        description: 'Hero-like content area in mega nav',
      },
      { key: 'links', label: 'Links area', description: 'Grid of links for quick access' },
    ],
  },
}

menuTemplates.register(primaryMenuTemplate)

export default primaryMenuTemplate
