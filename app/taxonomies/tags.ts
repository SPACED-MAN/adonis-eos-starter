import type { RegisteredTaxonomyConfig } from '#services/taxonomy_registry'

const taxonomy: RegisteredTaxonomyConfig = {
  slug: 'tags',
  name: 'Tags',
  hierarchical: false,
  freeTagging: true,
  maxSelections: null, // null = unlimited
  fields: [
    {
      slug: 'description',
      label: 'Description',
      type: 'textarea',
    },
  ],
}

export default taxonomy
