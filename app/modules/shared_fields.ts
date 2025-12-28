import type { CustomFieldDefinition } from '#types/module_types'

/**
 * Standard background color options pulling from app.css variables.
 */
export const BACKGROUND_COLORS = [
  { label: 'Transparent', value: 'bg-transparent' },
  { label: 'Low', value: 'bg-backdrop-low' },
  { label: 'Medium', value: 'bg-backdrop-medium' },
  { label: 'High', value: 'bg-backdrop-high' },
  { label: 'Standout', value: 'bg-standout-low' },
] as const

/**
 * Standard background color field definition
 */
export const backgroundColorField: CustomFieldDefinition = {
  slug: 'backgroundColor',
  type: 'select',
  label: 'Background',
  options: [...BACKGROUND_COLORS],
  required: false,
  description: 'Section background style',
}
