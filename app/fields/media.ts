import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const mediaField: FieldTypeConfig = {
  type: 'media',
  label: 'Media',
  icon: 'lucide:image',
  scope: ['site', 'post', 'post-type'],
  configSchema: z.object({
    allowedTypes: z.array(z.string()).optional(), // e.g., ['image', 'video']
    required: z.boolean().optional(),
  }),
  valueSchema: z
    .union([
      z.string(), // media id
      z
        .object({
          id: z.string().optional(),
          url: z.string().optional(),
          // allow arbitrary metadata passthrough
        })
        .passthrough(),
    ])
    .nullable(),
  adminComponent: 'admin/fields/MediaField',
}

fieldTypeRegistry.register(mediaField)

export default mediaField
