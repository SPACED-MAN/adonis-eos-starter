import PostCustomFieldValue from '#models/post_custom_field_value'
import db from '@adonisjs/lucid/services/db'

export interface UpsertPostCustomFieldsParams {
  postId: string
  customFields: Array<{ slug?: string; value: any }>
}

export default class UpsertPostCustomFields {
  /**
   * Bulk upsert custom fields for a post.
   * Uses Lucid models to ensure hooks and proper JSON serialization.
   */
  static async handle({ postId, customFields }: UpsertPostCustomFieldsParams): Promise<void> {
    if (!customFields || !Array.isArray(customFields) || customFields.length === 0) return

    const entries = customFields
      .filter((cf) => cf?.slug && String(cf.slug).trim())
      .map((cf) => ({
        slug: String(cf.slug).trim(),
        value: cf.value === undefined ? null : cf.value,
      }))

    if (entries.length === 0) return

    await db.transaction(async (trx) => {
      for (const entry of entries) {
        // Use updateOrCreate for cleaner logic
        // This handles the ON CONFLICT internally and runs prepare/consume hooks
        await PostCustomFieldValue.updateOrCreate(
          { postId, fieldSlug: entry.slug },
          { value: entry.value },
          { client: trx }
        )
      }
    })
  }
}

