import { getFormBySlug, listForms } from '../forms/index.js'
import type { FormConfig } from '#types/form_types'

class FormConfigService {
  list(): FormConfig[] {
    return listForms()
  }

  get(slug: string): FormConfig | null {
    return getFormBySlug(slug)
  }
}

export default new FormConfigService()
