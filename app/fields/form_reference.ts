import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const formReferenceField: FieldTypeConfig = {
  type: 'form-reference',
  label: 'Form Reference',
  icon: 'lucide:form-input',
  scope: ['site', 'post', 'post-type'],
  configSchema: z.object({
    allowedSlugs: z.array(z.string()).optional(),
    required: z.boolean().optional(),
  }),
  valueSchema: z.string().nullable(),
  adminComponent: 'admin/fields/FormReferenceField',
}

fieldTypeRegistry.register(formReferenceField)

export default formReferenceField
