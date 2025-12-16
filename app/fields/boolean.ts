import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const booleanField: FieldTypeConfig = {
  type: 'boolean',
  label: 'Boolean',
  icon: 'lucide:toggle-left',
  scope: ['site', 'post', 'post-type'],
  configSchema: z.object({
    labelOn: z.string().optional(),
    labelOff: z.string().optional(),
  }),
  valueSchema: z.boolean().nullable(),
  adminComponent: 'admin/fields/BooleanField',
}

fieldTypeRegistry.register(booleanField)

export default booleanField
