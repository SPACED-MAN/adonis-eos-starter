export type FormFieldType = 'text' | 'email' | 'textarea' | 'checkbox'

export interface FormFieldConfig {
  slug: string
  label: string
  type: FormFieldType
  required?: boolean
}

export interface FormConfig {
  slug: string
  title: string
  description?: string
  fields: FormFieldConfig[]
  successMessage?: string
}
