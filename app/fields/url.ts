import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const urlField: FieldTypeConfig = {
  type: 'url',
  label: 'URL',
  icon: 'lucide:link',
  scope: ['site', 'post', 'post-type'],
  configSchema: z.object({
    placeholder: z.string().optional(),
    required: z.boolean().optional(),
  }),
  valueSchema: z.string().url().nullable(),
  adminComponent: 'admin/fields/UrlField',
}

fieldTypeRegistry.register(urlField)

export default urlField
