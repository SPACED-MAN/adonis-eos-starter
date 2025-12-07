import { z } from 'zod'
import fieldTypeRegistry from '#services/field_type_registry'
import type { FieldTypeConfig } from './base_field.js'

const sliderField: FieldTypeConfig = {
  type: 'slider',
  label: 'Slider',
  icon: 'lucide:sliders-horizontal',
  scope: ['post', 'post-type'],
  configSchema: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    required: z.boolean().optional(),
    unit: z.string().optional(),
  }),
  valueSchema: z.number().nullable(),
  adminComponent: 'admin/fields/SliderField',
}

fieldTypeRegistry.register(sliderField)

export default sliderField


