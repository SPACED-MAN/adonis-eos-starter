import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const postReferenceField: FieldTypeConfig = {
  type: 'post-reference',
  label: 'Post Reference',
  icon: 'lucide:link-2',
  scope: ['post', 'post-type'],
  configSchema: z.object({
    postType: z.string().optional(), // constrain to a type
    multiple: z.boolean().optional(),
  }),
  valueSchema: z
    .union([
      z.string(),
      z.array(z.string()),
      z.object({
        id: z.string().optional(),
        slug: z.string().optional(),
        locale: z.string().optional(),
      }),
      z.array(
        z.object({
          id: z.string().optional(),
          slug: z.string().optional(),
          locale: z.string().optional(),
        })
      ),
    ])
    .nullable(),
  adminComponent: 'admin/fields/PostReferenceField',
}

fieldTypeRegistry.register(postReferenceField)

export default postReferenceField

