import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const taxonomyReferenceField: FieldTypeConfig = {
  type: 'taxonomy',
  label: 'Taxonomy',
  icon: 'lucide:tags',
  scope: ['post', 'post-type'],
  configSchema: z.object({
    taxonomySlug: z.string().optional(),
    multiple: z.boolean().optional(),
    required: z.boolean().optional(),
  }),
  valueSchema: z.union([z.string(), z.array(z.string())]).nullable(),
  adminComponent: 'admin/fields/TaxonomyField',
}

fieldTypeRegistry.register(taxonomyReferenceField)

export default taxonomyReferenceField

