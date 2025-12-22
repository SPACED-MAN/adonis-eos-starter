import taxonomyRegistry from '#services/taxonomy_registry'
import fieldTypeRegistry from '#services/field_type_registry'
import TaxonomyTermCustomFieldValueModel from '#models/taxonomy_term_custom_field_value'
import type { PostTypeField } from '../types/custom_field.ts'

export type TaxonomyCustomFieldValue = Record<string, any>

class TaxonomyCustomFieldsService {
  listDefinitions(taxonomySlug: string): PostTypeField[] {
    const cfg = taxonomyRegistry.get(taxonomySlug)
    return cfg?.fields || []
  }

  async getValues(termId: string): Promise<Record<string, any>> {
    const rows = await TaxonomyTermCustomFieldValueModel.query()
      .where('termId', termId)
      .select('fieldSlug', 'value')
    const out: Record<string, any> = {}
    for (const r of rows) {
      out[String(r.fieldSlug)] = r.value ?? null
    }
    return out
  }

  async upsertValues(termId: string, taxonomySlug: string, values: Record<string, any>): Promise<void> {
    const defs = this.listDefinitions(taxonomySlug)
    const defsBySlug = new Map<string, PostTypeField>()
    defs.forEach((d) => defsBySlug.set(d.slug, d))

    for (const [slug, value] of Object.entries(values)) {
      const def = defsBySlug.get(slug)
      if (!def) continue

      const type = def.type || ''
      try {
        const cfg = fieldTypeRegistry.get(type)
        const parsed = cfg.valueSchema.safeParse(value ?? null)
        if (!parsed.success) {
          // skip invalid entries
          continue
        }
      } catch (e) {
        // skip invalid entries
        continue
      }

      const existing = await TaxonomyTermCustomFieldValueModel.query()
        .where('termId', termId)
        .where('fieldSlug', slug)
        .first()

      const normalized = value === undefined ? null : value
      if (existing) {
        existing.value = normalized as any
        await existing.save()
        continue
      }

      await TaxonomyTermCustomFieldValueModel.create({
        termId,
        fieldSlug: slug,
        value: normalized as any,
      })
    }
  }
}

export default new TaxonomyCustomFieldsService()

