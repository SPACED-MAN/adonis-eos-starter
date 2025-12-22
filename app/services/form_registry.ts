import type { FormConfig } from '#types/form_types'

/**
 * Form Registry Service
 *
 * Central registry for all code-first forms in the system.
 */
class FormRegistry {
  private forms: Map<string, FormConfig> = new Map()

  /**
   * Register a form configuration
   */
  register(config: FormConfig): void {
    const slug = String(config?.slug || '').trim()
    if (!slug) return
    this.forms.set(slug, config)
  }

  /**
   * Get a form by slug
   */
  get(slug: string): FormConfig | undefined {
    return this.forms.get(slug)
  }

  /**
   * List all registered forms
   */
  list(): FormConfig[] {
    return Array.from(this.forms.values())
  }

  /**
   * Check if a form exists
   */
  has(slug: string): boolean {
    return this.forms.has(slug)
  }

  /**
   * Boot the registry by loading all form files from app/forms
   * (Uses Node.js require/fs since this runs server-side)
   */
  async boot(): Promise<void> {
    try {
      const path = await import('node:path')
      const fs = await import('node:fs')
      const { pathToFileURL } = await import('node:url')

      const appRoot = process.cwd()
      const formsDir = path.join(appRoot, 'app', 'forms')

      if (!fs.existsSync(formsDir)) return

      const files = fs.readdirSync(formsDir)
      for (const file of files) {
        if (file === 'index.ts' || file === 'index.js' || (!file.endsWith('.ts') && !file.endsWith('.js'))) {
          continue
        }

        const fullPath = path.join(formsDir, file)
        const module = await import(pathToFileURL(fullPath).href)
        const config = (module.default || module) as FormConfig

        if (config && config.slug) {
          this.register(config)
        }
      }
    } catch (error) {
      console.error('[FormRegistry] Failed to boot:', error)
    }
  }
}

const formRegistry = new FormRegistry()
export default formRegistry

