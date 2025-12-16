import type { RegisteredTaxonomyConfig } from '#services/taxonomy_registry'

const lipsum: RegisteredTaxonomyConfig = {
  slug: 'lipsum',
  name: 'Lipsum Categories',
  hierarchical: true,
  freeTagging: false,
  maxSelections: null, // unlimited
}

export default lipsum
