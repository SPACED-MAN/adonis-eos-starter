import type { ModuleConfig, ModuleRenderContext, MergedModuleData } from '#types/module_types'

export type RenderingMode = 'static' | 'react'

/**
 * Base class for all modules
 *
 * All concrete modules (Hero, Prose, etc.) must extend this class
 * and implement the required methods.
 */
export default abstract class BaseModule {
  /**
   * Get the module configuration
   * Must be implemented by each concrete module
   */
  abstract getConfig(): ModuleConfig

  /**
   * Rendering mode: 'static' (default) or 'react'
   *
   * - 'static': Pure SSR, no client-side hydration (best performance)
   * - 'react': SSR + hydration for interactive components
   *
   * Default: 'static' – opt in to 'react' only for modules that truly
   * need client-side interactivity.
   */
  getRenderingMode(): RenderingMode {
    return 'static'
  }

  /**
   * Component file name in `inertia/modules/`
   *
   * We now use a single filename convention for both static and React
   * modules: the component name always matches the module `type`.
   *
   * Example:
   * - type: 'prose'  → inertia/modules/prose.tsx
   * - type: 'gallery' → inertia/modules/gallery.tsx
   */
  getComponentName(): string {
    const config = this.getConfig()
    return config.type
  }

  /**
   * Validate module fields against schema
   *
   * Default implementation uses the fieldSchema from config.
   * Can be overridden for custom validation logic.
   *
   * @param fields - Fields to validate
   * @returns True if valid, throws error otherwise
   */
  validate(fields: Record<string, any>): boolean {
    const config = this.getConfig()

    // Basic validation: check required fields exist
    const schema = config.fieldSchema || []

    for (const f of schema) {
      if (f.required && !(f.slug in fields)) {
        throw new Error(`Missing required field: ${f.slug}`)
      }
    }

    return true
  }

  /**
   * Merge base fields with overrides
   *
   * Default implementation performs a shallow merge.
   * Can be overridden for deep merge or custom logic.
   *
   * @param baseFields - Base fields from module instance
   * @param overrides - Overrides from post_modules
   * @returns Merged fields
   */
  mergeFields(
    baseFields: Record<string, any>,
    overrides: Record<string, any> | null
  ): Record<string, any> {
    if (!overrides) {
      return { ...baseFields }
    }

    // Shallow merge by default
    return {
      ...baseFields,
      ...overrides,
    }
  }

  /**
   * Extract localized content from fields
   *
   * If a field value is an object with locale keys, extract the value for the current locale.
   * Otherwise, return the value as-is. Recursively handles nested objects.
   *
   * @param fields - Fields to localize
   * @param locale - Current locale
   * @param fallbackLocale - Fallback locale if current not found
   * @returns Localized fields
   */
  localizeFields(
    fields: Record<string, any>,
    locale: string,
    fallbackLocale: string = 'en'
  ): Record<string, any> {
    const localized: Record<string, any> = {}

    for (const [key, value] of Object.entries(fields)) {
      if (this.isLocalizedValue(value)) {
        // Extract locale-specific value
        localized[key] = value[locale] || value[fallbackLocale] || null
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively localize nested objects
        localized[key] = this.localizeFields(value, locale, fallbackLocale)
      } else {
        localized[key] = value
      }
    }

    return localized
  }

  /**
   * Check if a value is a localized object (has locale keys)
   *
   * A localized object has keys that look like locale codes (e.g., 'en', 'es', 'fr', 'en-US')
   * and values that are strings.
   *
   * @param value - Value to check
   * @returns True if value is a localized object
   */
  protected isLocalizedValue(value: any): value is Record<string, string> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false
    }

    const keys = Object.keys(value)
    if (keys.length === 0) {
      return false
    }

    // Check if keys look like locale codes:
    // - 2-5 characters long
    // - Lowercase letters only (with optional hyphen for regional codes like 'en-US')
    // - Values are strings
    const localePattern = /^[a-z]{2}(-[a-z]{2})?$/i

    return keys.every((key) => {
      if (typeof key !== 'string' || key.length < 2 || key.length > 5) {
        return false
      }
      // Must match locale pattern and have a string value
      return localePattern.test(key) && typeof value[key] === 'string'
    })
  }

  /**
   * Generate cache key for this module render
   *
   * @param data - Module data
   * @param context - Render context
   * @returns Cache key string
   */
  generateCacheKey(data: MergedModuleData, context: ModuleRenderContext): string {
    const config = this.getConfig()
    return `module:${config.type}:${context.locale}:${JSON.stringify(data.fields)}`
  }

  /**
   * Get cache tags for this module
   *
   * Used for cache invalidation strategies.
   *
   * @param data - Module data
   * @returns Array of cache tags
   */
  getCacheTags(data: MergedModuleData): string[] {
    const config = this.getConfig()
    return [`module:${config.type}`, `module:${data.scope}`]
  }

  /**
   * Whether this module should participate in per-module caching.
   *
   * By default we only cache:
   * - Static modules (`getRenderingMode() === 'static'`)
   * - Non-preview renders (`context.isPreview === false`)
   *
   * You can opt out completely by overriding and returning false.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isCacheEnabled(_data: MergedModuleData, context: ModuleRenderContext): boolean {
    return this.getRenderingMode() === 'static' && !context.isPreview
  }

  /**
   * Default cache TTL (in seconds) for per-module caching.
   *
   * Individual renders can override this by returning `cacheTtl` from
   * their `render` implementation.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDefaultCacheTtl(_data: MergedModuleData, _context: ModuleRenderContext): number {
    return 300 // 5 minutes
  }
}
