import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const selectField: FieldTypeConfig = {
  type: 'select',
  label: 'Select',
  icon: 'lucide:list',
  scope: ['site', 'post', 'post-type'],
  configSchema: z.object({
    options: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        })
      )
      .nonempty(),
    required: z.boolean().optional(),
    multiple: z.boolean().optional(),
  }),
  valueSchema: z.union([z.string(), z.array(z.string())]).nullable(),
  adminComponent: 'admin/fields/SelectField',
}

fieldTypeRegistry.register(selectField)

export default selectField


