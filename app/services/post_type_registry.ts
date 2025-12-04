import type {} from 'node:fs'

export type RegisteredPostTypeConfig = {
  hideCoreFields?: Array<'title' | 'excerpt' | 'parent' | 'slug' | 'meta' | 'seo'>
  hierarchyEnabled?: boolean
  fields?: Array<{
    slug: string
    label: string
    type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'media' | 'date' | 'url'
    translatable?: boolean
    config?: Record<string, any>
  }>
  template?: { name: string; description?: string }
  urlPatterns?: Array<{ locale: string; pattern: string; isDefault?: boolean }>
}

class PostTypeRegistry {
  private types = new Map<string, RegisteredPostTypeConfig>()

  register(slug: string, config: RegisteredPostTypeConfig) {
    const normalized = String(slug || '').trim()
    if (!normalized) return
    this.types.set(normalized, config || {})
  }

  has(slug: string): boolean {
    return this.types.has(slug)
  }

  get(slug: string): RegisteredPostTypeConfig | undefined {
    return this.types.get(slug)
  }

  list(): string[] {
    return Array.from(this.types.keys()).sort()
  }

  entries(): Array<[string, RegisteredPostTypeConfig]> {
    return Array.from(this.types.entries())
  }
}

const postTypeRegistry = new PostTypeRegistry()
export default postTypeRegistry
