import siteFields, { type SiteField } from '../site/fields.js'
import fieldTypeRegistry from '#services/field_type_registry'
import SiteCustomFieldValueModel from '#models/site_custom_field_value'

export type SiteCustomFieldValue = Record<string, any>

class SiteCustomFieldsService {
  listDefinitions(): SiteField[] {
    return siteFields
  }

  async getValues(): Promise<Record<string, SiteCustomFieldValue>> {
    const rows = await SiteCustomFieldValueModel.query().select('fieldSlug', 'value')
    const out: Record<string, SiteCustomFieldValue> = {}
    for (const r of rows) {
      out[String((r as any).fieldSlug)] = (r as any).value ?? null
    }
    return out
  }

  async upsertValues(values: Record<string, SiteCustomFieldValue>): Promise<void> {
    const defs = this.listDefinitions()
    const defsBySlug = new Map<string, SiteField>()
    defs.forEach((d) => defsBySlug.set(d.slug, d))
    for (const [slug, value] of Object.entries(values)) {
      const def = defsBySlug.get(slug)
      if (!def) continue
      const type = (def as any).type || ''
      try {
        const cfg = fieldTypeRegistry.get(type)
        const parsed = cfg.valueSchema.safeParse(value ?? null)
        if (!parsed.success) {
          console.error(`[SiteCustomFieldsService] Validation failed for "${slug}":`, parsed.error.format())
          continue
        }
      } catch (e) {
        console.error(`[SiteCustomFieldsService] Error processing "${slug}":`, e)
        continue
      }
      const existing = await SiteCustomFieldValueModel.query().where('fieldSlug', slug).first()
      const normalized = value === undefined ? null : value
      if (existing) {
        existing.value = normalized as any
        await existing.save()
        continue
      }
      await SiteCustomFieldValueModel.create({
        fieldSlug: slug,
        value: normalized as any,
      })
    }
  }
}

export default new SiteCustomFieldsService()
