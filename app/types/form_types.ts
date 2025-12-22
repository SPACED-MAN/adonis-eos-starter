import type { CustomFieldDefinition } from './custom_field.js'

export interface FormConfig {
  slug: string
  title: string
  description?: string
  fields: CustomFieldDefinition[]
  successMessage?: string
  thankYouPostId?: string
  subscriptions?: string[] // Webhook IDs
}
