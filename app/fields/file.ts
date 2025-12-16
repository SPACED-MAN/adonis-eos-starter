import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const fileField: FieldTypeConfig = {
  type: 'file',
  label: 'File',
  icon: 'lucide:paperclip',
  scope: ['post', 'post-type'],
  configSchema: z.object({
    accept: z.string().optional(), // e.g., ".pdf,.docx"
    required: z.boolean().optional(),
  }),
  valueSchema: z
    .union([
      z.string(), // file id or URL
      z
        .object({
          id: z.string().optional(),
          url: z.string().optional(),
          name: z.string().optional(),
        })
        .passthrough(),
    ])
    .nullable(),
  adminComponent: 'admin/fields/FileField',
}

fieldTypeRegistry.register(fileField)

export default fileField
