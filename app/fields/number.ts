import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const numberField: FieldTypeConfig = {
  type: 'number',
  label: 'Number',
  icon: 'lucide:hash',
  scope: ['site', 'post', 'post-type'],
  configSchema: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    required: z.boolean().optional(),
  }),
  valueSchema: z.number().nullable(),
  adminComponent: 'admin/fields/NumberField',
}

fieldTypeRegistry.register(numberField)

export default numberField
