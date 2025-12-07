import siteFields, { type SiteField } from '../site/fields.ts'
import fieldTypeRegistry from '#services/field_type_registry'
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
          throw new Error(`Invalid value for field "${slug}": ${parsed.error.issues[0]?.message || 'invalid'}`)
        }
      } catch (e) {
        // skip invalid entries
        continue
      }
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
