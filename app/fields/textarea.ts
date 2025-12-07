import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const textareaField: FieldTypeConfig = {
  type: 'textarea',
  label: 'Textarea',
  icon: 'lucide:align-left',
  scope: ['site', 'post', 'post-type'],
  configSchema: z.object({
    placeholder: z.string().optional(),
    maxLength: z.number().int().positive().optional(),
    required: z.boolean().optional(),
  }),
  valueSchema: z.string().max(100000).nullable(),
  adminComponent: 'admin/fields/TextareaField',
}

fieldTypeRegistry.register(textareaField)

export default textareaField

