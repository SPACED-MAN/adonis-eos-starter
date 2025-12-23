import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const richtextField: FieldTypeConfig = {
  type: 'richtext',
  label: 'Rich Text',
  icon: 'lucide:align-left',
  scope: ['site', 'post', 'post-type'],
  configSchema: z.object({
    required: z.boolean().optional(),
  }),
  valueSchema: z.union([z.string(), z.record(z.any()), z.array(z.any())]).nullable(),
  adminComponent: 'admin/fields/RichTextField',
}

fieldTypeRegistry.register(richtextField)

export default richtextField
