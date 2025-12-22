import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

export interface UpsertPostCustomFieldsParams {
  postId: string
  customFields: Array<{ slug?: string; value: any }>
}

export default class UpsertPostCustomFields {
  /**
   * Bulk upsert custom fields for a post.
   * Optimizes performance by reducing DB round-trips.
   */
  static async handle({ postId, customFields }: UpsertPostCustomFieldsParams): Promise<void> {
    if (!customFields || customFields.length === 0) return

    const now = new Date()
    const entries = customFields
      .filter((cf) => cf?.slug && String(cf.slug).trim())
      .map((cf) => ({
        slug: String(cf.slug).trim(),
        value: cf.value === undefined ? null : cf.value,
      }))

    if (entries.length === 0) return

    // Resolve dialect for bulk optimization if needed
    // For now, using a clean transaction-based approach which is better than individual calls
    await db.transaction(async (trx) => {
      const placeholders: string[] = []
      const bindings: any[] = []

      // Helper to unwrap accidentally double/triple-encoded JSON
      const unwrap = (val: any): any => {
        if (typeof val === 'string') {
          const trimmed = val.trim()
          if (
            (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
            (trimmed.startsWith('{') && trimmed.endsWith('}'))
          ) {
            try {
              return unwrap(JSON.parse(trimmed))
            } catch {
              return val
            }
          }
        }
        if (Array.isArray(val) && val.length === 1 && typeof val[0] === 'string') {
          const trimmed = val[0].trim()
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
              const parsed = JSON.parse(trimmed)
              if (Array.isArray(parsed)) {
                return unwrap(parsed)
              }
            } catch {
              // ignore
            }
          }
        }
        return val
      }

      for (const entry of entries) {
        let normalizedValue = unwrap(entry.value)

        if (normalizedValue !== null && normalizedValue !== undefined) {
          // Always stringify for the DB binding to ensure it's stored correctly in JSONB
          normalizedValue = JSON.stringify(normalizedValue)
        }

        placeholders.push('(?, ?, ?, ?, ?, ?)')
        bindings.push(randomUUID(), postId, entry.slug, normalizedValue, now, now)
      }

      await trx.raw(
        `
        INSERT INTO post_custom_field_values (id, post_id, field_slug, value, created_at, updated_at)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (post_id, field_slug)
        DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
      `,
        bindings
      )
    })
  }
}

