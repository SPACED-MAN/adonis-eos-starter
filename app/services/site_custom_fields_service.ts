import db from '@adonisjs/lucid/services/db'
import siteFields, { type SiteField } from '../site/fields.ts'

export type SiteCustomFieldValue = Record<string, any>

class SiteCustomFieldsService {
	listDefinitions(): SiteField[] {
		return siteFields
	}

	async getValues(): Promise<Record<string, SiteCustomFieldValue>> {
		const rows = await db.from('site_custom_field_values').select('field_slug', 'value')
		const out: Record<string, SiteCustomFieldValue> = {}
		for (const r of rows) {
			out[String((r as any).field_slug)] = (r as any).value ?? null
		}
		return out
	}

	async upsertValues(values: Record<string, SiteCustomFieldValue>): Promise<void> {
		const defs = new Set(this.listDefinitions().map((f) => f.slug))
		const now = new Date()
		for (const [slug, value] of Object.entries(values)) {
			if (!defs.has(slug)) continue
			const exists = await db.from('site_custom_field_values').where('field_slug', slug).first()
			const jsonbValue = value === null || value === undefined ? null : db.raw('?::jsonb', [JSON.stringify(value)])
			if (exists) {
				await db.from('site_custom_field_values').where('field_slug', slug).update({ value: jsonbValue as any, updated_at: now } as any)
			} else {
				await db.table('site_custom_field_values').insert({ field_slug: slug, value: jsonbValue as any, created_at: now, updated_at: now } as any)
			}
		}
	}
}

export default new SiteCustomFieldsService()


