import PostCustomFieldValue from '#models/post_custom_field_value'
import db from '@adonisjs/lucid/services/db'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

export interface UpsertPostCustomFieldsParams {
  postId: string
  customFields: Array<{ slug?: string; value: any }>
}

export default class UpsertPostCustomFields {
  /**
   * Bulk upsert custom fields for a post.
   * Uses Lucid models to ensure hooks and proper JSON serialization.
   */
  static async handle(
    { postId, customFields }: UpsertPostCustomFieldsParams,
    parentTrx?: TransactionClientContract
  ): Promise<void> {
    if (!customFields || !Array.isArray(customFields) || customFields.length === 0) return

    const entries = customFields
      .filter((cf) => cf?.slug && String(cf.slug).trim())
      .map((cf) => ({
        slug: String(cf.slug).trim(),
        value: cf.value === undefined ? null : cf.value,
      }))

    if (entries.length === 0) return

    const runInTransaction = async (trx: TransactionClientContract) => {
      for (const entry of entries) {
        // Use updateOrCreate for cleaner logic
        // This handles the ON CONFLICT internally and runs prepare/consume hooks
        await PostCustomFieldValue.updateOrCreate(
          { postId, fieldSlug: entry.slug },
          { value: entry.value },
          { client: trx }
        )
      }
    }

    if (parentTrx) {
      await runInTransaction(parentTrx)
    } else {
      await db.transaction(runInTransaction)
    }
  }
}

