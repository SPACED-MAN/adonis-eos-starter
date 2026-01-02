import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const linkField: FieldTypeConfig = {
  type: 'link',
  label: 'Link',
  icon: 'lucide:link-2',
  scope: ['site', 'post', 'post-type'],
  configSchema: z.object({
    allowRelative: z.boolean().optional(),
    required: z.boolean().optional(),
  }),
  valueSchema: z
    .object({
      href: z.string().optional(),
      anchor: z.string().optional(),
      kind: z.enum(['post', 'url', 'anchor']).optional(),
      label: z.string().optional(),
      target: z.enum(['_self', '_blank']).optional(),
      postId: z.union([z.string(), z.number()]).optional(),
      postType: z.string().optional(),
      slug: z.string().optional(),
      locale: z.string().optional(),
      url: z.string().optional(),
    })
    .or(z.string())
    .nullable(),
  adminComponent: 'admin/fields/LinkField',
}

fieldTypeRegistry.register(linkField)

export default linkField
