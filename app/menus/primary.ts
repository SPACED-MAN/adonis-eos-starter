import menuTemplates, { type MenuTemplate } from '#services/menu_template_registry'

export const primaryMenuTemplate: MenuTemplate = {
  slug: 'primary',
  name: 'Primary',
  description: 'Primary site navigation. Supports mega menu Sections.',
  fields: [
    { key: 'tagline', label: 'Tagline', type: 'text' },
    { key: 'ctaText', label: 'CTA Text', type: 'text' },
    { key: 'ctaUrl', label: 'CTA URL', type: 'url' },
    { key: 'showSearch', label: 'Show search', type: 'boolean' },
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
