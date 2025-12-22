import type { CustomFieldDefinition } from '../types/custom_field.ts'

export type RegisteredTaxonomyConfig = {
  slug: string
  name: string
  hierarchical: boolean
  freeTagging: boolean
  maxSelections?: number | null
  fields?: CustomFieldDefinition[]
}

class TaxonomyRegistry {
  private taxonomies = new Map<string, RegisteredTaxonomyConfig>()

  register(config: RegisteredTaxonomyConfig) {
    const slug = String(config?.slug || '').trim()
    if (!slug) return
    this.taxonomies.set(slug, {
      ...config,
      hierarchical: !!config.hierarchical,
      freeTagging: !!config.freeTagging,
      maxSelections:
        config.maxSelections === null || config.maxSelections === undefined
          ? null
          : Number.isFinite(config.maxSelections)
            ? Number(config.maxSelections)
            : null,
    })
  }

  get(slug: string): RegisteredTaxonomyConfig | undefined {
    return this.taxonomies.get(slug)
  }

  list(): RegisteredTaxonomyConfig[] {
    return Array.from(this.taxonomies.values())
  }
}

const taxonomyRegistry = new TaxonomyRegistry()
export default taxonomyRegistry
