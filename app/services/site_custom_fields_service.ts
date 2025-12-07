import siteFields, { type SiteField } from '../site/fields.ts'
import SiteCustomFieldValue from '#models/site_custom_field_value'

export type SiteCustomFieldValue = Record<string, any>

class SiteCustomFieldsService {
  listDefinitions(): SiteField[] {
    return siteFields
  }

  async getValues(): Promise<Record<string, SiteCustomFieldValue>> {
    const rows = await SiteCustomFieldValue.query().select('fieldSlug', 'value')
    const out: Record<string, SiteCustomFieldValue> = {}
    for (const r of rows) {
      out[String((r as any).fieldSlug)] = (r as any).value ?? null
    }
    return out
  }

  async upsertValues(values: Record<string, SiteCustomFieldValue>): Promise<void> {
    const defs = new Set(this.listDefinitions().map((f) => f.slug))
    for (const [slug, value] of Object.entries(values)) {
      if (!defs.has(slug)) continue
      const existing = await SiteCustomFieldValue.query().where('fieldSlug', slug).first()
      const normalized = value === undefined ? null : value
      if (existing) {
        existing.value = normalized as any
        await existing.save()
        continue
      }
      await SiteCustomFieldValue.create({
        fieldSlug: slug,
        value: normalized as any,
      })
    }
  }
}

export default new SiteCustomFieldsService()
