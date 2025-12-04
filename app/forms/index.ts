import contact from './contact.js'
import type { FormConfig } from '#types/form_types'

const forms: FormConfig[] = [contact]

export function listForms(): FormConfig[] {
  return forms
}

export function getFormBySlug(slug: string): FormConfig | null {
  const s = String(slug || '').trim()
  return forms.find((f) => f.slug === s) || null
}

export default forms
