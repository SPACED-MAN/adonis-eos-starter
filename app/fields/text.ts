import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const textField: FieldTypeConfig = {
  type: 'text',
  label: 'Text',
  icon: 'lucide:type',
  scope: ['site', 'post', 'post-type'],
  configSchema: z.object({
    placeholder: z.string().optional(),
    maxLength: z.number().int().positive().optional(),
    required: z.boolean().optional(),
  }),
  valueSchema: z.string().max(10000).nullable(),
  adminComponent: 'admin/fields/TextField',
}

fieldTypeRegistry.register(textField)

export default textField


