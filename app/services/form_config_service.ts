import formRegistry from '#services/form_registry'
import type { FormConfig } from '#types/form_types'

class FormConfigService {
  list(): FormConfig[] {
    return formRegistry.list()
  }

  get(slug: string): FormConfig | null {
    return formRegistry.get(slug) || null
  }
}

export default new FormConfigService()
