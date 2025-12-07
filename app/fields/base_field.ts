import type { ZodTypeAny } from 'zod'

export type FieldScope = 'site' | 'post' | 'post-type'

export interface FieldTypeConfig {
  type: string
  label: string
  icon?: string
  scope: FieldScope[]
  configSchema: ZodTypeAny
  valueSchema: ZodTypeAny
  adminComponent: string // Inertia component name
}


