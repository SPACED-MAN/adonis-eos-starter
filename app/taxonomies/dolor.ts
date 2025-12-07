import type { RegisteredTaxonomyConfig } from '#services/taxonomy_registry'

const taxonomy: RegisteredTaxonomyConfig = {
  slug: 'dolor',
  name: 'Dolor',
  hierarchical: true,
  freeTagging: true,
  maxSelections: null, // null = unlimited
}

export default taxonomy
