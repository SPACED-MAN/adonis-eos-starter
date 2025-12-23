export const CUSTOM_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'boolean',
  'select',
  'multiselect',
  'media',
  'file',
  'date',
  'url',
  'link',
  'post-reference',
  'icon',
  'object',
  'repeater',
  'richtext',
  'slider',
  'taxonomy',
  'form-reference',
] as const

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]

export interface CustomFieldDefinition {
  slug: string
  label?: string
  type: CustomFieldType
  category?: string
  translatable?: boolean
  required?: boolean
  description?: string
  default?: any
  placeholder?: string
  accept?: string
  options?: Array<{ label: string; value: any }>
  fields?: CustomFieldDefinition[] // For 'object' type
  item?: CustomFieldDefinition // For 'repeater' type
  config?: Record<string, any>
  // slider/number configuration
  min?: number
  max?: number
  step?: number
  unit?: string
  // conditional visibility
  showIf?: {
    field: string
    equals?: any
    notEquals?: any
    isVideo?: boolean
  }
}
