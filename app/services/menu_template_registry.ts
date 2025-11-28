export type MenuTemplateField =
  | { key: string; label: string; type: 'text'; multiline?: boolean; required?: boolean }
  | { key: string; label: string; type: 'url'; required?: boolean }
  | { key: string; label: string; type: 'boolean' }

export type MenuTemplate = {
  slug: string
  name: string
  description?: string
  // Fields map to menus.meta_json for code-first data that editors can fill
  fields?: MenuTemplateField[]
  // Optional hints for rendering (e.g., mega nav)
  render?: {
    variant?: 'primary' | 'footer' | 'mega'
    // suggested columns/areas for sections
    sections?: Array<{ key: string; label: string; description?: string }>
  }
}

class MenuTemplateRegistry {
  private templates: Map<string, MenuTemplate> = new Map()

  register(template: MenuTemplate) {
    const slug = String(template.slug || '').trim()
    if (!slug) return
    this.templates.set(slug, template)
  }

  list(): MenuTemplate[] {
    return Array.from(this.templates.values())
  }

  get(slug: string): MenuTemplate | undefined {
    return this.templates.get(slug)
  }
}

const singleton = new MenuTemplateRegistry()
export default singleton


